import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool, aiusPool } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../utils/security';




export async function getAllRoles(req: AuthRequest, res: Response) {
  try {
    const rolesResult = await pool.query(
      'SELECT * FROM roles ORDER BY created_at DESC'
    );

    res.json(rolesResult.rows);
  } catch (error) {
    console.error('Get all roles error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function createRole(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Role name required' });
    }

    const roleId = uuidv4();

    const roleResult = await pool.query(
      `INSERT INTO roles (id, name, description, is_system)
       VALUES ($1, $2, $3, false)
       RETURNING *`,
      [roleId, name, description || null]
    );

    res.status(201).json(roleResult.rows[0]);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateRole(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    const roleResult = await pool.query(
      `UPDATE roles
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name, description, id]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }

    res.json(roleResult.rows[0]);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteRole(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    const roleResult = await pool.query(
      `DELETE FROM roles
       WHERE id = $1 AND is_system = false
       RETURNING id`,
      [id]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ message: 'Role not found or is system role' });
    }

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAccessLevels(req: AuthRequest, res: Response) {
  try {
    const accessLevelsResult = await pool.query(
      'SELECT * FROM access_levels ORDER BY priority ASC'
    );

    res.json(accessLevelsResult.rows);
  } catch (error) {
    console.error('Get access levels error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function createAccessLevel(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { name, code, priority, description, requiresPassword } = req.body;

    if (!name || !code || priority === undefined) {
      return res.status(400).json({ message: 'Name, code, and priority required' });
    }

    const levelId = uuidv4();

    const levelResult = await pool.query(
      `INSERT INTO access_levels (id, name, code, priority, description, requires_password)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [levelId, name, code, priority, description || null, requiresPassword || false]
    );

    res.status(201).json(levelResult.rows[0]);
  } catch (error) {
    console.error('Create access level error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateAccessLevel(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { name, code, priority, description, requiresPassword } = req.body;

    const levelResult = await pool.query(
      `UPDATE access_levels
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           priority = COALESCE($3, priority),
           description = COALESCE($4, description),
           requires_password = COALESCE($5, requires_password)
       WHERE id = $6
       RETURNING *`,
      [name, code, priority, description, requiresPassword, id]
    );

    if (levelResult.rows.length === 0) {
      return res.status(404).json({ message: 'Access level not found' });
    }

    res.json(levelResult.rows[0]);
  } catch (error) {
    console.error('Update access level error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteAccessLevel(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    const levelResult = await pool.query(
      `DELETE FROM access_levels WHERE id = $1 RETURNING id`,
      [id]
    );

    if (levelResult.rows.length === 0) {
      return res.status(404).json({ message: 'Access level not found' });
    }

    res.json({ message: 'Access level deleted' });
  } catch (error) {
    console.error('Delete access level error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAllUsers(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const usersResult = await pool.query(`
     SELECT 
  u.*,
  COALESCE(
    (SELECT json_agg(json_build_object('id', al.id, 'code', al.code, 'name', al.name))
     FROM user_access_levels ual
     JOIN access_levels al ON al.id = ual.access_level_id
     WHERE ual.user_id = u.id
    ), '[]'::json
  ) as access_levels,
  -- также нужно сохранить остальные поля, которые уже были (например, position_name, position_importance, roles и т.д.)
  p.name as position_name,
  p.importance as position_importance,
  COALESCE(
    (SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'description', r.description, 'created_at', r.created_at, 'updated_at', r.updated_at))
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = u.id
    ), '[]'::json
  ) as roles
FROM users u
LEFT JOIN positions p ON u.position_id = p.id
WHERE u.is_deleted = false
ORDER BY u.created_at DESC;
    `);

    const usersWithRoles = await Promise.all(
      usersResult.rows.map(async (user) => {
        const rolesResult = await pool.query(
          `SELECT r.* FROM roles r
           JOIN user_roles ur ON r.id = ur.role_id
           WHERE ur.user_id = $1`,
          [user.id]
        );
        return {
          ...user,
          roles: rolesResult.rows
        };
      })
    );

    res.json(usersWithRoles);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function createUserInLMS(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

// 🟢 ДОБАВЛЯЕМ position_id
    const { fio, login, password, email, isAdmin, position, department, position_id } = req.body;

    if (!fio || !login || !password) {
      return res.status(400).json({ message: 'ФИО, логин и пароль обязательны' });
    }

    const userId = uuidv4();
    const passwordHash = await hashPassword(password);

    const pid =
      position_id != null &&
      String(position_id).trim() !== '' &&
      String(position_id).toLowerCase() !== 'null'
        ? String(position_id).trim()
        : null;

    const userResult = await pool.query(
      `INSERT INTO users (id, fio, login, password_hash, email, is_admin, position, department, position_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, fio, login, email, is_admin, position, department, position_id`,
      [userId, fio, login, passwordHash, email || null, isAdmin || false, position || null, department || null, pid]
    );

    res.status(201).json(userResult.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });}
}

export async function updateUser(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
     const { fio, login, email, password, isAdmin, position, department, position_id } = req.body;

    let passwordHash: string | undefined;
    if (password) {
      passwordHash = await hashPassword(password);
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fio !== undefined) { updates.push(`fio = $${idx++}`); values.push(fio); }
    if (login !== undefined) { updates.push(`login = $${idx++}`); values.push(login); }
    if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email); }
    if (passwordHash !== undefined) { updates.push(`password_hash = $${idx++}`); values.push(passwordHash); }
    if (isAdmin !== undefined) { updates.push(`is_admin = $${idx++}`); values.push(isAdmin); }
    if (position !== undefined) { updates.push(`position = $${idx++}`); values.push(position); }
    if (department !== undefined) { updates.push(`department = $${idx++}`); values.push(department); }
    if (position_id !== undefined) { updates.push(`position_id = $${idx++}`); values.push(position_id); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const userResult = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} AND is_deleted = false
       RETURNING id, fio, login, email, is_admin, position, department, position_id`,
      values
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' }); }
}

export async function deactivateUser(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    // Получаем текущий статус пользователя
    const current = await pool.query(
      'SELECT is_active FROM users WHERE id = $1 AND is_deleted = false',
      [id]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const newStatus = !current.rows[0].is_active;

    const userResult = await pool.query(
      `UPDATE users
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, fio, login, is_active`,
      [newStatus, id]
    );

    res.json({ message: newStatus ? 'User activated' : 'User deactivated', is_active: newStatus });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function assignRoleToUser(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { userId, roleId } = req.body;

    if (!userId || !roleId) {
      return res.status(400).json({ message: 'User ID and Role ID required' });
    }

    const relationId = uuidv4();

    await pool.query(
      `INSERT INTO user_roles (id, user_id, role_id, is_from_aius)
       VALUES ($1, $2, $3, false)
       ON CONFLICT DO NOTHING`,
      [relationId, userId, roleId]
    );

    res.status(201).json({ message: 'Role assigned to user' });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function removeRoleFromUser(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { userId, roleId } = req.params;

    await pool.query(
      `DELETE FROM user_roles
       WHERE user_id = $1 AND role_id = $2 AND is_from_aius = false`,
      [userId, roleId]
    );

    res.json({ message: 'Role removed from user' });
  } catch (error) {
    console.error('Remove role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAuditLogsForAdmin(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { materialId, action, limit = 100, offset = 0 } = req.query;

    let query = `SELECT 
        al.id,
        al.user_id,
        u.login as user_login,
        u.fio as user_fio,
        al.material_id,
        m.title as material_title,
        al.action,
        al.action_details,
        al.ip_address,
        al.created_at
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN materials m ON al.material_id = m.id
      WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (materialId) {
      query += ` AND al.material_id = $${idx++}`;
      params.push(materialId);
    }
    if (action) {
      query += ` AND al.action = $${idx++}`;
      params.push(action);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const logsResult = await pool.query(query, params);

    res.json(logsResult.rows);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getUserProgress(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const progressResult = await pool.query(
      `SELECT DISTINCT ON (up.user_id, up.course_id)
        up.user_id,
        up.course_id,
        up.status,
        up.completed_materials,
        up.total_materials,
        up.created_at,
        up.updated_at,
        u.fio as user_name,
        u.login as user_login,
        u.position,
        u.department,
        COALESCE(
          (SELECT string_agg(r.name, ', ' ORDER BY r.name)
           FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id),
          ''
        ) AS roles,
        c.title as course_title,
        CASE 
          WHEN up.total_materials > 0 THEN 
            ROUND((up.completed_materials::DECIMAL / up.total_materials::DECIMAL) * 100)
          ELSE 0 
        END as progress_percent
       FROM user_progress up
       JOIN users u ON up.user_id = u.id
       JOIN courses c ON up.course_id = c.id
       WHERE u.is_deleted = false
       ORDER BY up.user_id, up.course_id, up.updated_at DESC`
    );

    res.json(progressResult.rows);
  } catch (error) {
    console.error('Get user progress error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getUserTestAttempts(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { userId, courseId } = req.params;

    const attemptsResult = await pool.query(
      `SELECT 
        utr.id,
        utr.score,
        utr.passed,
        utr.completed_at,
        t.title as test_title,
        t.test_type,
        (SELECT COUNT(*)::int FROM test_questions tq WHERE tq.test_id = t.id) as total_questions
       FROM user_test_results utr
       JOIN tests t ON utr.test_id = t.id
       WHERE utr.user_id = $1 AND t.course_id = $2
       ORDER BY utr.completed_at DESC`,
      [userId, courseId]
    );

    res.json(attemptsResult.rows);
  } catch (error) {
    console.error('Get user test attempts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getUserMaterials(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { userId, courseId } = req.params;

    const materialsResult = await pool.query(
      `SELECT 
        m.id,
        m.title,
        m.description,
        m.order_num,
        CASE WHEN mc.completed_at IS NOT NULL THEN true ELSE false END as is_completed,
        mc.completed_at
       FROM materials m
       LEFT JOIN material_completions mc ON m.id = mc.material_id AND mc.user_id = $1
       WHERE m.course_id = $2 AND m.status = 'published'
       ORDER BY m.order_num ASC`,
      [userId, courseId]
    );

    res.json(materialsResult.rows);
  } catch (error) {
    console.error('Get user materials error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAdminCourses(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const coursesResult = await pool.query(
      'SELECT id, title, description, status, responsible_leader, created_at FROM courses ORDER BY created_at DESC'
      );

    res.json(coursesResult.rows);
  } catch (error) {
    console.error('Get admin courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}


// ============================================
// 🟢 ФУНКЦИИ ДЛЯ РАБОТЫ С ДОЛЖНОСТЯМИ
// ============================================

// Получить все активные должности
export const getPositionsList = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, 
        p.name, 
        p.importance, 
        p.description, 
        p.is_active,
        p.created_at, 
        p.updated_at,
        COUNT(DISTINCT u.id) as users_count
      FROM positions p
      LEFT JOIN users u ON u.position_id = p.id AND u.is_deleted = false
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.importance DESC, p.name ASC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка должностей'
    });
  }
};

// Получить все должности (включая неактивные)
export const getAllPositionsList = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, 
        p.name, 
        p.importance, 
        p.description, 
        p.is_active,
        p.created_at, 
        p.updated_at,
        COUNT(DISTINCT u.id) as users_count
      FROM positions p
      LEFT JOIN users u ON u.position_id = p.id AND u.is_deleted = false
      GROUP BY p.id
      ORDER BY p.importance DESC, p.name ASC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching all positions:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка должностей'
    });
  }
};

// Получить должность по ID
export const getSinglePosition = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    
    const result = await pool.query(`
      SELECT 
        p.id, 
        p.name, 
        p.importance, 
        p.description, 
        p.is_active,
        p.created_at, 
        p.updated_at
      FROM positions p
      WHERE p.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Должность не найдена'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching position:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении должности'
    });
  }
};

// Упрощенная версия - без сложных типов
export const createNewPosition = async (req: any, res: any) => {
  try {
    const { name, importance, description } = req.body;
    const userId = req.user?.id;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Название должности обязательно'
      });
    }
    
    if (importance === undefined || importance < 0 || importance > 100) {
      return res.status(400).json({
        success: false,
        message: 'Важность должна быть числом от 0 до 100'
      });
    }
    
    const result = await pool.query(`
      INSERT INTO positions (id, name, importance, description, created_by)
      VALUES (gen_random_uuid(), $1, $2, $3, $4)
      RETURNING id, name, importance, description, is_active, created_at, updated_at
    `, [name.trim(), importance, description || null, userId]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Должность успешно создана'
    });
  } catch (error: any) {
    console.error('Error creating position:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Должность с таким названием уже существует'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании должности'
    });
  }
};

// Обновить должность
export const updateExistingPosition = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { name, importance, description, is_active } = req.body;
    
    const checkResult = await pool.query('SELECT id FROM positions WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Должность не найдена'
      });
    }
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Название должности обязательно'
      });
    }
    
    const result = await pool.query(`
      UPDATE positions 
      SET name = $1, importance = $2, description = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, name, importance, description, is_active, created_at, updated_at
    `, [name.trim(), importance, description || null, is_active !== undefined ? is_active : true, id]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Должность успешно обновлена'
    });
  } catch (error: any) {
    console.error('Error updating position:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Должность с таким названием уже существует'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении должности'
    });
  }
};

// Удалить должность
export const deleteExistingPosition = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    
    const usersCheck = await pool.query(
      'SELECT COUNT(*) FROM users WHERE position_id = $1 AND is_deleted = false',
      [id]
    );
    
    const usersCount = parseInt(usersCheck.rows[0].count);
    
    if (usersCount > 0) {
      await pool.query('UPDATE positions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      return res.json({
        success: true,
        message: `Должность деактивирована (${usersCount} пользователей имеют эту должность)`
      });
    } else {
      const result = await pool.query('DELETE FROM positions WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Должность не найдена' });
      }
      res.json({ success: true, message: 'Должность успешно удалена' });
    }
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ success: false, message: 'Ошибка при удалении должности' });
  }
};

// Поиск должностей
export const searchPositionsList = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.params.query;
    
    const result = await pool.query(`
      SELECT id, name, importance, description, is_active
      FROM positions 
      WHERE is_active = true AND (name ILIKE $1 OR description ILIKE $1)
      ORDER BY importance DESC, name ASC
      LIMIT 20
    `, [`%${query}%`]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error searching positions:', error);
    res.status(500).json({ success: false, message: 'Ошибка при поиске должностей' });
  }
};

// Статистика по должностям
export const getPositionsStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active,
        ROUND(AVG(importance)) as avg_importance,
        MAX(importance) as max_importance,
        MIN(importance) as min_importance
      FROM positions
    `);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching positions stats:', error);
    res.status(500).json({ success: false, message: 'Ошибка при получении статистики' });
  }
};

// Назначить должность пользователю
export const assignPositionToUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, positionId } = req.body;
    
    if (!userId || !positionId) {
      return res.status(400).json({ success: false, message: 'ID пользователя и ID должности обязательны' });
    }
    
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND is_deleted = false', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }
    
    const positionCheck = await pool.query('SELECT id FROM positions WHERE id = $1 AND is_active = true', [positionId]);
    if (positionCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Должность не найдена или неактивна' });
    }
    
    await pool.query('UPDATE users SET position_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [positionId, userId]);
    
    res.json({ success: true, message: 'Должность успешно назначена пользователю' });
  } catch (error) {
    console.error('Error assigning position:', error);
    res.status(500).json({ success: false, message: 'Ошибка при назначении должности' });
  }

};


// ============================================
// 🟢 ФУНКЦИИ ДЛЯ УРОВНЕЙ ДОСТУПА ПОЛЬЗОВАТЕЛЕЙ
// ============================================

// Получить уровни доступа пользователя
export async function getUserAccessLevels(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(`
      SELECT al.* FROM access_levels al
      JOIN user_access_levels ual ON ual.access_level_id = al.id
      WHERE ual.user_id = $1
      ORDER BY al.priority ASC
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting user access levels:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Добавить уровень доступа пользователю
export async function addUserAccessLevel(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const { userId } = req.params;
    const accessLevelId =
      (req.body as { accessLevelId?: string; levelId?: string }).accessLevelId ??
      (req.body as { accessLevelId?: string; levelId?: string }).levelId;

    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1 AND is_deleted = false', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (!accessLevelId) {
      return res.status(400).json({ message: 'Требуется accessLevelId или levelId' });
    }

    const levelCheck = await pool.query('SELECT id FROM access_levels WHERE id = $1', [accessLevelId]);
    if (levelCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Уровень доступа не найден' });
    }
    
    await pool.query(
      `INSERT INTO user_access_levels (id, user_id, access_level_id)
       VALUES (gen_random_uuid(), $1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, accessLevelId]
    );
    
    res.status(201).json({ message: 'Access level added to user' });
  } catch (error) {
    console.error('Error adding user access level:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Удалить уровень доступа пользователя
export async function removeUserAccessLevel(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const { userId, levelId } = req.params;
    
    await pool.query(
      'DELETE FROM user_access_levels WHERE user_id = $1 AND access_level_id = $2',
      [userId, levelId]
    );
    
    res.json({ message: 'Access level removed from user' });
  } catch (error) {
    console.error('Error removing user access level:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Удалить все уровни доступа пользователя
export async function removeAllUserAccessLevels(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const { userId } = req.params;
    await pool.query('DELETE FROM user_access_levels WHERE user_id = $1', [userId]);
    res.json({ message: 'All access levels removed' });
  } catch (error) {
    console.error('Remove all access levels error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}


// ============================================
// 🟢 ОБНОВЛЕНИЕ ДОЛЖНОСТИ ПОЛЬЗОВАТЕЛЯ (пункт 4)
// ============================================

export const updateUserPosition = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { id } = req.params;
    const { position_id } = req.body;

    // Проверяем существование пользователя
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    // Проверяем существование должности (если position_id не null)
    if (position_id) {
      const positionCheck = await pool.query(
        'SELECT id FROM positions WHERE id = $1 AND is_active = true',
        [position_id]
      );

      if (positionCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Должность не найдена или неактивна' });
      }
    }

    // Обновляем должность пользователя
    await pool.query(
      `UPDATE users SET position_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [position_id || null, id]
    );

    // Получаем обновленного пользователя с информацией о должности
    const userWithPosition = await pool.query(
      `SELECT u.id, u.fio, u.login, u.email, u.department, u.is_admin, u.is_active,
              u.position_id, p.name as position_name, p.importance as position_importance
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
       WHERE u.id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: userWithPosition.rows[0],
      message: position_id ? 'Должность назначена' : 'Должность снята'
    });
  } catch (error) {
    console.error('Error updating user position:', error);
    res.status(500).json({ success: false, message: 'Ошибка при обновлении должности пользователя' });
  }
};

/** Уникальные отделы из профилей пользователей и из материалов (required_departments JSONB). */
export async function getDistinctDepartments(req: AuthRequest, res: Response) {
  try {
    const { rows } = await pool.query(
      `
      SELECT DISTINCT name FROM (
        SELECT TRIM(u.department) AS name
        FROM users u
        WHERE u.department IS NOT NULL AND TRIM(u.department) <> ''
        UNION
        SELECT TRIM(elem) AS name
        FROM materials m,
        LATERAL jsonb_array_elements_text(COALESCE(m.required_departments, '[]'::jsonb)) AS elem
        WHERE TRIM(elem) <> ''
      ) t
      WHERE name IS NOT NULL AND name <> ''
      ORDER BY name ASC
      `
    );
    res.json(rows.map((r) => (r as { name: string }).name));
  } catch (error) {
    console.error('getDistinctDepartments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}


