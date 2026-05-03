import { pool } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { getNotificationSchedule } from './notificationSchedule';
import {
  loadActiveUsersForRuleMatching,
  ruleDbRowToAccessRule,
  usersMatchingRuleSet,
  upsertMaterialAssignmentsForUsers
} from './materialAssignmentService';

function calendarDaysUntil(from: Date, deadline: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  return Math.round((b - a) / 86400000);
}

async function reminderAlreadyLogged(
  materialId: string,
  ruleSetId: string | null,
  responsibleUserId: string,
  daysBefore: number
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM notification_log
     WHERE material_id = $1
       AND responsible_user_id = $2
       AND days_before_deadline = $3
       AND (rule_set_id IS NOT DISTINCT FROM $4::uuid)
       AND (created_at::date = CURRENT_DATE)`,
    [materialId, responsibleUserId, daysBefore, ruleSetId]
  );
  return rows.length > 0;
}

async function appendNotificationLog(
  materialId: string,
  ruleSetId: string | null,
  responsibleUserId: string,
  daysBefore: number
): Promise<void> {
  await pool.query(
    `INSERT INTO notification_log (id, material_id, rule_set_id, responsible_user_id, days_before_deadline)
     VALUES ($1, $2, $3, $4, $5)`,
    [uuidv4(), materialId, ruleSetId, responsibleUserId, daysBefore]
  );
}

export type ProcessDocumentationRemindersOptions = {
  /** Пропустить проверку календарного графика (для ручного теста из админки). */
  force?: boolean;
};

/**
 * Создаёт внутренние уведомления для ответственных по графику важности должности.
 */
export async function processDocumentationReminders(
  options?: ProcessDocumentationRemindersOptions
): Promise<{
  materialsChecked: number;
  notificationsCreated: number;
  publishedDocumentation: number;
  withDeadlineDateOnOrAfterToday: number;
}> {
  const force = options?.force === true;
  const now = new Date();
  const users = await loadActiveUsersForRuleMatching();

  const { rows: diag } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE material_type = 'documentation' AND status = 'published')::int AS pub_doc,
      COUNT(*) FILTER (
        WHERE material_type = 'documentation'
          AND status = 'published'
          AND password_expires_at IS NOT NULL
          AND (password_expires_at::date >= CURRENT_DATE)
      )::int AS with_deadline
    FROM materials
  `);

  const { rows: materials } = await pool.query(
    `SELECT m.id, m.title, m.password_expires_at, m.responsible_user_id, m.responsible_leader
     FROM materials m
     WHERE m.material_type = 'documentation'
       AND m.status = 'published'
       AND m.password_expires_at IS NOT NULL
       AND (m.password_expires_at::date >= CURRENT_DATE)`
  );

  let notificationsCreated = 0;

  for (const m of materials) {
    const materialId = m.id as string;
    const deadline = new Date(m.password_expires_at as string);
    const diffDays = calendarDaysUntil(now, deadline);
    if (diffDays < 0) {
      continue;
    }

    const { rows: rules } = await pool.query(
      `SELECT * FROM material_access_rule_sets WHERE material_id = $1 ORDER BY sort_order`,
      [materialId]
    );
    if (!rules.length) {
      continue;
    }

    const obligated = new Set<string>();
    for (const ruleRow of rules) {
      const rule = ruleDbRowToAccessRule(ruleRow);
      for (const u of usersMatchingRuleSet(users, rule)) {
        obligated.add(u.id);
      }
    }
    await upsertMaterialAssignmentsForUsers(materialId, [...obligated]);

    const { rows: assignments } = await pool.query(
      `SELECT user_id, first_opened_at FROM material_assignments WHERE material_id = $1`,
      [materialId]
    );
    const openMap = new Map<string, string | null>();
    for (const a of assignments) {
      openMap.set(a.user_id as string, (a.first_opened_at as string) || null);
    }

    const fallbackResponsible =
      (m.responsible_user_id as string) ||
      (typeof m.responsible_leader === 'string' && /^[0-9a-fA-F-]{36}$/.test(String(m.responsible_leader).trim())
        ? String(m.responsible_leader).trim()
        : null);

    for (const ruleRow of rules) {
      const rule = ruleDbRowToAccessRule(ruleRow);
      const ruleSetId = ruleRow.id as string;
      const responsibleUserId =
        (ruleRow.responsible_user_id as string) || fallbackResponsible || null;
      if (!responsibleUserId) {
        continue;
      }

      const matching = usersMatchingRuleSet(users, rule);
      const nonCompliant = matching.filter((u) => {
        const opened = openMap.get(u.id);
        return opened == null;
      });
      if (nonCompliant.length === 0) {
        continue;
      }

      const { rows: respRows } = await pool.query(
        `SELECT u.id, u.fio, p.importance
         FROM users u
         LEFT JOIN positions p ON p.id = u.position_id
         WHERE u.id = $1`,
        [responsibleUserId]
      );
      if (!respRows.length) {
        continue;
      }
      const importance = respRows[0].importance != null ? Number(respRows[0].importance) : null;
      const schedule = getNotificationSchedule(importance);
      if (!force && !schedule.includes(diffDays)) {
        continue;
      }

      if (await reminderAlreadyLogged(materialId, ruleSetId, responsibleUserId, diffDays)) {
        continue;
      }

      const nameRows = await pool.query(`SELECT fio FROM users WHERE id = ANY($1::uuid[])`, [
        nonCompliant.map((u) => u.id)
      ]);
      const names = nameRows.rows.map((r) => r.fio as string);
      const title = `Ознакомление с документацией: ${m.title as string}`;
      const daysPhrase =
        diffDays === 0
          ? 'Срок истекает сегодня'
          : `До срока (${deadline.toISOString().slice(0, 10)}) осталось ${diffDays} дн.`;
      const message = `${daysPhrase}. Сотрудники ещё не открыли материал:\n${names.join(', ')}`;

      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, message, data, is_read)
         VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [
          uuidv4(),
          responsibleUserId,
          'deadline_reminder',
          title,
          message,
          JSON.stringify({
            material_id: materialId,
            rule_set_id: ruleSetId,
            days_before_deadline: diffDays,
            pending_user_ids: nonCompliant.map((u) => u.id)
          })
        ]
      );
      await appendNotificationLog(materialId, ruleSetId, responsibleUserId, diffDays);
      notificationsCreated++;
    }
  }

  return {
    materialsChecked: materials.length,
    notificationsCreated,
    publishedDocumentation: diag[0]?.pub_doc ?? 0,
    withDeadlineDateOnOrAfterToday: diag[0]?.with_deadline ?? 0
  };
}
