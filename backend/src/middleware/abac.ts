import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { pool } from '../db/connection';
import {
  evaluateMaterialAbacAccess,
  type AccessRuleSetRow,
  type UserAccessRuleContext
} from '../services/accessRuleSets';
import { ensureMaterialAssignment } from '../services/materialAssignmentService';
import { fetchMaterialUnified } from '../services/materialMerge';

export interface ABACAttributes {
  userAttributes: {
    roles: string[];
    department?: string;
    position?: string;
  };
  resourceAttributes: {
    accessLevel: string;
    requiredRoles?: string[];
    requiredDepartments?: string[];
    requiredPositions?: string[];
  };
  environmentAttributes?: {
    time?: Date;
    ipAddress?: string;
  };
}

function mapRuleRow(row: Record<string, unknown>): AccessRuleSetRow {
  return {
    role: (row.role as string) ?? null,
    classification: (row.classification as string) ?? null,
    position: (row.position as string) ?? null,
    department: (row.department as string) ?? null,
    role_required: !!row.role_required,
    classification_required: !!row.classification_required,
    position_required: !!row.position_required,
    department_required: !!row.department_required,
    responsible_user_id: (row.responsible_user_id as string) ?? null,
    deadline: (row.deadline as string | Date | null | undefined) ?? null,
    access_password_hash: (row.access_password_hash as string) ?? null
  };
}

/**
 * ABAC (Attribute-Based Access Control) middleware
 * Проверяет доступ на основе атрибутов пользователя, ресурса и окружения
 */
export async function abacMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.user.isAdmin) {
      return next();
    }

    const materialId = req.params.id || req.body.materialId;
    if (!materialId) {
      return next();
    }

    const merged = await fetchMaterialUnified(materialId as string);
    if (!merged) {
      return res.status(404).json({ message: 'Материал не найден' });
    }

    const material = merged as Record<string, unknown>;
    const rawDept = material.required_departments;
    const rawPos = material.required_positions;
    const requiredDepartments: string[] = Array.isArray(rawDept)
      ? rawDept
      : typeof rawDept === 'string'
        ? rawDept
          ? JSON.parse(rawDept)
          : []
        : [];
    const requiredPositions: string[] = Array.isArray(rawPos)
      ? rawPos
      : typeof rawPos === 'string'
        ? rawPos
          ? JSON.parse(rawPos)
          : []
        : [];

    if (!material.access_level_code || material.access_level_code === 'PUBLIC') {
      return next();
    }

    const userRowResult = await pool.query(
      `SELECT u.position, u.department, u.position_id, p.name AS position_name,
              COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS role_names
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.id, u.position, u.department, u.position_id, p.name`,
      [req.user.userId]
    );

    if (userRowResult.rows.length === 0) {
      return res.status(403).json({ message: 'User not found' });
    }

    const ur = userRowResult.rows[0];
    const userAttributes = {
      roles: (ur.role_names as string[]) || [],
      department: ur.department,
      position: ur.position
    };

    const clearanceResult = await pool.query(
      `SELECT al.code
       FROM user_access_levels ual
       JOIN access_levels al ON al.id = ual.access_level_id
       WHERE ual.user_id = $1`,
      [req.user.userId]
    );
    const userAccessCodes = clearanceResult.rows.map((r) => r.code as string);

    const materialRolesResult = await pool.query(
      `SELECT r.name as role_name
       FROM material_roles mr
       JOIN roles r ON mr.role_id = r.id
       WHERE mr.material_id = $1`,
      [materialId]
    );
    const requiredRoles = materialRolesResult.rows.map((row) => row.role_name as string);

    const ruleSetsResult = await pool.query(
      `SELECT role, classification, "position" as position, department,
              role_required, classification_required, position_required, department_required,
              responsible_user_id, deadline, access_password_hash, sort_order
       FROM material_access_rule_sets
       WHERE material_id = $1
       ORDER BY sort_order ASC`,
      [materialId]
    );
    const accessRuleSets: AccessRuleSetRow[] = ruleSetsResult.rows.map(mapRuleRow);

    const directAccessResult = await pool.query(
      'SELECT 1 FROM material_users WHERE material_id = $1 AND user_id = $2',
      [materialId, req.user.userId]
    );
    const hasDirectAccess = directAccessResult.rows.length > 0;

    const userCtx: UserAccessRuleContext = {
      userId: req.user.userId,
      roles: userAttributes.roles,
      accessLevelCodes: userAccessCodes,
      department: userAttributes.department ?? null,
      positionText: userAttributes.position ?? null,
      positionId: ur.position_id ?? null,
      positionName: ur.position_name ?? null
    };

    let hasAccess: boolean;

    if (accessRuleSets.length > 0) {
      const ruleMatch = evaluateMaterialAbacAccess(userCtx, accessRuleSets, hasDirectAccess);
      const shortcutDeptD =
        !!userAttributes.department && userAttributes.department.endsWith('D');
      hasAccess = hasDirectAccess || shortcutDeptD || ruleMatch;
    } else {
      const abacAttributes: ABACAttributes = {
        userAttributes,
        resourceAttributes: {
          accessLevel: String(material.access_level_code ?? ''),
          requiredRoles,
          requiredDepartments: requiredDepartments.filter(Boolean),
          requiredPositions: requiredPositions.filter(Boolean)
        },
        environmentAttributes: {
          time: new Date(),
          ipAddress: req.ip
        }
      };
      hasAccess = await evaluateLegacyABACPolicy(abacAttributes, hasDirectAccess);
    }

    if (!hasAccess) {
      await pool.query(
        `INSERT INTO audit_log (id, user_id, action, material_id, action_details, ip_address)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [
          req.user.userId,
          'access_denied',
          materialId,
          JSON.stringify({
            reason: 'ABAC_policy_violation',
            mode: accessRuleSets.length > 0 ? 'access_rule_sets' : 'legacy',
            user_roles: userAttributes.roles,
            user_access_levels: userAccessCodes,
            required_roles: requiredRoles,
            access_level: material.access_level_code,
            user_department: userAttributes.department,
            user_position: userAttributes.position
          }),
          req.ip
        ]
      );

      return res.status(403).json({
        message: 'Доступ запрещён',
        details: {
          access_level: material.access_level_name,
          required_attributes: {
            roles: requiredRoles,
            departments: requiredDepartments,
            positions: requiredPositions,
            access_rule_sets: accessRuleSets.length,
            message:
              accessRuleSets.length > 0
                ? 'Не выполнены условия ни одного набора правил доступа (роль / гриф / должность).'
                : 'Недостаточно прав: требуются соответствующие роль, отдел и должность для доступа к материалу (ABAC)'
          }
        }
      });
    }

    await pool.query(
      `INSERT INTO audit_log (id, user_id, action, material_id, action_details, ip_address)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
      [
        req.user.userId,
        'access_granted',
        materialId,
        JSON.stringify({
          access_level: material.access_level_code,
          user_roles: userAttributes.roles,
          user_access_levels: userAccessCodes,
          user_department: userAttributes.department,
          user_position: userAttributes.position,
          mode: accessRuleSets.length > 0 ? 'access_rule_sets' : 'legacy'
        }),
        req.ip
      ]
    );

    if (material.material_type === 'documentation' && req.user?.userId) {
      ensureMaterialAssignment(materialId, req.user.userId).catch((err) =>
        console.warn('ensureMaterialAssignment (abac):', err)
      );
    }

    next();
  } catch (error) {
    console.error('ABAC middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Наследие: роль ∩ списка, отдел, должность, затем жёсткая лестница по грифу материала.
 */
async function evaluateLegacyABACPolicy(
  attributes: ABACAttributes,
  hasDirectAccess: boolean
): Promise<boolean> {
  const { userAttributes, resourceAttributes } = attributes;

  if (hasDirectAccess) {
    return true;
  }

  if (userAttributes.department && userAttributes.department.endsWith('D')) {
    return true;
  }

  const {
    requiredRoles = [],
    requiredDepartments = [],
    requiredPositions = [],
    accessLevel
  } = resourceAttributes;

  const hasRole =
    requiredRoles.length === 0 ||
    requiredRoles.some((r) => userAttributes.roles.includes(r));

  const departmentOk =
    requiredDepartments.length === 0 ||
    (userAttributes.department != null &&
      requiredDepartments.includes(userAttributes.department));

  const positionOk =
    requiredPositions.length === 0 ||
    (userAttributes.position != null && requiredPositions.includes(userAttributes.position));

  if (!hasRole || !departmentOk || !positionOk) {
    return false;
  }

  switch (accessLevel) {
    case 'PUBLIC':
    case 'INTERNAL':
      return true;
    case 'CONFIDENTIAL':
      return (
        userAttributes.roles.some((r) => ['manager', 'specialist', 'admin'].includes(r)) ||
        userAttributes.position === 'manager'
      );
    case 'SECRET':
      return (
        userAttributes.roles.some((r) => ['manager', 'admin'].includes(r)) ||
        userAttributes.position === 'senior_manager'
      );
    case 'TOP_SECRET':
      return (
        userAttributes.roles.includes('admin') || userAttributes.position === 'director'
      );
    default:
      return false;
  }
}

/**
 * Create ABAC policy for material access
 */
export async function createMaterialABACPolicy(
  materialId: string,
  policy: {
    requiredRoles?: string[];
    requiredDepartments?: string[];
    requiredPositions?: string[];
    allowedUsers?: string[];
  }
): Promise<void> {
  if (policy.requiredRoles) {
    for (const roleName of policy.requiredRoles) {
      const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);

      if (roleResult.rows.length > 0) {
        await pool.query(
          `INSERT INTO material_roles (id, material_id, role_id)
           VALUES (gen_random_uuid(), $1, $2)
           ON CONFLICT DO NOTHING`,
          [materialId, roleResult.rows[0].id]
        );
      }
    }
  }

  if (policy.allowedUsers) {
    for (const userId of policy.allowedUsers) {
      await pool.query(
        `INSERT INTO material_users (id, material_id, user_id)
         VALUES (gen_random_uuid(), $1, $2)
         ON CONFLICT DO NOTHING`,
        [materialId, userId]
      );
    }
  }
}
