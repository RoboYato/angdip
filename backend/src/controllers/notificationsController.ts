import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db/connection';

export async function getMyNotifications(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const unreadOnly = req.query.unread_only === '1' || req.query.unread_only === 'true';
    const { rows } = await pool.query(
      `SELECT id, user_id, type, title, message, data, is_read, created_at
       FROM notifications
       WHERE user_id = $1
         ${unreadOnly ? 'AND is_read = false' : ''}
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.userId, limit]
    );
    res.json(rows);
  } catch (e) {
    console.error('getMyNotifications', e);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = false`,
      [req.user.userId]
    );
    res.json({ count: rows[0]?.c ?? 0 });
  } catch (e) {
    console.error('getUnreadCount', e);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function markNotificationRead(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, type, title, message, data, is_read, created_at`,
      [id, req.user.userId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Уведомление не найдено' });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error('markNotificationRead', e);
    res.status(500).json({ message: 'Internal server error' });
  }
}
