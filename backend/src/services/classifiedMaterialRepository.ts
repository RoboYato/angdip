import { classifiedPool } from '../db/connection';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export type ClassifiedMaterialRow = {
  id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  content: string | null;
  encrypted_content: Buffer | null;
  encryption_key_id: string | null;
  status: string;
  order_num: number;
  material_type: string;
  access_level_id: string | null;
  required_departments: unknown;
  required_positions: unknown;
  access_password: string | null;
  password_expires_at: Date | null;
  responsible_user_id: string | null;
  responsible_leader: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export function isNonPublicAccessLevel(code: string | null | undefined): boolean {
  return !!code && code !== 'PUBLIC';
}

export async function insertClassifiedMaterial(
  row: Omit<ClassifiedMaterialRow, 'created_at' | 'updated_at'>,
  client: Pool = classifiedPool
): Promise<void> {
  await client.query(
    `INSERT INTO classified_materials (
      id, course_id, title, description, content, encrypted_content, encryption_key_id,
      status, order_num, material_type, access_level_id, required_departments, required_positions,
      access_password, password_expires_at, responsible_user_id, responsible_leader, created_by
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18
    )`,
    [
      row.id,
      row.course_id,
      row.title,
      row.description,
      row.content,
      row.encrypted_content,
      row.encryption_key_id,
      row.status,
      row.order_num,
      row.material_type,
      row.access_level_id,
      JSON.stringify(row.required_departments ?? []),
      JSON.stringify(row.required_positions ?? []),
      row.access_password,
      row.password_expires_at,
      row.responsible_user_id,
      row.responsible_leader,
      row.created_by
    ]
  );
}

export async function fetchClassifiedMaterialById(id: string, client: Pool = classifiedPool): Promise<ClassifiedMaterialRow | null> {
  const { rows } = await client.query(`SELECT * FROM classified_materials WHERE id = $1`, [id]);
  return rows.length ? (rows[0] as ClassifiedMaterialRow) : null;
}

export async function updateClassifiedMaterialPartial(
  id: string,
  fields: Partial<
    Pick<
      ClassifiedMaterialRow,
      | 'title'
      | 'description'
      | 'content'
      | 'encrypted_content'
      | 'encryption_key_id'
      | 'status'
      | 'material_type'
      | 'access_level_id'
      | 'course_id'
      | 'order_num'
      | 'required_departments'
      | 'required_positions'
      | 'access_password'
      | 'password_expires_at'
      | 'responsible_user_id'
      | 'responsible_leader'
    >
  >,
  client: Pool = classifiedPool
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const push = (col: string, v: unknown) => {
    sets.push(`${col} = $${i++}`);
    vals.push(v);
  };
  if (fields.title !== undefined) push('title', fields.title);
  if (fields.course_id !== undefined) push('course_id', fields.course_id);
  if (fields.order_num !== undefined) push('order_num', fields.order_num);
  if (fields.description !== undefined) push('description', fields.description);
  if (fields.content !== undefined) push('content', fields.content);
  if (fields.encrypted_content !== undefined) push('encrypted_content', fields.encrypted_content);
  if (fields.encryption_key_id !== undefined) push('encryption_key_id', fields.encryption_key_id);
  if (fields.status !== undefined) push('status', fields.status);
  if (fields.material_type !== undefined) push('material_type', fields.material_type);
  if (fields.access_level_id !== undefined) push('access_level_id', fields.access_level_id);
  if (fields.required_departments !== undefined) {
    push('required_departments', JSON.stringify(fields.required_departments ?? []));
  }
  if (fields.required_positions !== undefined) {
    push('required_positions', JSON.stringify(fields.required_positions ?? []));
  }
  if (fields.access_password !== undefined) push('access_password', fields.access_password);
  if (fields.password_expires_at !== undefined) push('password_expires_at', fields.password_expires_at);
  if (fields.responsible_user_id !== undefined) push('responsible_user_id', fields.responsible_user_id);
  if (fields.responsible_leader !== undefined) push('responsible_leader', fields.responsible_leader);
  if (!sets.length) {
    return;
  }
  sets.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  await client.query(`UPDATE classified_materials SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

export async function deleteClassifiedMaterial(id: string, client: Pool = classifiedPool): Promise<void> {
  await client.query(`DELETE FROM classified_materials WHERE id = $1`, [id]);
}

export async function logClassifiedMaterialAccess(
  materialId: string,
  userId: string | undefined,
  action: string,
  details: object,
  ip: string | undefined,
  client: Pool = classifiedPool
): Promise<void> {
  await client.query(
    `INSERT INTO material_access_log (id, material_id, user_id, action, details, ip_address)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
    [uuidv4(), materialId, userId || null, action, JSON.stringify(details), ip || null]
  );
}
