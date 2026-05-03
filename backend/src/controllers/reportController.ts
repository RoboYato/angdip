import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db/connection';

function docMaterialProgress(
  first: string | null | undefined,
  completed: string | null | undefined
): { status: string; progress_percent: number } {
  if (completed) {
    return { status: 'completed', progress_percent: 100 };
  }
  if (first) {
    return { status: 'in_progress', progress_percent: 50 };
  }
  return { status: 'not_started', progress_percent: 0 };
}

/**
 * Материалы, за которые отвечает пользователь $responsibleId:
 * materials.responsible_user_id, materials.responsible_leader (id или ФИО), наборы ABAC.
 */
function responsibleMaterialsCondition(responsibleParam: string): string {
  return `
    (
      m.responsible_user_id = ${responsibleParam}::uuid
      OR (
        m.responsible_leader IS NOT NULL
        AND (
          m.responsible_leader = ${responsibleParam}::text
          OR m.responsible_leader = (SELECT fio FROM users WHERE id = ${responsibleParam}::uuid LIMIT 1)
        )
      )
      OR EXISTS (
        SELECT 1 FROM material_access_rule_sets ars
        WHERE ars.material_id = m.id AND ars.responsible_user_id = ${responsibleParam}::uuid
      )
    )
  `;
}

/** Отчёт ответственного по одному сотруднику (только материалы под ответственностью текущего пользователя). */
export async function getResponsibleUserReport(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const responsibleId = req.user.userId;
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: 'userId required' });
    }

    const userRes = await pool.query(
      `SELECT id, fio, position, department, email, login
       FROM users WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)`,
      [userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userRes.rows[0] as Record<string, unknown>;

    const overlap = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM materials m
       WHERE m.status = 'published'
         AND (${responsibleMaterialsCondition('$2')})
         AND (
           EXISTS (SELECT 1 FROM material_assignments ma WHERE ma.material_id = m.id AND ma.user_id = $1::uuid)
           OR EXISTS (SELECT 1 FROM material_completions mc WHERE mc.material_id = m.id AND mc.user_id = $1::uuid)
           OR (m.course_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM course_users cu WHERE cu.user_id = $1::uuid AND cu.course_id = m.course_id
           ))
         )`,
      [userId, responsibleId]
    );
    if ((overlap.rows[0] as { n: number }).n < 1) {
      return res.status(403).json({
        message: 'Нет данных по этому сотруднику в зоне вашей ответственности'
      });
    }

    const matRes = await pool.query(
      `
      SELECT DISTINCT ON (m.id)
        m.id,
        m.title,
        m.material_type AS type,
        COALESCE(al.code, m.access_level_code, 'PUBLIC') AS access_level,
        m.course_id,
        c.title AS course_title,
        mc.completed_at AS learning_completed_at,
        ma.first_opened_at,
        ma.completed_at AS doc_completed_at,
        ma.assigned_at,
        (SELECT COUNT(*)::int FROM audit_log alog
         WHERE alog.material_id = m.id AND alog.user_id = $1::uuid
           AND alog.action IN ('material_viewed', 'unlock_success')) AS view_actions
      FROM materials m
      LEFT JOIN courses c ON c.id = m.course_id
      LEFT JOIN access_levels al ON al.id = m.access_level_id
      LEFT JOIN material_completions mc ON mc.material_id = m.id AND mc.user_id = $1::uuid
      LEFT JOIN material_assignments ma ON ma.material_id = m.id AND ma.user_id = $1::uuid
      WHERE m.status = 'published'
        AND (${responsibleMaterialsCondition('$2')})
      ORDER BY m.id
      `,
      [userId, responsibleId]
    );

    const materials: unknown[] = [];
    let completed = 0;
    let inProgress = 0;
    let sumProgress = 0;

    for (const row of matRes.rows) {
      const r = row as Record<string, unknown>;
      const isDoc = r.type === 'documentation';
      let status: string;
      let progress_percent: number;
      let first_opened_at: string | null = null;
      let completed_at: string | null = null;
      let updated_at: string | null = null;

      if (isDoc) {
        const d = docMaterialProgress(
          r.first_opened_at as string | null,
          r.doc_completed_at as string | null
        );
        status = d.status;
        progress_percent = d.progress_percent;
        first_opened_at = (r.first_opened_at as string) || null;
        completed_at = (r.doc_completed_at as string) || null;
        updated_at =
          (r.doc_completed_at as string) ||
          (r.first_opened_at as string) ||
          (r.assigned_at as string) ||
          null;
      } else {
        const done = !!r.learning_completed_at;
        status = done ? 'completed' : 'not_started';
        progress_percent = done ? 100 : 0;
        completed_at = (r.learning_completed_at as string) || null;
        updated_at = completed_at;
      }

      if (status === 'completed') {
        completed += 1;
      } else if (status === 'in_progress') {
        inProgress += 1;
      }
      sumProgress += progress_percent;

      materials.push({
        id: r.id,
        title: r.title,
        type: r.type,
        access_level: r.access_level,
        progress_percent,
        status,
        first_opened_at,
        updated_at,
        completed_at,
        course_title: r.course_title || null,
        view_actions: r.view_actions ?? 0
      });
    }

    const total = materials.length;
    const summary = {
      total,
      completed,
      in_progress: inProgress,
      not_started: total - completed - inProgress,
      average_progress: total > 0 ? Math.round(sumProgress / total) : 0
    };

    res.json({
      user: {
        id: user.id,
        fio: user.fio,
        position: user.position,
        department: user.department,
        email: user.email
      },
      materials,
      summary
    });
  } catch (error) {
    console.error('getResponsibleUserReport:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/** Сводный отчёт по прогрессу (только админ). */
export async function getOverallAdminReport(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const usersRes = await pool.query(
      `
      SELECT u.id, u.fio, u.position, u.department, u.email,
        COALESCE(
          (SELECT string_agg(r.name, ', ' ORDER BY r.name)
           FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id),
          ''
        ) AS roles
      FROM users u
      WHERE (u.is_deleted = false OR u.is_deleted IS NULL)
      ORDER BY u.fio
      `
    );

    const usersOut: unknown[] = [];
    let totalProgressSum = 0;
    let totalProgressRows = 0;
    let totalCompletedCourses = 0;

    for (const u of usersRes.rows) {
      const uid = (u as { id: string }).id;
      const upRes = await pool.query(
        `
        SELECT up.course_id, c.title AS course_title, up.status,
               up.completed_materials, up.total_materials, up.updated_at,
               CASE WHEN up.total_materials > 0
                 THEN ROUND((up.completed_materials::decimal / up.total_materials) * 100)::int
                 ELSE 0 END AS progress_percent
        FROM user_progress up
        JOIN courses c ON c.id = up.course_id
        WHERE up.user_id = $1
        ORDER BY c.title
        `,
        [uid]
      );

      const courses: unknown[] = [];
      for (const row of upRes.rows) {
        const cid = (row as { course_id: string }).course_id;
        totalProgressSum += Number((row as { progress_percent: number }).progress_percent) || 0;
        totalProgressRows += 1;
        if ((row as { status: string }).status === 'completed') {
          totalCompletedCourses += 1;
        }

        const matRes = await pool.query(
          `
          SELECT m.id, m.title, m.material_type,
                 CASE WHEN mc.completed_at IS NOT NULL THEN 100 ELSE 0 END AS progress_percent,
                 CASE WHEN mc.completed_at IS NOT NULL THEN 'completed' ELSE 'not_started' END AS status,
                 mc.completed_at
          FROM materials m
          LEFT JOIN material_completions mc ON mc.material_id = m.id AND mc.user_id = $2
          WHERE m.course_id = $1 AND m.status = 'published'
          ORDER BY m.order_num ASC NULLS LAST, m.title
          `,
          [cid, uid]
        );

        courses.push({
          course_id: cid,
          course_title: (row as { course_title: string }).course_title,
          progress_percent: (row as { progress_percent: number }).progress_percent,
          status: (row as { status: string }).status,
          updated_at: (row as { updated_at: string }).updated_at,
          materials: matRes.rows
        });
      }

      const courseProgressValues = upRes.rows.map(
        (r) => Number((r as { progress_percent: number }).progress_percent) || 0
      );
      const summary_per_user = {
        courses_count: upRes.rows.length,
        average_progress:
          courseProgressValues.length > 0
            ? Math.round(courseProgressValues.reduce((a, b) => a + b, 0) / courseProgressValues.length)
            : 0
      };

      usersOut.push({
        user: {
          id: uid,
          fio: (u as { fio: string }).fio,
          position: (u as { position: string }).position,
          department: (u as { department: string }).department,
          email: (u as { email: string }).email,
          roles: (u as { roles: string }).roles
        },
        courses,
        summary_per_user
      });
    }

    const activeUsers = usersRes.rows.length;
    const global_stats = {
      total_users: activeUsers,
      average_progress_all:
        totalProgressRows > 0 ? Math.round(totalProgressSum / totalProgressRows) : 0,
      total_completed_courses: totalCompletedCourses
    };

    res.json({
      generated_at: new Date().toISOString(),
      users: usersOut,
      global_stats
    });
  } catch (error) {
    console.error('getOverallAdminReport:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
