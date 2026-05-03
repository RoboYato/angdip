import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { encryptMaterialContent, decryptMaterialContent } from '../utils/encryption';
import { logAction } from '../utils/audit';
import bcrypt from 'bcryptjs';
import {
  insertClassifiedMaterial,
  deleteClassifiedMaterial,
  updateClassifiedMaterialPartial,
  isNonPublicAccessLevel
} from '../services/classifiedMaterialRepository';
import { fetchMaterialUnified } from '../services/materialMerge';

export type AccessRuleSetInput = {
  role?: string | null;
  classification?: string | null;
  position?: string | null;
  role_required?: boolean;
  classification_required?: boolean;
  position_required?: boolean;
  responsible_user_id?: string | null;
};

export async function replaceMaterialAccessRuleSets(
  materialId: string,
  sets: AccessRuleSetInput[] | undefined | null
): Promise<void> {
  await pool.query('DELETE FROM material_access_rule_sets WHERE material_id = $1', [materialId]);
  if (!sets || !sets.length) {
    return;
  }
  let sort = 0;
  for (const s of sets) {
    await pool.query(
      `INSERT INTO material_access_rule_sets (
        id, material_id, role, classification, "position",
        role_required, classification_required, position_required, sort_order, responsible_user_id
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        materialId,
        s.role || null,
        s.classification || null,
        s.position || null,
        !!s.role_required,
        !!s.classification_required,
        !!s.position_required,
        sort++,
        s.responsible_user_id || null
      ]
    );
  }
}

/** Ключ явно передан в JSON (в отличие от отсутствующего свойства после парсинга). */
function bodyHas(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function normalizeUuidOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value);
}

export async function getAllMaterials(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const materialsResult = await pool.query(
      `SELECT 
        m.id,
        m.title,
        m.description,
        m.content,
        m.status,
        m.order_num,
        m.material_type,
        m.required_departments,
        m.required_positions,
        m.created_at,
        m.updated_at,
        m.is_classified,
        c.title as course_title,
        c.id as course_id,
        al.code as access_level_code,
        al.name as access_level_name,
        al.priority as access_level_priority,
        (
          SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.sort_order), '[]'::json)
          FROM (
            SELECT mars.id, mars.role, mars.classification, mars."position" AS position,
                   mars.role_required, mars.classification_required, mars.position_required,
                   mars.sort_order, mars.responsible_user_id
            FROM material_access_rule_sets mars
            WHERE mars.material_id = m.id
          ) t
        ) AS access_rule_sets
       FROM materials m
       LEFT JOIN courses c ON m.course_id = c.id
       LEFT JOIN access_levels al ON m.access_level_id = al.id
       ORDER BY m.created_at DESC`
    );

    const rows = [...materialsResult.rows];
    if (rows.some((r) => r.is_classified === true)) {
      const { fetchClassifiedMaterialById } = await import('../services/classifiedMaterialRepository');
      for (const row of rows) {
        if (row.is_classified === true) {
          const c = await fetchClassifiedMaterialById(row.id);
          if (c) {
            row.description = c.description;
            row.content = c.content;
            row.required_departments = c.required_departments;
            row.required_positions = c.required_positions;
          }
        }
      }
    }

    res.json(rows);
  } catch (error) {
    console.error('Get all materials error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function createMaterial(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Требуются права администратора' });
    }

    const {
      courseId,
      course_id,
      title,
      description,
      content,
      status,
      accessLevelId,
      access_level_code,
      material_type = 'learning',
      required_departments = [],
      required_positions = [],
      access_password,
      access_rule_sets,
      password_expires_at,
      responsible_user_id,
      responsible_leader
    } = req.body;

    const resolvedCourseId = courseId || course_id;
    let resolvedAccessLevelId = accessLevelId;
    if (!resolvedAccessLevelId && access_level_code) {
      const al = await pool.query(
        'SELECT id FROM access_levels WHERE code = $1 LIMIT 1',
        [access_level_code]
      );
      if (al.rows.length > 0) resolvedAccessLevelId = al.rows[0].id;
    }

    if (!title) {
      return res.status(400).json({ message: 'Название обязательно' });
    }
    if (material_type === 'learning' && !resolvedCourseId) {
      return res.status(400).json({ message: 'Для обучающего материала нужен курс' });
    }

    const orderNum =
      resolvedCourseId != null
        ? (
            await pool.query(
              'SELECT COALESCE(MAX(order_num), 0) + 1 as n FROM materials WHERE course_id = $1',
              [resolvedCourseId]
            )
          ).rows[0]?.n ?? 1
        : 0;

    const materialId = uuidv4();

    let levelCode = 'PUBLIC';
    if (resolvedAccessLevelId) {
      const lc = await pool.query('SELECT code FROM access_levels WHERE id = $1', [resolvedAccessLevelId]);
      if (lc.rows.length > 0) {
        levelCode = lc.rows[0].code as string;
      }
    } else if (access_level_code) {
      levelCode = access_level_code;
    }

    let encryptedContent: Buffer | null = null;
    let encryptionKeyId: string | null = null;
    let finalContent: string | null = content ?? null;

    if ((resolvedAccessLevelId || access_level_code) && content) {
      const encryptionResult = await encryptMaterialContent(content, levelCode);
      if (encryptionResult) {
        encryptedContent = encryptionResult.encryptedData;
        encryptionKeyId = encryptionResult.keyId;
        finalContent = null;
      }
    }

    const reqDept = Array.isArray(required_departments) ? required_departments : [];
    const reqPos = Array.isArray(required_positions) ? required_positions : [];

    const hashedPassword = access_password ? await bcrypt.hash(access_password, 10) : null;

    const resolvedResponsibleId = responsible_user_id || null;
    const leaderVarchar =
      resolvedResponsibleId ||
      (typeof responsible_leader === 'string' && responsible_leader.trim()
        ? responsible_leader.trim()
        : null);

    let passwordExpiresAt: Date | null = null;
    if (password_expires_at != null && password_expires_at !== '') {
      const d = new Date(password_expires_at);
      if (!Number.isNaN(d.getTime())) {
        passwordExpiresAt = d;
      }
    }

    const useClassifiedStorage = isNonPublicAccessLevel(levelCode);
    let materialResult: { rows: any[] };

    if (useClassifiedStorage) {
      try {
        materialResult = await pool.query(
          `INSERT INTO materials (
            id, course_id, title, description, content, encrypted_content, encryption_key_id,
            status, order_num, material_type, access_level_id, required_departments, required_positions,
            created_by, access_password, password_expires_at, responsible_user_id, responsible_leader,
            is_classified, access_level_code
          ) VALUES ($1,$2,$3,$4,NULL,NULL,NULL,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,true,$16)
          RETURNING *`,
          [
            materialId,
            resolvedCourseId || null,
            title,
            null,
            status || 'draft',
            orderNum,
            material_type,
            resolvedAccessLevelId || null,
            JSON.stringify(reqDept),
            JSON.stringify(reqPos),
            req.user!.userId,
            hashedPassword,
            passwordExpiresAt,
            resolvedResponsibleId,
            leaderVarchar,
            levelCode
          ]
        );

        await pool.query(
          `INSERT INTO material_references (
            id, title, access_level, access_level_id, course_id, is_classified, material_type, status, order_num
          ) VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            access_level = EXCLUDED.access_level,
            access_level_id = EXCLUDED.access_level_id,
            course_id = EXCLUDED.course_id,
            material_type = EXCLUDED.material_type,
            status = EXCLUDED.status,
            order_num = EXCLUDED.order_num,
            updated_at = CURRENT_TIMESTAMP`,
          [
            materialId,
            title,
            levelCode,
            resolvedAccessLevelId || null,
            resolvedCourseId || null,
            material_type,
            status || 'draft',
            orderNum
          ]
        );

        await insertClassifiedMaterial({
          id: materialId,
          course_id: resolvedCourseId || null,
          title,
          description: (description as string) || null,
          content: finalContent,
          encrypted_content: encryptedContent,
          encryption_key_id: encryptionKeyId,
          status: (status as string) || 'draft',
          order_num: orderNum,
          material_type: material_type as string,
          access_level_id: (resolvedAccessLevelId as string) || null,
          required_departments: reqDept,
          required_positions: reqPos,
          access_password: hashedPassword,
          password_expires_at: passwordExpiresAt,
          responsible_user_id: resolvedResponsibleId,
          responsible_leader: leaderVarchar,
          created_by: req.user!.userId
        });
      } catch (e) {
        await deleteClassifiedMaterial(materialId).catch(() => {});
        await pool.query('DELETE FROM material_references WHERE id = $1', [materialId]).catch(() => {});
        await pool.query('DELETE FROM materials WHERE id = $1', [materialId]).catch(() => {});
        throw e;
      }
    } else {
      materialResult = await pool.query(
        `INSERT INTO materials (
          id, course_id, title, description, content, encrypted_content, encryption_key_id,
          status, order_num, material_type, access_level_id, required_departments, required_positions,
          created_by, access_password, password_expires_at, responsible_user_id, responsible_leader,
          is_classified, access_level_code
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,false,$19)
        RETURNING *`,
        [
          materialId,
          resolvedCourseId || null,
          title,
          description || null,
          finalContent,
          encryptedContent,
          encryptionKeyId,
          status || 'draft',
          orderNum,
          material_type,
          resolvedAccessLevelId || null,
          JSON.stringify(reqDept),
          JSON.stringify(reqPos),
          req.user!.userId,
          hashedPassword,
          passwordExpiresAt,
          resolvedResponsibleId,
          leaderVarchar,
          levelCode
        ]
      );
    }

    if (access_rule_sets !== undefined) {
      await replaceMaterialAccessRuleSets(materialId, access_rule_sets);
    }

    await logAction(
      req.user!.userId,
      'material_created',
      materialId,
      { title, material_type, course_id: resolvedCourseId || null, access_level_code: levelCode },
      req.ip
    );
    const merged = await fetchMaterialUnified(materialId);
    res.status(201).json(merged || materialResult.rows[0]);
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
}

/**
 * PATCH-семантика по полям: обновляем только ключи, явно присутствующие в req.body
 * (Object.hasOwn / hasOwnProperty), чтобы не затирать NULL-ом то, что клиент не прислал.
 *
 * Секретные материалы (is_classified): метаданные в `materials` (+ material_references),
 * тело и чувствительные поля — в `classified_materials` (classifiedPool).
 */
export async function updateMaterial(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Требуются права администратора' });
    }

    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    const ver = await pool.query(
      'SELECT id, is_classified, access_level_id, access_level_code FROM materials WHERE id = $1',
      [id]
    );
    if (ver.rows.length === 0) {
      return res.status(404).json({ message: 'Материал не найден' });
    }
    const isClass = ver.rows[0].is_classified === true;
    const currentLevelId = ver.rows[0].access_level_id as string | null;

    /** Итоговый access_level_id после применения тела запроса (для шифрования content). */
    let effectiveAccessLevelId = currentLevelId;

    if (bodyHas(body, 'access_level_id') || bodyHas(body, 'accessLevelId')) {
      const raw = bodyHas(body, 'access_level_id') ? body.access_level_id : body.accessLevelId;
      effectiveAccessLevelId = normalizeUuidOrNull(raw);
    } else if (bodyHas(body, 'access_level_code')) {
      const code = body.access_level_code;
      if (code === null || code === undefined || code === '') {
        effectiveAccessLevelId = null;
      } else {
        const al = await pool.query('SELECT id FROM access_levels WHERE code = $1 LIMIT 1', [String(code)]);
        effectiveAccessLevelId = al.rows.length > 0 ? (al.rows[0].id as string) : null;
      }
    }

    let effectiveLevelCode = (ver.rows[0].access_level_code as string | null) || 'PUBLIC';
    if (effectiveAccessLevelId) {
      const cr = await pool.query('SELECT code FROM access_levels WHERE id = $1', [effectiveAccessLevelId]);
      if (cr.rows.length) {
        effectiveLevelCode = cr.rows[0].code as string;
      }
    } else if (bodyHas(body, 'access_level_code') && body.access_level_code) {
      effectiveLevelCode = String(body.access_level_code);
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (bodyHas(body, 'title')) {
      updates.push(`title = $${idx++}`);
      values.push(body.title ?? null);
    }
    if (bodyHas(body, 'description') && !isClass) {
      updates.push(`description = $${idx++}`);
      values.push(body.description ?? null);
    }
    if (bodyHas(body, 'content') && !isClass) {
      updates.push(`content = $${idx++}`);
      values.push(body.content ?? null);
    }
    if (bodyHas(body, 'status')) {
      updates.push(`status = $${idx++}`);
      values.push(body.status ?? null);
    }

    const wantsAccessLevelId = bodyHas(body, 'access_level_id') || bodyHas(body, 'accessLevelId');
    const wantsAccessLevelCode = bodyHas(body, 'access_level_code');
    if (wantsAccessLevelId || wantsAccessLevelCode) {
      updates.push(`access_level_id = $${idx++}`);
      values.push(effectiveAccessLevelId);
      updates.push(`access_level_code = $${idx++}`);
      values.push(effectiveAccessLevelId ? effectiveLevelCode : null);
    }

    if (bodyHas(body, 'material_type')) {
      updates.push(`material_type = $${idx++}`);
      values.push(body.material_type ?? null);
    }
    if (bodyHas(body, 'course_id') || bodyHas(body, 'courseId')) {
      const cid = bodyHas(body, 'course_id') ? body.course_id : body.courseId;
      updates.push(`course_id = $${idx++}`);
      values.push(normalizeUuidOrNull(cid));
    }
    if (bodyHas(body, 'order_num')) {
      updates.push(`order_num = $${idx++}`);
      const n = body.order_num;
      values.push(typeof n === 'number' ? n : parseInt(String(n), 10) || 0);
    }

    if (bodyHas(body, 'required_departments')) {
      const rd = body.required_departments;
      updates.push(`required_departments = $${idx++}::jsonb`);
      values.push(JSON.stringify(Array.isArray(rd) ? rd : []));
    }
    if (bodyHas(body, 'required_positions')) {
      const rp = body.required_positions;
      updates.push(`required_positions = $${idx++}::jsonb`);
      values.push(JSON.stringify(Array.isArray(rp) ? rp : []));
    }

    if (bodyHas(body, 'access_password') && !isClass) {
      const ap = body.access_password;
      if (ap === '' || ap === null) {
        updates.push(`access_password = $${idx++}`);
        values.push(null);
      } else {
        updates.push(`access_password = $${idx++}`);
        values.push(await bcrypt.hash(String(ap), 10));
      }
    }
    if (bodyHas(body, 'password_expires_at')) {
      const pex = body.password_expires_at;
      updates.push(`password_expires_at = $${idx++}`);
      if (pex === '' || pex === null) {
        values.push(null);
      } else {
        const d = new Date(String(pex));
        values.push(Number.isNaN(d.getTime()) ? null : d);
      }
    }
    if (bodyHas(body, 'responsible_user_id')) {
      updates.push(`responsible_user_id = $${idx++}`);
      values.push(normalizeUuidOrNull(body.responsible_user_id));
    }
    if (bodyHas(body, 'responsible_leader')) {
      updates.push(`responsible_leader = $${idx++}`);
      const rl = body.responsible_leader;
      values.push(rl === null || rl === undefined || rl === '' ? null : String(rl));
    }

    let materialResult;
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      materialResult = await pool.query(
        `UPDATE materials SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (materialResult.rows.length === 0) {
        return res.status(404).json({ message: 'Материал не найден' });
      }
    } else {
      materialResult = await pool.query('SELECT * FROM materials WHERE id = $1', [id]);
      if (materialResult.rows.length === 0) {
        return res.status(404).json({ message: 'Материал не найден' });
      }
    }

    if (isClass) {
      const cPartial: Parameters<typeof updateClassifiedMaterialPartial>[1] = {};

      if (bodyHas(body, 'title')) {
        cPartial.title = (body.title as string) ?? '';
      }
      if (bodyHas(body, 'description')) {
        cPartial.description = (body.description as string) || null;
      }
      if (bodyHas(body, 'status')) {
        cPartial.status = (body.status as string) || 'draft';
      }
      if (bodyHas(body, 'material_type')) {
        cPartial.material_type = (body.material_type as string) || 'learning';
      }
      if (wantsAccessLevelId || wantsAccessLevelCode) {
        cPartial.access_level_id = effectiveAccessLevelId;
      }
      if (bodyHas(body, 'course_id') || bodyHas(body, 'courseId')) {
        const cid = bodyHas(body, 'course_id') ? body.course_id : body.courseId;
        cPartial.course_id = normalizeUuidOrNull(cid);
      }
      if (bodyHas(body, 'order_num')) {
        const n = body.order_num;
        cPartial.order_num = typeof n === 'number' ? n : parseInt(String(n), 10) || 0;
      }
      if (bodyHas(body, 'required_departments')) {
        const rd = body.required_departments;
        cPartial.required_departments = Array.isArray(rd) ? rd : [];
      }
      if (bodyHas(body, 'required_positions')) {
        const rp = body.required_positions;
        cPartial.required_positions = Array.isArray(rp) ? rp : [];
      }
      if (bodyHas(body, 'access_password')) {
        const ap = body.access_password;
        if (ap === '' || ap === null) {
          cPartial.access_password = null;
        } else {
          cPartial.access_password = await bcrypt.hash(String(ap), 10);
        }
      }
      if (bodyHas(body, 'password_expires_at')) {
        const pex = body.password_expires_at;
        if (pex === '' || pex === null) {
          cPartial.password_expires_at = null;
        } else {
          const d = new Date(String(pex));
          cPartial.password_expires_at = Number.isNaN(d.getTime()) ? null : d;
        }
      }
      if (bodyHas(body, 'responsible_user_id')) {
        cPartial.responsible_user_id = normalizeUuidOrNull(body.responsible_user_id);
      }
      if (bodyHas(body, 'responsible_leader')) {
        const rl = body.responsible_leader;
        cPartial.responsible_leader = rl === null || rl === undefined || rl === '' ? null : String(rl);
      }

      if (bodyHas(body, 'content')) {
        const content = body.content;
        if (content === null || content === '') {
          cPartial.content = null;
          cPartial.encrypted_content = null;
          cPartial.encryption_key_id = null;
        } else {
          const er = await encryptMaterialContent(String(content), effectiveLevelCode);
          if (er) {
            cPartial.content = null;
            cPartial.encrypted_content = er.encryptedData;
            cPartial.encryption_key_id = er.keyId;
          } else {
            cPartial.content = String(content);
            cPartial.encrypted_content = null;
            cPartial.encryption_key_id = null;
          }
        }
      }

      if (Object.keys(cPartial).length > 0) {
        try {
          await updateClassifiedMaterialPartial(id, cPartial);
          if (updates.length === 0) {
            await pool.query(`UPDATE materials SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
          }
        } catch (classifiedErr) {
          console.error('updateMaterial: classified_materials update failed', classifiedErr);
          throw classifiedErr;
        }
      }

      const refSets: string[] = [];
      const refVals: unknown[] = [];
      let ri = 1;
      if (bodyHas(body, 'title')) {
        refSets.push(`title = $${ri++}`);
        refVals.push(body.title ?? '');
      }
      if (bodyHas(body, 'status')) {
        refSets.push(`status = $${ri++}`);
        refVals.push(body.status ?? null);
      }
      if (bodyHas(body, 'material_type')) {
        refSets.push(`material_type = $${ri++}`);
        refVals.push(body.material_type ?? null);
      }
      if (bodyHas(body, 'course_id') || bodyHas(body, 'courseId')) {
        refSets.push(`course_id = $${ri++}`);
        refVals.push(normalizeUuidOrNull(bodyHas(body, 'course_id') ? body.course_id : body.courseId));
      }
      if (bodyHas(body, 'order_num')) {
        const n = body.order_num;
        refSets.push(`order_num = $${ri++}`);
        refVals.push(typeof n === 'number' ? n : parseInt(String(n), 10) || 0);
      }
      if (wantsAccessLevelId || wantsAccessLevelCode) {
        refSets.push(`access_level_id = $${ri++}`);
        refVals.push(effectiveAccessLevelId);
        refSets.push(`access_level = $${ri++}`);
        refVals.push(effectiveLevelCode);
      }
      if (refSets.length > 0) {
        refSets.push('updated_at = CURRENT_TIMESTAMP');
        refVals.push(id);
        try {
          await pool.query(
            `UPDATE material_references SET ${refSets.join(', ')} WHERE id = $${ri}`,
            refVals
          );
        } catch (refErr) {
          console.error('updateMaterial: material_references update failed', refErr);
        }
      }
    }

    if (bodyHas(body, 'access_rule_sets')) {
      await replaceMaterialAccessRuleSets(id, body.access_rule_sets as AccessRuleSetInput[] | null);
    }

    await logAction(
      req.user!.userId,
      'material_updated',
      id,
      {
        keys: Object.keys(body),
        had_content: bodyHas(body, 'content'),
        had_access_rule_sets: bodyHas(body, 'access_rule_sets')
      },
      req.ip
    );
    const out = await fetchMaterialUnified(id);
    res.json(out || materialResult.rows[0]);
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
}

export async function deleteMaterial(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    const meta = await pool.query('SELECT is_classified FROM materials WHERE id = $1', [id]);
    if (meta.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found' });
    }
    if (meta.rows[0].is_classified === true) {
      await deleteClassifiedMaterial(id).catch(() => {});
      await pool.query('DELETE FROM material_references WHERE id = $1', [id]).catch(() => {});
    }

    const materialResult = await pool.query(
      `DELETE FROM materials WHERE id = $1 RETURNING id`,
      [id]
    );

    if (materialResult.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found' });
    }
    await logAction(
      req.user!.userId,
      'material_deleted',
      id,
      { material_id: id },
      req.ip
    );
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/** Дедлайн ознакомления / срок пароля — после этой даты пароль не принимается. */
function isPasswordDeadlinePassed(passwordExpiresAt: unknown): boolean {
  if (passwordExpiresAt == null || passwordExpiresAt === '') {
    return false;
  }
  const t = new Date(passwordExpiresAt as string).getTime();
  if (Number.isNaN(t)) {
    return false;
  }
  return t < Date.now();
}

export async function downloadMaterialFile(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { fileId } = req.params;
    const fileRes = await pool.query(
      `SELECT f.id, f.filename, f.file_path, f.mime_type, f.material_id,
              m.course_id, m.material_type, m.status
       FROM files f
       INNER JOIN materials m ON m.id = f.material_id
       WHERE f.id = $1`,
      [fileId]
    );
    if (fileRes.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const f = fileRes.rows[0] as Record<string, unknown>;
    const uid = req.user.userId;
    const isAdmin = !!req.user.isAdmin;

    if (!isAdmin) {
      if (f.status !== 'published') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      const { rows: allowed } = await pool.query(
        `SELECT 1 FROM materials m WHERE m.id = $1 AND (
          EXISTS (SELECT 1 FROM material_users mu WHERE mu.material_id = m.id AND mu.user_id = $2)
          OR EXISTS (
            SELECT 1 FROM course_users cu
            WHERE cu.course_id = m.course_id AND cu.user_id = $2 AND m.course_id IS NOT NULL
          )
          OR EXISTS (
            SELECT 1 FROM course_roles cr
            JOIN user_roles ur ON ur.role_id = cr.role_id AND ur.user_id = $2
            WHERE cr.course_id = m.course_id AND m.course_id IS NOT NULL
          )
          OR (m.material_type = 'documentation' AND m.status = 'published')
        )`,
        [f.material_id, uid]
      );
      if (allowed.length === 0) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    const fp = String(f.file_path || '').replace(/^[/\\]+/, '');
    const abs = path.resolve(process.cwd(), fp);
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    if (!abs.startsWith(uploadsRoot)) {
      return res.status(400).json({ message: 'Invalid path' });
    }
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    const mime = (f.mime_type as string) || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(String(f.filename))}`
    );
    return res.sendFile(abs);
  } catch (error) {
    console.error('downloadMaterialFile:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function unlockMaterial(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Пароль обязателен' });
    }

    const materialRow = await fetchMaterialUnified(id);
    if (!materialRow) {
      return res.status(404).json({ message: 'Материал не найден' });
    }

    const material: any = { ...materialRow };

    if (!material.access_password) {
      return res.status(403).json({ message: 'Доступ по паролю не настроен для данного материала' });
    }

    if (isPasswordDeadlinePassed(material.password_expires_at)) {
      await logAction(req.user.userId, 'unlock_failed', id, { reason: 'password_expired' }, req.ip);
      return res.status(403).json({
        message: 'Срок действия доступа по паролю истёк. Обратитесь к администратору.',
        code: 'password_expired'
      });
    }

    const passwordMatch = await bcrypt.compare(password, material.access_password);
    if (!passwordMatch) {
      await logAction(req.user.userId, 'unlock_failed', id, { reason: 'wrong_password' }, req.ip);
      return res.status(403).json({ message: 'Неверный пароль' });
    }

    // Decrypt content if encrypted
    if (material.encrypted_content && material.encryption_key_id) {
      try {
        const decryptedContent = await decryptMaterialContent(
          material.encrypted_content,
          material.encryption_key_id
        );
        material.content = decryptedContent;
        delete material.encrypted_content;
        delete material.encryption_key_id;
      } catch {
        return res.status(500).json({ message: 'Ошибка расшифровки содержимого' });
      }
    }

    delete material.access_password;

    const filesResult = await pool.query(
      'SELECT id, filename, file_path, file_size, mime_type FROM files WHERE material_id = $1',
      [id]
    );

    await logAction(req.user.userId, 'unlock_success', id, { title: material.title }, req.ip);

    res.json({ ...material, files: filesResult.rows });
  } catch (error) {
    console.error('Unlock material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function addRoleToMaterial(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { materialId, roleId } = req.body;

    if (!materialId || !roleId) {
      return res.status(400).json({ message: 'Material ID and Role ID required' });
    }

    const relationId = uuidv4();

    await pool.query(
      `INSERT INTO material_roles (id, material_id, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [relationId, materialId, roleId]
    );

    res.status(201).json({ message: 'Role added to material' });
  } catch (error) {
    console.error('Add role to material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function removeRoleFromMaterial(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { materialId, roleId } = req.params;

    await pool.query(
      `DELETE FROM material_roles
       WHERE material_id = $1 AND role_id = $2`,
      [materialId, roleId]
    );

    res.json({ message: 'Role removed from material' });
  } catch (error) {
    console.error('Remove role from material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function addUserToMaterial(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { materialId, userId } = req.body;

    if (!materialId || !userId) {
      return res.status(400).json({ message: 'Material ID and User ID required' });
    }

    const relationId = uuidv4();

    await pool.query(
      `INSERT INTO material_users (id, material_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [relationId, materialId, userId]
    );

    res.status(201).json({ message: 'User added to material' });
  } catch (error) {
    console.error('Add user to material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function removeUserFromMaterial(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { materialId, userId } = req.params;

    await pool.query(
      `DELETE FROM material_users
       WHERE material_id = $1 AND user_id = $2`,
      [materialId, userId]
    );

    res.json({ message: 'User removed from material' });
  } catch (error) {
    console.error('Remove user from material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function uploadFile(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const { materialId } = req.body;

    if (!materialId) {
      return res.status(400).json({ message: 'Material ID required' });
    }

    const fileId = uuidv4();
    const filePath = `/uploads/${req.file.filename}`;

    const fileResult = await pool.query(
      `INSERT INTO files (id, material_id, filename, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [fileId, materialId, req.file.originalname, filePath, req.file.size, req.file.mimetype, req.user.userId]
    );

    res.status(201).json(fileResult.rows[0]);
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteFile(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    const fileResult = await pool.query(
      `DELETE FROM files WHERE id = $1 RETURNING file_path`,
      [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function uploadImage(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      // Удаляем некорректный файл
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Разрешены только изображения (JPEG, PNG, GIF, WebP, SVG)' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(201).json({ url: imageUrl });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function markAsCompleted(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id: materialId } = req.params;

    // Get the material and its course
    const materialResult = await pool.query(
      'SELECT * FROM materials WHERE id = $1',
      [materialId]
    );

    if (materialResult.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found' });
    }

    const material = materialResult.rows[0];
    const courseId = material.course_id;

    // Check if user is enrolled in the course
    const enrollmentResult = await pool.query(
      'SELECT * FROM course_users WHERE course_id = $1 AND user_id = $2',
      [courseId, req.user.userId]
    );

    if (enrollmentResult.rows.length === 0) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    // Mark material as completed
    await pool.query(
      `INSERT INTO material_completions (id, user_id, material_id, completed_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, material_id) 
       DO UPDATE SET completed_at = CURRENT_TIMESTAMP`,
      [uuidv4(), req.user.userId, materialId]
    );

    // Update course progress
    const totalMaterialsResult = await pool.query(
      'SELECT COUNT(*) as total FROM materials WHERE course_id = $1 AND status = $2',
      [courseId, 'published']
    );

    const completedMaterialsResult = await pool.query(
      `SELECT COUNT(*) as completed FROM material_completions mc
       JOIN materials m ON mc.material_id = m.id
       WHERE mc.user_id = $1 AND m.course_id = $2 AND m.status = 'published'`,
      [req.user.userId, courseId]
    );

    const totalMaterials = parseInt(totalMaterialsResult.rows[0].total);
    const completedMaterials = parseInt(completedMaterialsResult.rows[0].completed);
    const progressPercent = totalMaterials > 0 ? Math.round((completedMaterials / totalMaterials) * 100) : 0;

    // Update user progress
    await pool.query(
      `UPDATE user_progress 
       SET completed_materials = $1,
           total_materials = $2,
           status = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4 AND course_id = $5`,
      [completedMaterials, totalMaterials, progressPercent >= 100 ? 'completed' : 'in_progress', req.user.userId, courseId]
    );

    res.json({ 
      message: 'Material marked as completed',
      progress_percent: progressPercent,
      status: progressPercent >= 100 ? 'completed' : 'in_progress'
    });
  } catch (error) {
    console.error('Mark as completed error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обучающая документация: все опубликованные материалы с material_type = 'documentation' для любого авторизованного пользователя.
 */
export async function getDocumentation(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    const documentationResult = await pool.query(
      `SELECT m.id, m.title, m.description, m.created_at,
        al.name as access_level_name,
        al.code as access_level_code,
        al.priority as access_level_priority
       FROM materials m
       LEFT JOIN access_levels al ON m.access_level_id = al.id
       WHERE m.material_type = 'documentation'
         AND m.status = 'published'
       ORDER BY m.order_num ASC NULLS LAST, m.created_at DESC`,
      []
    );

    res.json(documentationResult.rows);
  } catch (error) {
    console.error('Get documentation error:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
}
