import { pool } from '../db/connection';
import { AuditLog } from '../models';

export async function logAction(
  userId: string,
  action: string,
  materialId?: string,
  details?: any,
  ipAddress?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, material_id, action_details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, materialId, JSON.stringify(details || {}), ipAddress]
    );
  } catch (error) {
    console.error('Error logging action:', error);
  }
}

export async function getAuditLogs(
  materialId?: string,
  limit: number = 100,
  offset: number = 0
): Promise<AuditLog[]> {
  let query = 'SELECT * FROM audit_log';
  const params: any[] = [];

  if (materialId) {
    query += ' WHERE material_id = $1';
    params.push(materialId);
    params.push(limit);
    params.push(offset);
    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
  } else {
    params.push(limit);
    params.push(offset);
    query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
  }

  const result = await pool.query(query, params);
  return result.rows;
}
