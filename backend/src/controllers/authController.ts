import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db/connection';
import { hashPassword, comparePassword, generateToken } from '../utils/security';
import { v4 as uuidv4 } from 'uuid';

/** Список ролей для выбора при регистрации (без admin) */
export async function getRolesForRegistration(req: AuthRequest, res: Response) {
  try {
    const result = await pool.query(
      `SELECT id, name, description FROM roles WHERE name != 'admin' ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
}

export async function register(req: AuthRequest, res: Response) {
  try {
    const { fio, login, password, email, roleId } = req.body;

    if (!fio || !login || !password) {
      return res.status(400).json({ message: 'Заполните обязательные поля: ФИО, логин, пароль' });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE login = $1',
      [login]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Пользователь с таким логином уже существует' });
    }

    const passwordHash = await hashPassword(password);
    const userId = uuidv4();

    await pool.query(
      `INSERT INTO users (id, fio, login, password_hash, email)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, fio, login, passwordHash, email || null]
    );

    if (roleId) {
      const roleCheck = await pool.query(
        "SELECT id FROM roles WHERE id = $1 AND name != 'admin'",
        [roleId]
      );
      if (roleCheck.rows.length > 0) {
        await pool.query(
          `INSERT INTO user_roles (id, user_id, role_id, is_from_aius)
           VALUES ($1, $2, $3, false)`,
          [uuidv4(), userId, roleId]
        );
      }
    }

    const token = generateToken({
      userId,
      login,
      isAdmin: false
    });

    res.status(201).json({ userId, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
}

export async function login(req: AuthRequest, res: Response) {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE login = $1 AND is_deleted = false',
      [login]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const passwordMatch = await comparePassword(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const rolesResult = await pool.query(
      `SELECT r.id, r.name, r.description
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );

    const isAdmin =
      user.is_admin === true ||
      rolesResult.rows.some((r: { name: string }) => r.name === 'admin');

    const token = generateToken({
      userId: user.id,
      login: user.login,
      isAdmin
    });

    res.json({
      userId: user.id,
      login: user.login,
      fio: user.fio,
      isAdmin,
      roles: rolesResult.rows,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userResult = await pool.query(
      'SELECT id, fio, login, email, is_active FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user roles
    const rolesResult = await pool.query(
      `SELECT r.* FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );

    res.json({
      ...user,
      roles: rolesResult.rows
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
