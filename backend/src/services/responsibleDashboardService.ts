import { pool } from '../db/connection';
import {
  loadActiveUsersForRuleMatching,
  ruleDbRowToAccessRule,
  usersMatchingRuleSet,
  upsertMaterialAssignmentsForUsers
} from './materialAssignmentService';

export type ResponsibleDocAssignmentRow = {
  user_id: string;
  user_name: string;
  material_id: string;
  material_title: string;
  course_id: string | null;
  course_title: string | null;
  password_expires_at: string | null;
  first_opened_at: string | null;
  completed_at: string | null;
  assigned_at: string | null;
  progress_percent: number;
  status: 'completed' | 'in_progress' | 'not_started';
  updated_at: string | null;
};

export type ResponsibleDocMaterialRow = {
  id: string;
  title: string;
  course_id: string | null;
  course_title: string | null;
  password_expires_at: string | null;
};

export type ResponsibleDocumentationDashboard = {
  stats: {
    totalAssignments: number;
    completedAssignments: number;
    openedNotCompleted: number;
    averageProgressPercent: number;
    activeUsers: number;
  };
  materials: ResponsibleDocMaterialRow[];
  assignments: ResponsibleDocAssignmentRow[];
};

function rowStatus(
  first: string | null | undefined,
  completed: string | null | undefined
): 'completed' | 'in_progress' | 'not_started' {
  if (completed) {
    return 'completed';
  }
  if (first) {
    return 'in_progress';
  }
  return 'not_started';
}

function rowProgressPercent(status: 'completed' | 'in_progress' | 'not_started'): number {
  if (status === 'completed') {
    return 100;
  }
  if (status === 'in_progress') {
    return 50;
  }
  return 0;
}

/**
 * Дашборд ответственного: материалы документации и назначения подчинённых по ABAC-наборам.
 */
export async function getResponsibleDocumentationDashboard(
  responsibleUserId: string
): Promise<ResponsibleDocumentationDashboard> {
  const { rows: materialRows } = await pool.query(
    `
    SELECT DISTINCT ON (m.id)
      m.id,
      m.title,
      m.course_id,
      m.password_expires_at,
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
    ORDER BY m.id
    `,
    [responsibleUserId]
  );

  const users = await loadActiveUsersForRuleMatching();
  const assignments: ResponsibleDocAssignmentRow[] = [];

  for (const m of materialRows) {
    const materialId = m.id as string;
    const { rows: ruleRows } = await pool.query(
      `SELECT * FROM material_access_rule_sets WHERE material_id = $1 ORDER BY sort_order`,
      [materialId]
    );
    if (!ruleRows.length) {
      continue;
    }

    const obligated = new Set<string>();
    for (const ruleRow of ruleRows) {
      const rule = ruleDbRowToAccessRule(ruleRow);
      for (const u of usersMatchingRuleSet(users, rule)) {
        obligated.add(u.id);
      }
    }

    await upsertMaterialAssignmentsForUsers(materialId, [...obligated]);

    const { rows: maRows } = await pool.query(
      `
      SELECT ma.user_id, ma.first_opened_at, ma.completed_at, ma.assigned_at, u.fio AS user_name
      FROM material_assignments ma
      JOIN users u ON u.id = ma.user_id
      WHERE ma.material_id = $1
        AND (u.is_deleted = false OR u.is_deleted IS NULL)
      `,
      [materialId]
    );

    for (const ar of maRows) {
      const uid = ar.user_id as string;
      if (!obligated.has(uid)) {
        continue;
      }
      const st = rowStatus(ar.first_opened_at as string, ar.completed_at as string);
      const updated =
        (ar.completed_at as string) ||
        (ar.first_opened_at as string) ||
        (ar.assigned_at as string) ||
        null;
      assignments.push({
        user_id: uid,
        user_name: (ar.user_name as string) || uid,
        material_id: materialId,
        material_title: m.title as string,
        course_id: (m.course_id as string) || null,
        course_title: (m.course_title as string) || null,
        password_expires_at: (m.password_expires_at as string) || null,
        first_opened_at: (ar.first_opened_at as string) || null,
        completed_at: (ar.completed_at as string) || null,
        assigned_at: (ar.assigned_at as string) || null,
        progress_percent: rowProgressPercent(st),
        status: st,
        updated_at: updated
      });
    }
  }

  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.status === 'completed').length;
  const openedNotCompleted = assignments.filter((a) => a.status === 'in_progress').length;
  const sumProgress = assignments.reduce((s, a) => s + (a.progress_percent || 0), 0);
  const averageProgressPercent =
    totalAssignments > 0 ? Math.round(sumProgress / totalAssignments) : 0;
  const activeUsers = new Set(assignments.map((a) => a.user_id)).size;

  const materials: ResponsibleDocMaterialRow[] = materialRows.map((m) => ({
    id: m.id as string,
    title: m.title as string,
    course_id: (m.course_id as string) || null,
    course_title: (m.course_title as string) || null,
    password_expires_at: (m.password_expires_at as string) || null
  }));

  return {
    stats: {
      totalAssignments,
      completedAssignments,
      openedNotCompleted,
      averageProgressPercent,
      activeUsers
    },
    materials,
    assignments
  };
}
