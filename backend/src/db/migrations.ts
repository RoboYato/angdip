import { pool } from './connection';
import { ensureDocumentationSchema } from './ensureDocumentationSchema';

/**
 * Однократно переносит связку material_roles + гриф материала + required_positions
 * в material_access_rule_sets (декартово произведение ролей и должностей, как в старом AND/OR ABAC).
 */
async function migrateLegacyMaterialAccessRuleSets(): Promise<void> {
  const { rows } = await pool.query(`
    SELECT m.id AS material_id,
      COALESCE(
        (SELECT json_agg(sub.name ORDER BY sub.name)
         FROM (
           SELECT r.name
           FROM material_roles mr
           JOIN roles r ON r.id = mr.role_id
           WHERE mr.material_id = m.id
         ) sub),
        '[]'::json
      ) AS roles_json,
      m.required_positions,
      al.code AS access_code
    FROM materials m
    LEFT JOIN access_levels al ON al.id = m.access_level_id
    WHERE NOT EXISTS (SELECT 1 FROM material_access_rule_sets x WHERE x.material_id = m.id)
  `);

  for (const row of rows) {
    const roles: string[] = Array.isArray(row.roles_json)
      ? row.roles_json
      : JSON.parse(JSON.stringify(row.roles_json || []));
    const rawPos = row.required_positions;
    const positions: string[] = Array.isArray(rawPos)
      ? rawPos
      : typeof rawPos === 'string'
        ? JSON.parse(rawPos || '[]')
        : [];
    const code: string | null = row.access_code || null;
    if (!code || code === 'PUBLIC') {
      continue;
    }

    const classReq = true;
    type Combo = { role: string | null; position: string | null };
    const combinations: Combo[] = [];
    if (roles.length === 0 && positions.length === 0) {
      combinations.push({ role: null, position: null });
    } else if (roles.length > 0 && positions.length === 0) {
      for (const r of roles) combinations.push({ role: r, position: null });
    } else if (roles.length === 0 && positions.length > 0) {
      for (const p of positions) combinations.push({ role: null, position: String(p) });
    } else {
      for (const r of roles) {
        for (const p of positions) combinations.push({ role: r, position: String(p) });
      }
    }

    let sort = 0;
    for (const c of combinations) {
      await pool.query(
        `INSERT INTO material_access_rule_sets (
          id, material_id, role, classification, "position",
          role_required, classification_required, position_required, sort_order
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          row.material_id,
          c.role,
          code,
          c.position,
          !!c.role,
          classReq,
          !!c.position,
          sort++
        ]
      );
    }
  }
}

export async function initDatabase() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fio VARCHAR(255) NOT NULL,
        login VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        position VARCHAR(100),
        department VARCHAR(100),
        is_admin BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Новая таблица: Positions (должности)
    ///////////////////////////////////////////////////
    await pool.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        importance INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
     // Добавляем индексы для positions
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_positions_name ON positions(name);
      CREATE INDEX IF NOT EXISTS idx_positions_importance ON positions(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_positions_is_active ON positions(is_active);
    `);

    // Добавляем триггер для updated_at в positions
    await pool.query(`
      DO $$ BEGIN
        CREATE TRIGGER update_positions_updated_at
          BEFORE UPDATE ON positions
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);
    /////////////////////////////////
    // Roles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Access Levels (Confidentiality)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS access_levels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(50) NOT NULL UNIQUE,
        priority INT NOT NULL,
        description TEXT,
        requires_password BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User Roles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        is_from_aius BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, role_id)
      )
    `);

// Courses
await pool.query(`
  CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_by UUID NOT NULL REFERENCES users(id),
    responsible_leader VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

    // Course Roles (which roles have access)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS course_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(course_id, role_id)
      )
    `);

    // Course Users (manual user access)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS course_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(course_id, user_id)
      )
    `);

// Добавляем поле responsible_leader в таблицу courses
await pool.query(`
  DO $$ BEGIN
    ALTER TABLE courses ADD COLUMN IF NOT EXISTS responsible_leader VARCHAR(255);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END $$;
`).catch(() => {});

// Добавляем индекс для быстрого поиска
await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_courses_responsible_leader ON courses(responsible_leader);
`).catch(() => {});

    // Ключи шифрования (для материалов с грифом)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_name VARCHAR(100) NOT NULL UNIQUE,
        encryption_key BYTEA NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Materials (course_id nullable для документации)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content TEXT,
        encrypted_content BYTEA,
        encryption_key_id UUID REFERENCES encryption_keys(id),
        status VARCHAR(50) DEFAULT 'draft',
        order_num INT DEFAULT 0,
        material_type VARCHAR(50) DEFAULT 'learning',
        access_level_id UUID REFERENCES access_levels(id),
        required_departments JSONB DEFAULT '[]',
        required_positions JSONB DEFAULT '[]',
        responsible_leader VARCHAR(255),  
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS responsible_leader VARCHAR(255);
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    `).catch(() => {});

    // Material Roles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(material_id, role_id)
      )
    `);

    // Material Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(material_id, user_id)
      )
    `);

    // Material Completions (прогресс по материалам)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_completions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, material_id)
      )
    `);

    // Files
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT,
        mime_type VARCHAR(100),
        uploaded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Audit Log
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        action_details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User Progress
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'new',
        completed_materials INT DEFAULT 0,
        total_materials INT DEFAULT 0,
        last_accessed TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
      )
    `);

    // Tests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        test_type VARCHAR(50),
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Test Questions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_type VARCHAR(50),
        order_num INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Test Answers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
        answer_text TEXT,
        is_correct BOOLEAN DEFAULT false,
        order_num INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User Test Results
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_test_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
        score INT,
        passed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

/////////////////////////////////
 // 🟢 НОВЫЙ КОД: Добавление position_id в users
    // ============================================
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `).catch(() => {});

    // 🟢 НОВЫЙ КОД: Индекс для position_id
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_position_id ON users(position_id);
    `).catch(() => {});

    // ============================================
    // 🟢 НОВЫЙ КОД: Миграция существующих должностей
    // ============================================
    await pool.query(`
      DO $$
      DECLARE
        pos_record RECORD;
        new_position_id UUID;
        pos_count INTEGER;
      BEGIN
        FOR pos_record IN 
          SELECT DISTINCT position 
          FROM users 
          WHERE position IS NOT NULL 
            AND position != ''
            AND position NOT IN (SELECT name FROM positions WHERE is_active = true)
        LOOP
          INSERT INTO positions (id, name, importance, description, created_at)
          VALUES (gen_random_uuid(), pos_record.position, 50, 'Автоматически перенесено из старых данных', CURRENT_TIMESTAMP)
          RETURNING id INTO new_position_id;
          
          UPDATE users 
          SET position_id = new_position_id 
          WHERE position = pos_record.position;
          
          GET DIAGNOSTICS pos_count = ROW_COUNT;
          RAISE NOTICE 'Migrated position "%" for % users', pos_record.position, pos_count;
        END LOOP;
      END $$;
    `).catch((error) => {
      console.warn('Position migration warning (non-critical):', error.message);
    });

        // Таблица связи пользователей и уровней доступа
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_access_levels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_level_id UUID NOT NULL REFERENCES access_levels(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, access_level_id)
  )
`);

    // ============================================
    // 🟢 НОВЫЙ КОД: Добавление стандартных должностей
    // ============================================
    await pool.query(`
      INSERT INTO positions (id, name, importance, description, is_active)
      VALUES 
        (gen_random_uuid(), 'Директор', 100, 'Высшее руководство компании', true),
        (gen_random_uuid(), 'Руководитель отдела', 80, 'Руководитель структурного подразделения', true),
        (gen_random_uuid(), 'Главный специалист', 70, 'Ведущий специалист с расширенными полномочиями', true),
        (gen_random_uuid(), 'Специалист', 50, 'Сотрудник с базовыми полномочиями', true),
        (gen_random_uuid(), 'Стажер', 20, 'Сотрудник на испытательном сроке', true),
        (gen_random_uuid(), 'Оператор', 30, 'Оператор системы', true)
      ON CONFLICT (name) DO NOTHING;
    `).catch(() => {});

    // ============================================
    // 🟢 НОВЫЙ КОД: Добавление required_position_ids в materials
    // ============================================
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS required_position_ids JSONB DEFAULT '[]';
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `).catch(() => {});

    // ============================================
    // 🟢 НОВЫЙ КОД: Функция проверки доступа по должностям
    // ============================================
    await pool.query(`
      CREATE OR REPLACE FUNCTION check_user_position_access(
        p_user_id UUID,
        p_required_position_ids JSONB
      )
      RETURNS BOOLEAN AS $$
      DECLARE
        v_user_position_id UUID;
        v_has_access BOOLEAN;
      BEGIN
        SELECT position_id INTO v_user_position_id
        FROM users
        WHERE id = p_user_id AND is_active = true AND is_deleted = false;
        
        IF v_user_position_id IS NULL THEN
          RETURN FALSE;
        END IF;
        
        IF p_required_position_ids IS NULL OR jsonb_array_length(p_required_position_ids) = 0 THEN
          RETURN TRUE;
        END IF;
        
        SELECT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(p_required_position_ids) AS req_pos_id
          WHERE req_pos_id::UUID = v_user_position_id
        ) INTO v_has_access;
        
        RETURN v_has_access;
      END;
      $$ LANGUAGE plpgsql;
    `).catch(() => {});



    // Добавление колонок в существующие таблицы (если уже были созданы ранее)
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100);
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `).catch(() => {});
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `).catch(() => {});
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_name VARCHAR(100) NOT NULL UNIQUE,
        encryption_key BYTEA NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS material_type VARCHAR(50) DEFAULT 'learning';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `).catch(() => {});
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS encrypted_content BYTEA;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `).catch(() => {});
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS encryption_key_id UUID;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `).catch(() => {});
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS required_departments JSONB DEFAULT '[]';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `).catch(() => {});
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE materials ADD COLUMN IF NOT EXISTS required_positions JSONB DEFAULT '[]';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_completions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, material_id)
      )
    `).catch(() => {});

    // Ensure course_id is nullable for documentation materials
    await pool.query(`
      ALTER TABLE materials ALTER COLUMN course_id DROP NOT NULL
    `).catch(() => {});

    // Clean up duplicate user_progress rows (keep latest per user+course)
    await pool.query(`
      DELETE FROM user_progress
      WHERE id NOT IN (
        SELECT DISTINCT ON (user_id, course_id) id
        FROM user_progress
        ORDER BY user_id, course_id, updated_at DESC
      )
    `).catch(() => {});

    // Add UNIQUE constraint on user_progress if not exists
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE user_progress ADD CONSTRAINT user_progress_user_course_unique UNIQUE (user_id, course_id);
      EXCEPTION WHEN duplicate_table THEN NULL;
               WHEN duplicate_object THEN NULL; END $$;
    `).catch(() => {});

    // Add access_password column to materials if not exists
    await pool.query(`
      ALTER TABLE materials ADD COLUMN IF NOT EXISTS access_password VARCHAR(255);
    `).catch(() => {});

    await ensureDocumentationSchema();

    await migrateLegacyMaterialAccessRuleSets().catch((e) => {
      console.warn('material_access_rule_sets data migration (non-critical):', (e as Error).message);
    });

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}


// Запуск миграций при импорте
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('✨ Database migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
