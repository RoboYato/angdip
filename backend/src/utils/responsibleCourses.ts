/**
 * Условие «курс относится к ответственному пользователю $1»:
 * — ответственный за курс (UUID в responsible_leader);
 * — или на курсе есть опубликованная документация, где пользователь указан
 *   как ответственный за материал или за набор правил доступа.
 */
export const SQL_COURSE_WHERE_USER_IS_RESPONSIBLE = `
  c.status = 'published'
  AND (
    (
      NULLIF(trim(c.responsible_leader), '') IS NOT NULL
      AND trim(c.responsible_leader) ~ '^[0-9a-fA-F-]{36}$'
      AND trim(c.responsible_leader)::uuid = $1::uuid
    )
    OR EXISTS (
      SELECT 1
      FROM materials m
      LEFT JOIN material_access_rule_sets ars ON ars.material_id = m.id
      WHERE m.course_id = c.id
        AND m.material_type = 'documentation'
        AND m.status = 'published'
        AND (
          m.responsible_user_id = $1::uuid
          OR ars.responsible_user_id = $1::uuid
        )
    )
  )
`;
