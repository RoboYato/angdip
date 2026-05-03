import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db/connection';
import { logAction } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';
import { decryptMaterialContent } from '../utils/encryption';
import { recordMaterialFirstOpened } from '../services/materialAssignmentService';
import { fetchMaterialUnified } from '../services/materialMerge';

export async function getCourses(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let coursesResult;

    // Admin sees all courses
    if (req.user.isAdmin) {
      coursesResult = await pool.query(
        `SELECT * FROM courses ORDER BY created_at DESC`
      );
    } else {
      // Regular users see all published courses with enrollment status
      coursesResult = await pool.query(
        `SELECT c.*,
         CASE WHEN cu.user_id IS NOT NULL THEN true ELSE false END as is_enrolled,
         CASE 
           WHEN up.total_materials > 0 THEN 
             ROUND((up.completed_materials::DECIMAL / up.total_materials::DECIMAL) * 100)
           ELSE 0 
         END as progress_percent
         FROM courses c
         LEFT JOIN course_users cu ON c.id = cu.course_id AND cu.user_id = $1
         LEFT JOIN user_progress up ON c.id = up.course_id AND up.user_id = $1
         WHERE c.status = 'published'
         ORDER BY c.created_at DESC`,
        [req.user.userId]
      );
    }

    res.json(coursesResult.rows);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getCourseById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const courseResult = await pool.query(
      'SELECT * FROM courses WHERE id = $1',
      [id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const course = courseResult.rows[0];
    const userId = req.user?.userId;
    const isAdmin = req.user?.isAdmin;

    // Материалы курса: админ видит все; иначе — только если пользователь записан на курс (course_users) или имеет роль (course_roles)
    const materialsResult = isAdmin
      ? await pool.query(
          `SELECT m.* FROM materials m WHERE m.course_id = $1 AND m.status = 'published' ORDER BY m.order_num ASC`,
          [id]
        )
      : await pool.query(
          `SELECT m.* FROM materials m
           WHERE m.course_id = $1
             AND m.status = 'published'
             AND (
               (SELECT 1 FROM course_users cu WHERE cu.course_id = m.course_id AND cu.user_id = $2 LIMIT 1) IS NOT NULL
               OR (SELECT 1 FROM course_roles cr JOIN user_roles ur ON cr.role_id = ur.role_id AND ur.user_id = $2 WHERE cr.course_id = m.course_id LIMIT 1) IS NOT NULL
             )
           ORDER BY m.order_num ASC`,
          [id, userId]
        );

    res.json({
      ...course,
      materials: materialsResult.rows
    });
  } catch (error) {
    console.error('Get course by id error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getMaterialById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const materialRow = await fetchMaterialUnified(id);
    if (!materialRow) {
      return res.status(404).json({ message: 'Material not found' });
    }

    let material: any = { ...materialRow };

    // Decrypt content if encrypted
    if (material.encrypted_content && material.encryption_key_id) {
      try {
        const decryptedContent = await decryptMaterialContent(
          material.encrypted_content, 
          material.encryption_key_id
        );
        material.content = decryptedContent;
        // Remove encrypted fields from response
        delete material.encrypted_content;
        delete material.encryption_key_id;
      } catch (decryptError) {
        console.error('Decryption error:', decryptError);
        return res.status(403).json({ message: 'Unable to decrypt content' });
      }
    }

    // Get files
    const filesResult = await pool.query(
      'SELECT id, filename, file_path, file_size, mime_type FROM files WHERE material_id = $1',
      [id]
    );

    // Log action if material has access level
    if (material.access_level_id) {
      await logAction(
        req.user?.userId || '',
        'material_viewed',
        id,
        { title: material.title, access_level: material.access_level_code },
        req.ip
      );
    }

    if (req.user?.userId && material.material_type === 'documentation') {
      try {
        await recordMaterialFirstOpened(id, req.user.userId);
      } catch (e) {
        console.warn('recordMaterialFirstOpened:', e);
      }
    }

    res.json({
      ...material,
      files: filesResult.rows
    });
  } catch (error) {
    console.error('Get material by id error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getUserProgress(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const progressResult = await pool.query(
      `SELECT * FROM user_progress
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.user.userId]
    );

    res.json(progressResult.rows);
  } catch (error) {
    console.error('Get user progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateProgress(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { courseId, status } = req.body;

    const progressResult = await pool.query(
      `UPDATE user_progress
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND course_id = $3
       RETURNING *`,
      [status, req.user.userId, courseId]
    );

    if (progressResult.rows.length === 0) {
      return res.status(404).json({ message: 'Progress not found' });
    }

    res.json(progressResult.rows[0]);
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function enrollInCourse(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { courseId } = req.params;

    // Check if already enrolled
    const existingEnrollment = await pool.query(
      'SELECT * FROM course_users WHERE course_id = $1 AND user_id = $2',
      [courseId, req.user.userId]
    );

    if (existingEnrollment.rows.length > 0) {
      return res.status(409).json({ message: 'Already enrolled in this course' });
    }

    // Enroll user
    await pool.query(
      'INSERT INTO course_users (course_id, user_id) VALUES ($1, $2)',
      [courseId, req.user.userId]
    );

    // Create progress entry
    await pool.query(
      `INSERT INTO user_progress (id, user_id, course_id, status, completed_materials, total_materials)
       VALUES ($1, $2, $3, 'not_started', 0, 0)`,
      [uuidv4(), req.user.userId, courseId]
    );

    await logAction(
      req.user.userId,
      'course_enrolled',
      courseId,
      {},
      req.ip
    );

    res.status(201).json({ message: 'Successfully enrolled in course' });
  } catch (error) {
    console.error('Enroll in course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getCourseModules(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { courseId } = req.params;
    const userId = req.user.userId;
    const isAdmin = req.user.isAdmin;

    const modulesResult = isAdmin
      ? await pool.query(
          `SELECT m.*,
           CASE WHEN mc.id IS NOT NULL THEN true ELSE false END as is_completed
           FROM materials m
           LEFT JOIN material_completions mc ON m.id = mc.material_id AND mc.user_id = $1
           WHERE m.course_id = $2 AND m.status = 'published'
           ORDER BY m.order_num ASC`,
          [userId, courseId]
        )
      : await pool.query(
          `SELECT m.*,
           CASE WHEN mc.id IS NOT NULL THEN true ELSE false END as is_completed
           FROM materials m
           LEFT JOIN material_completions mc ON m.id = mc.material_id AND mc.user_id = $1
           WHERE m.course_id = $2
             AND m.status = 'published'
             AND (
               (SELECT 1 FROM course_users cu WHERE cu.course_id = m.course_id AND cu.user_id = $1 LIMIT 1) IS NOT NULL
               OR (SELECT 1 FROM course_roles cr JOIN user_roles ur ON cr.role_id = ur.role_id AND ur.user_id = $1 WHERE cr.course_id = m.course_id LIMIT 1) IS NOT NULL
             )
           ORDER BY m.order_num ASC`,
          [userId, courseId]
        );

    res.json(modulesResult.rows);
  } catch (error) {
    console.error('Get course modules error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
