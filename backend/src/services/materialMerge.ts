import { pool } from '../db/connection';
import { fetchClassifiedMaterialById } from './classifiedMaterialRepository';

/** Объединяет строку из основной БД (materials) с телом секретного материала из classified_db. */
export async function fetchMaterialUnified(materialId: string): Promise<Record<string, unknown> | null> {
  const main = await pool.query(
    `SELECT m.*, al.code AS access_level_code, al.name AS access_level_name, al.requires_password
     FROM materials m
     LEFT JOIN access_levels al ON m.access_level_id = al.id
     WHERE m.id = $1`,
    [materialId]
  );
  if (main.rows.length === 0) {
    return null;
  }
  const row = main.rows[0] as Record<string, unknown>;
  if (row.is_classified === true) {
    const c = await fetchClassifiedMaterialById(materialId);
    if (c) {
      return {
        ...row,
        description: c.description ?? row.description,
        content: c.content ?? row.content,
        encrypted_content: c.encrypted_content ?? row.encrypted_content,
        encryption_key_id: c.encryption_key_id ?? row.encryption_key_id,
        access_password: c.access_password ?? row.access_password,
        password_expires_at: c.password_expires_at ?? row.password_expires_at,
        responsible_user_id: c.responsible_user_id ?? row.responsible_user_id,
        responsible_leader: c.responsible_leader ?? row.responsible_leader,
        required_departments: c.required_departments ?? row.required_departments,
        required_positions: c.required_positions ?? row.required_positions
      };
    }
  }
  return row;
}
