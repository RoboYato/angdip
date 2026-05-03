import { pool } from './connection';

/** Выполняет DDL и глотает только «уже есть»; остальное пробрасывает. */
async function safeQuery(sql: string): Promise<void> {
  try {
    await pool.query(sql);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (
      /already exists|duplicate column|duplicate object|multiple primary keys/i.test(msg) ||
      /relation .* already exists/i.test(msg)
    ) {
      return;
    }
    throw e;
  }
}

/**
 * Гарантирует колонки/таблицы для документации, уведомлений и назначений
 * (прямые ALTER … IF NOT EXISTS без DO $$ — надёжнее на существующих БД).
 */
export async function ensureDocumentationSchema(): Promise<void> {
  await safeQuery(`
    CREATE TABLE IF NOT EXISTS material_access_rule_sets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      role VARCHAR(100),
      classification VARCHAR(50),
      "position" VARCHAR(255),
      role_required BOOLEAN NOT NULL DEFAULT false,
      classification_required BOOLEAN NOT NULL DEFAULT false,
      position_required BOOLEAN NOT NULL DEFAULT false,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await safeQuery(`
    CREATE INDEX IF NOT EXISTS idx_material_access_rule_sets_material_id
    ON material_access_rule_sets(material_id)
  `);

  await safeQuery(`
    ALTER TABLE material_access_rule_sets
    ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL
  `);

  await safeQuery(`
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ
  `);

  await safeQuery(`
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL
  `);

  await safeQuery(`
    UPDATE materials
    SET responsible_user_id = trim(responsible_leader)::uuid
    WHERE responsible_user_id IS NULL
      AND responsible_leader IS NOT NULL
      AND trim(responsible_leader) ~ '^[0-9a-fA-F-]{36}$'
  `);

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS material_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      first_opened_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      UNIQUE(material_id, user_id)
    )
  `);

  await safeQuery(`
    CREATE INDEX IF NOT EXISTS idx_material_assignments_material_id ON material_assignments(material_id)
  `);

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(100) NOT NULL,
      title VARCHAR(500) NOT NULL,
      message TEXT,
      data JSONB,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await safeQuery(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)
  `);

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS notification_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      rule_set_id UUID REFERENCES material_access_rule_sets(id) ON DELETE SET NULL,
      responsible_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      days_before_deadline INT NOT NULL
    )
  `);

  await safeQuery(`
    CREATE INDEX IF NOT EXISTS idx_notification_log_material ON notification_log(material_id)
  `);

  await safeQuery(`
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_classified BOOLEAN NOT NULL DEFAULT false
  `);
  await safeQuery(`
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS access_level_code VARCHAR(50)
  `);

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS material_references (
      id UUID PRIMARY KEY REFERENCES materials(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      access_level VARCHAR(100) NOT NULL,
      access_level_id UUID,
      course_id UUID,
      is_classified BOOLEAN NOT NULL DEFAULT true,
      material_type VARCHAR(50),
      status VARCHAR(50),
      order_num INT DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await safeQuery(`
    CREATE INDEX IF NOT EXISTS idx_material_references_access ON material_references(access_level, is_classified)
  `);

  await safeQuery(`
    ALTER TABLE material_access_rule_sets DROP CONSTRAINT IF EXISTS material_access_rule_sets_material_id_fkey
  `);
}
