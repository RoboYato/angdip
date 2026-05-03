import express, { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import * as adminController from '../controllers/adminController';
import { getUserTestAttempts } from '../controllers/adminController';
import { pool } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { processDocumentationReminders } from '../services/notificationService';
import { SQL_COURSE_WHERE_USER_IS_RESPONSIBLE } from '../utils/responsibleCourses';
import { getResponsibleDocumentationDashboard } from '../services/responsibleDashboardService';
import * as reportController from '../controllers/reportController';

const router = Router();

// Справочник отделов (для форм материалов, фильтров)
router.get('/departments', authMiddleware, adminController.getDistinctDepartments);

// Roles
router.get('/roles', authMiddleware, adminController.getAllRoles);
router.post('/roles', authMiddleware, adminMiddleware, adminController.createRole);
router.put('/roles/:id', authMiddleware, adminMiddleware, adminController.updateRole);
router.delete('/roles/:id', authMiddleware, adminMiddleware, adminController.deleteRole);

// Access Levels
router.get('/access-levels', authMiddleware, adminController.getAccessLevels);
router.post('/access-levels', authMiddleware, adminMiddleware, adminController.createAccessLevel);
router.put('/access-levels/:id', authMiddleware, adminMiddleware, adminController.updateAccessLevel);
router.delete('/access-levels/:id', authMiddleware, adminMiddleware, adminController.deleteAccessLevel);

// Users
router.get('/users', authMiddleware, adminMiddleware, adminController.getAllUsers);
router.post('/users', authMiddleware, adminMiddleware, adminController.createUserInLMS);
router.put('/users/:id', authMiddleware, adminMiddleware, adminController.updateUser);
router.delete('/users/:id', authMiddleware, adminMiddleware, adminController.deactivateUser);

/** Грифы пользователя: конкретные пути — до любых широких /users/:id/... при необходимости расширения */
router.delete(
  '/users/:userId/access-levels',
  authMiddleware,
  adminMiddleware,
  adminController.removeAllUserAccessLevels
);
router.post(
  '/users/:userId/access-levels',
  authMiddleware,
  adminMiddleware,
  adminController.addUserAccessLevel
);
router.delete(
  '/users/:userId/access-levels/:levelId',
  authMiddleware,
  adminMiddleware,
  adminController.removeUserAccessLevel
);

// User Roles
router.post('/user-roles', authMiddleware, adminMiddleware, adminController.assignRoleToUser);
router.delete('/user-roles/:userId/:roleId', authMiddleware, adminMiddleware, adminController.removeRoleFromUser);

// Progress tracking
router.get('/user-progress', authMiddleware, adminMiddleware, adminController.getUserProgress);
router.get('/reports/overall', authMiddleware, adminMiddleware, reportController.getOverallAdminReport);
//router.get('/user-progress/:userId/:courseId/materials', authMiddleware, adminMiddleware, adminController.getUserMaterials);
router.get('/user-progress/:userId/:courseId/test-attempts', authMiddleware, adminMiddleware, getUserTestAttempts);
router.get('/courses', authMiddleware, adminMiddleware, adminController.getAdminCourses);

// Audit Logs
router.get('/audit-logs', authMiddleware, adminMiddleware, adminController.getAuditLogsForAdmin);

// ============================================
// 🟢 МАРШРУТЫ ДЛЯ ДОЛЖНОСТЕЙ (POSITIONS)
// ============================================

router.get('/positions', authMiddleware, adminController.getPositionsList);
router.get('/positions/all', authMiddleware, adminMiddleware, adminController.getAllPositionsList);
router.get('/positions/:id', authMiddleware, adminController.getSinglePosition);
router.post('/positions', authMiddleware, adminMiddleware, adminController.createNewPosition);
router.put('/positions/:id', authMiddleware, adminMiddleware, adminController.updateExistingPosition);
router.delete('/positions/:id', authMiddleware, adminMiddleware, adminController.deleteExistingPosition);
router.get('/positions/search/:query', authMiddleware, adminController.searchPositionsList);
router.get('/positions/stats', authMiddleware, adminMiddleware, adminController.getPositionsStatistics);
router.post('/positions/assign', authMiddleware, adminMiddleware, adminController.assignPositionToUserById);
router.put('/users/:id/position', authMiddleware, adminMiddleware, adminController.updateUserPosition);

// ============================================
// 🟢 МАРШРУТЫ ДЛЯ ОТВЕТСТВЕННОГО РУКОВОДИТЕЛЯ
// ============================================

router.get('/user-progress/:userId/:courseId/materials', authMiddleware, adminController.getUserMaterials);

/** Документация, за которую пользователь отвечает (материал или набор правил), включая без курса */
router.get('/responsible-materials', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `
      SELECT DISTINCT ON (m.id)
        m.id,
        m.title,
        m.status,
        m.material_type,
        m.course_id,
        m.password_expires_at,
        m.responsible_user_id,
        c.title AS course_title
      FROM materials m
      LEFT JOIN courses c ON c.id = m.course_id
      LEFT JOIN material_access_rule_sets ars ON ars.material_id = m.id
      WHERE m.material_type = 'documentation'
        AND m.status = 'published'
        AND (
          m.responsible_user_id = $1::uuid
          OR ars.responsible_user_id = $1::uuid
        )
      ORDER BY m.id, m.title
    `,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting responsible materials:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/responsible-documentation-dashboard', authMiddleware, async (req: any, res: any) => {
  try {
    const data = await getResponsibleDocumentationDashboard(req.user.userId);
    res.json(data);
  } catch (error) {
    console.error('responsible-documentation-dashboard', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Получить прогресс по курсам, где пользователь является ответственным
router.get('/responsible-progress', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT 
        up.user_id,
        u.fio as user_name,
        u.position,
        u.department,
        up.course_id,
        c.title as course_title,
        up.status,
        up.completed_materials,
        up.total_materials,
        ROUND(up.completed_materials::DECIMAL / NULLIF(up.total_materials, 0) * 100, 1) as progress_percent,
        up.updated_at
      FROM user_progress up
      JOIN users u ON up.user_id = u.id
      JOIN courses c ON up.course_id = c.id
      WHERE ${SQL_COURSE_WHERE_USER_IS_RESPONSIBLE}
        AND u.is_deleted = false
      ORDER BY u.fio, c.title
    `,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error getting responsible progress:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Получить курсы, где пользователь является ответственным
router.get('/responsible-courses', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT DISTINCT c.id, c.title, c.description, c.status, c.created_at
      FROM courses c
      WHERE ${SQL_COURSE_WHERE_USER_IS_RESPONSIBLE}
      ORDER BY c.title
    `,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error getting responsible courses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Получить детальную статистику для ответственного руководителя
router.get('/responsible-stats/detailed', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    
    // Получаем курсы, где пользователь является ответственным (курс или документация на курсе)
    const responsibleCourses = await pool.query(
      `
      SELECT c.id FROM courses c
      WHERE ${SQL_COURSE_WHERE_USER_IS_RESPONSIBLE}
    `,
      [userId]
    );
    
    const courseIds = responsibleCourses.rows.map(c => c.id);
    
    if (courseIds.length === 0) {
      return res.json([]);
    }
    
    // Получаем прогресс пользователей по этим курсам
    const progressResult = await pool.query(`
      SELECT 
        up.user_id,
        u.fio,
        u.position,
        u.department,
        up.course_id,
        c.title as course_title,
        up.status,
        up.completed_materials,
        up.total_materials,
        ROUND(up.completed_materials::DECIMAL / NULLIF(up.total_materials, 0) * 100, 1) as progress_percent,
        up.updated_at
      FROM user_progress up
      JOIN users u ON up.user_id = u.id
      JOIN courses c ON up.course_id = c.id
      WHERE up.course_id = ANY($1::uuid[])
        AND u.is_deleted = false
      ORDER BY u.fio, c.title
    `, [courseIds]);
    
    res.json(progressResult.rows);
  } catch (error) {
    console.error('Error getting detailed stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// ============================================
// 🟢 МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ КУРСАМИ (ADMIN)
// ============================================

// Создать курс
router.post('/courses', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { title, description, status, responsible_leader } = req.body;

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
});

// Обновить курс
router.put('/courses/:id', authMiddleware, adminMiddleware, async (req: any, res: any) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { title, description, status, responsible_leader } = req.body;

    console.log('=== UPDATE COURSE ===');
    console.log('ID:', id);
    console.log('Data:', { title, description, status, responsible_leader });

    // Проверим, существует ли курс
    const checkCourse = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);
    console.log('Existing course:', checkCourse.rows[0]);

    if (checkCourse.rows.length === 0) {
      return res.status(404).json({ message: 'Курс не найден' });
    }

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

    console.log('Updated course:', courseResult.rows[0]);

    res.json(courseResult.rows[0]);
  } catch (error) {
    console.error('Update course error DETAILS:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message, stack: error.stack });
  }
});

// Удалить курс
router.delete('/courses/:id', authMiddleware, adminMiddleware, async (req: any, res: any) => {
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
});

// Ручной запуск напоминаний по документации (cron-логика)
router.post('/notifications/run', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const force = req.body?.force === true || req.body?.force === 'true';
    const result = await processDocumentationReminders({ force });
    res.json({ ok: true, force, ...result });
  } catch (error: any) {
    console.error('notifications/run', error);
    res.status(500).json({ message: 'Internal server error', detail: error?.message });
  }
});

export default router;