/**
 * Инициализация схемы секретной БД (classified_db).
 * Запуск: node dist/db/initClassifiedDb.js  или  ts-node src/db/initClassifiedDb.ts
 */
import dotenv from 'dotenv';
import { classifiedPool } from './connection';

dotenv.config();

async function init(): Promise<void> {
  await classifiedPool.query(`
    CREATE TABLE IF NOT EXISTS encryption_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key_name VARCHAR(100) NOT NULL,
      encryption_key BYTEA NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await classifiedPool.query(`
    CREATE INDEX IF NOT EXISTS idx_encryption_keys_name ON encryption_keys(key_name) WHERE is_active = true
  `);

  await classifiedPool.query(`
    CREATE TABLE IF NOT EXISTS classified_materials (
      id UUID PRIMARY KEY,
      course_id UUID,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      content TEXT,
      encrypted_content BYTEA,
      encryption_key_id UUID REFERENCES encryption_keys(id) ON DELETE SET NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      order_num INT NOT NULL DEFAULT 0,
      material_type VARCHAR(50) NOT NULL DEFAULT 'learning',
      access_level_id UUID,
      required_departments JSONB DEFAULT '[]',
      required_positions JSONB DEFAULT '[]',
      access_password VARCHAR(255),
      password_expires_at TIMESTAMPTZ,
      responsible_user_id UUID,
      responsible_leader VARCHAR(255),
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await classifiedPool.query(`
    CREATE TABLE IF NOT EXISTS material_access_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id UUID NOT NULL,
      user_id UUID,
      action VARCHAR(100) NOT NULL,
      details JSONB,
      ip_address VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await classifiedPool.query(`
    CREATE INDEX IF NOT EXISTS idx_material_access_log_material ON material_access_log(material_id, created_at DESC)
  `);

  console.log('Classified database schema ensured.');
}

if (require.main === module) {
  init()
    .then(() => {
      console.log('✓ initClassifiedDb done');
      process.exit(0);
    })
    .catch((e) => {
      console.error('initClassifiedDb failed:', e);
      process.exit(1);
    });
}

export { init as initClassifiedDatabase };
