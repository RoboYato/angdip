import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

export async function createCourse(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { title, description, status, responsible_leader } = req.body;  // 🟢 ДОБАВИТЬ responsible_leader

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const courseId = uuidv4();

    const courseResult = await pool.query(
       `INSERT INTO courses (id, title, description, status, created_by, responsible_leader)
        VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [courseId, title, description || null, status || 'draft', req.user.userId, responsible_leader || null]
    );

    res.status(201).json(courseResult.rows[0]);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}




export async function updateCourse(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { title, description, status, responsible_leader } = req.body;

    const courseResult = await pool.query(
      `UPDATE courses
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           responsible_leader = COALESCE($4, responsible_leader),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [title, description, status, responsible_leader, id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ message: 'Курс не найден' });
    }

    res.json(courseResult.rows[0]);
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteCourse(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    const courseResult = await pool.query(
      `DELETE FROM courses WHERE id = $1 RETURNING id`,
      [id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ message: 'Курс не найден' });
    }

    res.json({ message: 'Курс удалён' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function addRoleToCourse(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { courseId, roleId } = req.body;

    if (!courseId || !roleId) {
      return res.status(400).json({ message: 'Course ID and Role ID required' });
    }

    const relationId = uuidv4();

    await pool.query(
      `INSERT INTO course_roles (id, course_id, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [relationId, courseId, roleId]
    );

    res.status(201).json({ message: 'Role added to course' });
  } catch (error) {
    console.error('Add role to course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function removeRoleFromCourse(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { courseId, roleId } = req.params;

    await pool.query(
      `DELETE FROM course_roles
       WHERE course_id = $1 AND role_id = $2`,
      [courseId, roleId]
    );

    res.json({ message: 'Role removed from course' });
  } catch (error) {
    console.error('Remove role from course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function addUserToCourse(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { courseId, userId } = req.body;

    if (!courseId || !userId) {
      return res.status(400).json({ message: 'Course ID and User ID required' });
    }

    const relationId = uuidv4();

    await pool.query(
      `INSERT INTO course_users (id, course_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [relationId, courseId, userId]
    );

    res.status(201).json({ message: 'User added to course' });
  } catch (error) {
    console.error('Add user to course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function removeUserFromCourse(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { courseId, userId } = req.params;

    await pool.query(
      `DELETE FROM course_users
       WHERE course_id = $1 AND user_id = $2`,
      [courseId, userId]
    );

    res.json({ message: 'User removed from course' });
  } catch (error) {
    console.error('Remove user from course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
