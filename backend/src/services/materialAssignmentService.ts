import { pool } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { userMatchesAccessRuleSet, type AccessRuleSetRow, type UserAccessRuleContext } from './accessRuleSets';

export type UserRowForRules = {
  id: string;
  department: string | null;
  position: string | null;
  position_id: string | null;
  position_name: string | null;
  role_names: string[];
  access_codes: string[];
};

export async function loadActiveUsersForRuleMatching(): Promise<UserRowForRules[]> {
  const { rows } = await pool.query(`
    SELECT u.id,
           u.department,
           u.position,
           u.position_id,
           p.name AS position_name,
           COALESCE(
             (SELECT array_agg(r.name ORDER BY r.name)
              FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id),
             ARRAY[]::text[]
           ) AS role_names,
           COALESCE(
             (SELECT array_agg(al.code ORDER BY al.code)
              FROM user_access_levels ual JOIN access_levels al ON al.id = ual.access_level_id WHERE ual.user_id = u.id),
             ARRAY[]::text[]
           ) AS access_codes
    FROM users u
    LEFT JOIN positions p ON p.id = u.position_id
    WHERE u.is_active = true AND (u.is_deleted = false OR u.is_deleted IS NULL)
  `);
  return rows.map((r) => ({
    id: r.id as string,
    department: (r.department as string | null) ?? null,
    position: r.position as string | null,
    position_id: r.position_id as string | null,
    position_name: r.position_name as string | null,
    role_names: Array.isArray(r.role_names) ? r.role_names : [],
    access_codes: Array.isArray(r.access_codes) ? r.access_codes : []
  }));
}

export function userRowToContext(row: UserRowForRules): UserAccessRuleContext {
  return {
    roles: row.role_names,
    accessLevelCodes: row.access_codes,
    department: row.department,
    positionText: row.position,
    positionId: row.position_id,
    positionName: row.position_name
  };
}

export function ruleDbRowToAccessRule(row: Record<string, unknown>): AccessRuleSetRow {
  return {
    role: (row.role as string) ?? null,
    classification: (row.classification as string) ?? null,
    position: (row.position as string) ?? null,
    department: (row.department as string) ?? null,
    role_required: !!row.role_required,
    classification_required: !!row.classification_required,
    position_required: !!row.position_required,
    department_required: !!row.department_required
  };
}

export function usersMatchingRuleSet(users: UserRowForRules[], rule: AccessRuleSetRow): UserRowForRules[] {
  return users.filter((u) => userMatchesAccessRuleSet(userRowToContext(u), rule));
}

export async function upsertMaterialAssignmentsForUsers(
  materialId: string,
  userIds: string[]
): Promise<void> {
  for (const userId of userIds) {
    await pool.query(
      `INSERT INTO material_assignments (id, material_id, user_id, assigned_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (material_id, user_id) DO NOTHING`,
      [uuidv4(), materialId, userId]
    );
  }
}

/**
 * Фиксирует факт доступа к материалу: создаёт строку назначения или проставляет
 * first_opened_at / completed_at один раз (повторные открытия не затирают даты).
 */
export async function ensureMaterialAssignment(materialId: string, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO material_assignments (id, material_id, user_id, assigned_at, first_opened_at, completed_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (material_id, user_id) DO UPDATE SET
       first_opened_at = COALESCE(material_assignments.first_opened_at, EXCLUDED.first_opened_at),
       completed_at = COALESCE(material_assignments.completed_at, EXCLUDED.completed_at)`,
    [uuidv4(), materialId, userId]
  );
}

export async function recordMaterialFirstOpened(materialId: string, userId: string): Promise<void> {
  return ensureMaterialAssignment(materialId, userId);
}
