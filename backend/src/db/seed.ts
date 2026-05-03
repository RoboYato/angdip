import { pool } from './connection';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create Admin User
    let adminId = uuidv4();
    const adminPasswordHash = await bcrypt.hash('admin123', 10);

    const adminResult = await pool.query(
      `INSERT INTO users (id, fio, login, password_hash, email, is_admin, is_active)
       VALUES ($1, $2, $3, $4, $5, true, true)
       ON CONFLICT (login) DO UPDATE SET fio = EXCLUDED.fio, is_admin = true
       RETURNING id`,
      [adminId, 'Администратор', 'admin', adminPasswordHash, 'admin@lms.local']
    );
    adminId = adminResult.rows[0].id;
    console.log('✅ Admin user created');

    const testUsers = [
      { id: uuidv4(), fio: 'Иван Петров', login: 'ivan_petrov', email: 'ivan@test.local', position: 'руководитель', department: 'Отдел кадров' },
      { id: uuidv4(), fio: 'Мария Сидорова', login: 'maria_sidorova', email: 'maria@test.local', position: 'специалист', department: 'Бухгалтерия' },
      { id: uuidv4(), fio: 'Дмитрий Волков', login: 'dmitry_volkov', email: 'dmitry@test.local', position: 'менеджер', department: 'Отдел продаж' }
    ];

    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const passwordHash = await bcrypt.hash('password123', 10);
      const userResult = await pool.query(
        `INSERT INTO users (id, fio, login, password_hash, email, position, department, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (login) DO UPDATE SET login = EXCLUDED.login
         RETURNING id`,
        [user.id, user.fio, user.login, passwordHash, user.email, user.position, user.department]
      );
      testUsers[i].id = userResult.rows[0].id;
    }
    console.log('✅ Test users created');

    // Create Roles
    let adminRoleId = uuidv4();
    let managerRoleId = uuidv4();
    let employeeRoleId = uuidv4();
    let specialistRoleId = uuidv4();

    const roles = [
      { id: adminRoleId, name: 'admin', description: 'Администратор', isSystem: true },
      { id: managerRoleId, name: 'manager', description: 'Руководитель', isSystem: false },
      { id: employeeRoleId, name: 'employee', description: 'Сотрудник', isSystem: false },
      { id: specialistRoleId, name: 'specialist', description: 'Специалист', isSystem: false }
    ];

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const roleResult = await pool.query(
        `INSERT INTO roles (id, name, description, is_system)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_system = EXCLUDED.is_system
         RETURNING id`,
        [role.id, role.name, role.description, role.isSystem]
      );
      if (role.name === 'admin') adminRoleId = roleResult.rows[0].id;
      if (role.name === 'manager') managerRoleId = roleResult.rows[0].id;
      if (role.name === 'employee') employeeRoleId = roleResult.rows[0].id;
      if (role.name === 'specialist') specialistRoleId = roleResult.rows[0].id;
    }
    console.log('✅ Roles created');

    // Assign Roles to Users
    await pool.query(
      `INSERT INTO user_roles (id, user_id, role_id, is_from_aius)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), adminId, adminRoleId, false]
    );

    await pool.query(
      `INSERT INTO user_roles (id, user_id, role_id, is_from_aius)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), testUsers[0].id, managerRoleId, false]
    );

    await pool.query(
      `INSERT INTO user_roles (id, user_id, role_id, is_from_aius)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), testUsers[1].id, employeeRoleId, false]
    );

    await pool.query(
      `INSERT INTO user_roles (id, user_id, role_id, is_from_aius)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), testUsers[2].id, specialistRoleId, false]
    );

    console.log('✅ User roles assigned');

    const accessLevels = [
      { id: uuidv4(), name: 'Публичный', code: 'PUBLIC', priority: 1, requiresPassword: false },
      { id: uuidv4(), name: 'Внутренний', code: 'INTERNAL', priority: 2, requiresPassword: false },
      { id: uuidv4(), name: 'Конфиденциально', code: 'CONFIDENTIAL', priority: 3, requiresPassword: true },
      { id: uuidv4(), name: 'Секретно', code: 'SECRET', priority: 4, requiresPassword: true },
      { id: uuidv4(), name: 'Совершенно секретно', code: 'TOP_SECRET', priority: 5, requiresPassword: true }
    ];

    for (const level of accessLevels) {
      await pool.query(
        `INSERT INTO access_levels (id, name, code, priority, requires_password)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, priority = EXCLUDED.priority, requires_password = EXCLUDED.requires_password`,
        [level.id, level.name, level.code, level.priority, level.requiresPassword]
      );
    }
    console.log('✅ Access levels created');

    // Create Courses (больше курсов)
    const courses = [
      { id: uuidv4(), title: 'Базовые навыки', description: 'Курс для сотрудников: базовые навыки работы с системой документооборота АИУС "Сфера".', status: 'published' },
      { id: uuidv4(), title: 'Договорная деятельность', description: 'Автоматизация работы с договорами и кадровыми линиями в АИУС "СФЕРААЙТ".', status: 'published' },
      { id: uuidv4(), title: 'Управление проектами', description: 'Курс по управлению проектами в системе АИУС.', status: 'published' },
      { id: uuidv4(), title: 'Безопасность данных', description: 'Обучение основам безопасности при работе с конфиденциальными данными.', status: 'published' },
      { id: uuidv4(), title: 'Охрана труда', description: 'Требования по охране труда и безопасным условиям работы.', status: 'published' },
      { id: uuidv4(), title: 'Информационная безопасность', description: 'Политики ИБ, классификация информации, инциденты.', status: 'published' },
      { id: uuidv4(), title: 'Работа с договорами', description: 'Жизненный цикл договора: создание, согласование, учёт.', status: 'published' },
      { id: uuidv4(), title: 'Кадровое делопроизводство', description: 'Ведение кадровой документации и учёт персонала.', status: 'draft' }
    ];

    const courseIds: string[] = [];

    for (const course of courses) {
      courseIds.push(course.id);
      await pool.query(
        `INSERT INTO courses (id, title, description, status, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status`,
        [course.id, course.title, course.description, course.status, adminId]
      );
    }
    console.log('✅ Courses created');

    // Запись пользователей на курсы (course_users) — на все опубликованные
    for (const user of testUsers) {
      for (let i = 0; i < courseIds.length; i++) {
        const course = courses[i];
        if (course.status === 'published') {
          await pool.query(
            `INSERT INTO course_users (id, course_id, user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (course_id, user_id) DO NOTHING`,
            [uuidv4(), courseIds[i], user.id]
          );
        }
      }
    }
    console.log('✅ Пользователи записаны на курсы');

    // Assign courses to roles — все опубликованные курсы для ролей
    const roleIdsArray = [managerRoleId, employeeRoleId, specialistRoleId];
    for (let i = 0; i < courseIds.length; i++) {
      if (courses[i].status === 'published') {
        for (const roleId of roleIdsArray) {
          await pool.query(
            `INSERT INTO course_roles (id, course_id, role_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (course_id, role_id) DO NOTHING`,
            [uuidv4(), courseIds[i], roleId]
          );
        }
      }
    }
    console.log('✅ Course roles assigned');

    // Create Materials для курсов — у каждого курса минимум 2–3 материала для прохождения и прогресса
    const materials = [
      // Курс 0: Базовые навыки
      { id: uuidv4(), courseId: courseIds[0], title: 'Стартовая страница', description: 'Описание стартовой страницы и основные инструменты', content: '<h2>Добро пожаловать!</h2><p>Учебный материал по работе со стартовой страницей системы АИУС.</p>', status: 'published', orderNum: 1 },
      { id: uuidv4(), courseId: courseIds[0], title: 'Документооборот', description: 'Основные возможности системы управления документами', content: '<h2>Документооборот в АИУС</h2><p>Полный набор инструментов для управления документами.</p>', status: 'published', orderNum: 2 },
      { id: uuidv4(), courseId: courseIds[0], title: 'Согласования', description: 'Процесс согласования документов', content: '<h2>Процесс согласования</h2><p>Полный цикл согласования документов в системе.</p>', status: 'published', orderNum: 3 },
      // Курс 1: Договорная деятельность
      { id: uuidv4(), courseId: courseIds[1], title: 'Введение в договоры', description: 'Виды договоров и общий порядок работы', content: '<h2>Виды договоров</h2><p>Типы договоров, реквизиты и порядок регистрации.</p>', status: 'published', orderNum: 1 },
      { id: uuidv4(), courseId: courseIds[1], title: 'Согласование договоров', description: 'Маршруты согласования и сроки', content: '<h2>Согласование</h2><p>Настройка маршрутов и контроль сроков.</p>', status: 'published', orderNum: 2 },
      { id: uuidv4(), courseId: courseIds[1], title: 'Учёт и хранение договоров', description: 'Регистрация и архив договоров', content: '<h2>Учёт договоров</h2><p>Порядок регистрации и хранения договоров в системе.</p>', status: 'published', orderNum: 3 },
      // Курс 2: Управление проектами
      { id: uuidv4(), courseId: courseIds[2], title: 'Основы управления проектами', description: 'Цели, задачи, этапы проекта', content: '<h2>Управление проектами</h2><p>Планирование, контроль и закрытие проектов.</p>', status: 'published', orderNum: 1 },
      { id: uuidv4(), courseId: courseIds[2], title: 'Инструменты и отчётность', description: 'Дашборды и отчёты по проектам', content: '<h2>Инструменты</h2><p>Использование отчётов и дашбордов в АИУС.</p>', status: 'published', orderNum: 2 },
      { id: uuidv4(), courseId: courseIds[2], title: 'Контроль сроков и рисков', description: 'Методы контроля и управления рисками', content: '<h2>Контроль и риски</h2><p>Отслеживание сроков и работа с рисками проекта.</p>', status: 'published', orderNum: 3 },
      // Курс 3: Безопасность данных
      { id: uuidv4(), courseId: courseIds[3], title: 'Классификация информации', description: 'Грифы и требования к защите', content: '<h2>Классификация</h2><p>Уровни конфиденциальности и правила работы с данными.</p>', status: 'published', orderNum: 1 },
      { id: uuidv4(), courseId: courseIds[3], title: 'Обработка конфиденциальных данных', description: 'Правила работы с данными ограниченного доступа', content: '<h2>Обработка данных</h2><p>Требования к хранению, передаче и уничтожению данных.</p>', status: 'published', orderNum: 2 },
      { id: uuidv4(), courseId: courseIds[3], title: 'Инциденты информационной безопасности', description: 'Действия при утечке или нарушении', content: '<h2>Инциденты ИБ</h2><p>Порядок реагирования на инциденты и отчётность.</p>', status: 'published', orderNum: 3 },
      // Курс 4: Охрана труда
      { id: uuidv4(), courseId: courseIds[4], title: 'Нормативы по охране труда', description: 'Требования и инструкции', content: '<h2>Охрана труда</h2><p>Нормативная база и инструктажи.</p>', status: 'published', orderNum: 1 },
      { id: uuidv4(), courseId: courseIds[4], title: 'Инструктажи и допуск к работе', description: 'Виды инструктажей и порядок проведения', content: '<h2>Инструктажи</h2><p>Вводный, первичный, повторный инструктажи.</p>', status: 'published', orderNum: 2 },
      { id: uuidv4(), courseId: courseIds[4], title: 'Средства индивидуальной защиты', description: 'СИЗ и порядок их применения', content: '<h2>СИЗ</h2><p>Нормы выдачи и правила использования СИЗ.</p>', status: 'published', orderNum: 3 },
      // Курс 5: Информационная безопасность
      { id: uuidv4(), courseId: courseIds[5], title: 'Политика ИБ', description: 'Правила информационной безопасности', content: '<h2>Политика ИБ</h2><p>Требования к паролям, доступу и инцидентам.</p>', status: 'published', orderNum: 1 },
      { id: uuidv4(), courseId: courseIds[5], title: 'Пароли и доступы', description: 'Требования к паролям и управление доступом', content: '<h2>Пароли и доступы</h2><p>Сложность паролей, срок действия, многофакторная аутентификация.</p>', status: 'published', orderNum: 2 },
      { id: uuidv4(), courseId: courseIds[5], title: 'Реагирование на инциденты', description: 'Порядок действий при инциденте ИБ', content: '<h2>Реагирование</h2><p>Кого уведомлять и как фиксировать инцидент.</p>', status: 'published', orderNum: 3 },
      // Курс 6: Работа с договорами
      { id: uuidv4(), courseId: courseIds[6], title: 'Жизненный цикл договора', description: 'От создания до архива', content: '<h2>Жизненный цикл</h2><p>Этапы: создание, согласование, подписание, учёт, исполнение, архив.</p>', status: 'published', orderNum: 1 },
      { id: uuidv4(), courseId: courseIds[6], title: 'Создание и регистрация договоров', description: 'Шаблоны и реквизиты договоров', content: '<h2>Создание договоров</h2><p>Заполнение реквизитов и привязка к контрагентам.</p>', status: 'published', orderNum: 2 },
      { id: uuidv4(), courseId: courseIds[6], title: 'Согласование и подписание', description: 'Маршруты согласования и ЭП', content: '<h2>Согласование и подписание</h2><p>Настройка маршрутов и использование электронной подписи.</p>', status: 'published', orderNum: 3 },
      // Курс 7: Кадровое делопроизводство (draft — материалы всё равно добавляем для админа)
      { id: uuidv4(), courseId: courseIds[7], title: 'Кадровая документация', description: 'Виды кадровых документов', content: '<h2>Кадровые документы</h2><p>Трудовые договоры, приказы, личные карточки.</p>', status: 'published', orderNum: 1 },
      { id: uuidv4(), courseId: courseIds[7], title: 'Учёт персонала', description: 'Учёт и отчётность по персоналу', content: '<h2>Учёт персонала</h2><p>Ведение учёта сотрудников и формирование отчётов.</p>', status: 'published', orderNum: 2 }
    ];

    for (const material of materials) {
      await pool.query(
        `INSERT INTO materials (id, course_id, title, description, content, status, order_num, material_type, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'learning', $8)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, content = EXCLUDED.content, status = EXCLUDED.status`,
        [material.id, material.courseId, material.title, material.description, material.content, material.status, material.orderNum, adminId]
      );
    }
    console.log('✅ Materials created');

    // Assign materials to roles (все роли для всех материалов курсов)
    for (const material of materials) {
      for (const roleId of [employeeRoleId, specialistRoleId, managerRoleId]) {
        await pool.query(
          `INSERT INTO material_roles (id, material_id, role_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (material_id, role_id) DO NOTHING`,
          [uuidv4(), material.id, roleId]
        );
      }
    }
    console.log('✅ Material roles assigned');

    // Документация (material_type = 'documentation', course_id = null)
    const publicLevelResult = await pool.query(
      "SELECT id FROM access_levels WHERE code = 'PUBLIC' LIMIT 1"
    );
    const publicLevelId = publicLevelResult.rows[0]?.id || null;

    const docIds = Array.from({ length: 10 }, () => uuidv4());
    const documentationMaterials = [
      { id: docIds[0], title: 'Руководство пользователя LMS', description: 'Инструкция по работе с системой: вход, курсы, прогресс.', content: '<h2>Руководство пользователя</h2><p>LMS позволяет проходить курсы, отслеживать прогресс и изучать документацию.</p><h3>Вход</h3><p>Используйте логин и пароль, выданные администратором.</p><h3>Курсы</h3><p>В разделе «Обучающие материалы» доступны курсы по вашим ролям.</p>', status: 'published', orderNum: 0 },
      { id: docIds[1], title: 'Правила работы с конфиденциальными данными', description: 'Требования к обработке информации с грифом ограничения доступа.', content: '<h2>Правила работы с конфиденциальными данными</h2><p>Материалы с грифом «Конфиденциально» и выше доступны только пользователям с соответствующими ролями и допуском.</p>', status: 'published', orderNum: 1 },
      { id: docIds[2], title: 'Часто задаваемые вопросы', description: 'Ответы на типичные вопросы по использованию системы.', content: '<h2>Часто задаваемые вопросы</h2><h3>Как записаться на курс?</h3><p>Раздел «Обучающие материалы» → выберите курс → «Записаться на курс».</p><h3>Где смотреть прогресс?</h3><p>Раздел «Мой прогресс».</p>', status: 'published', orderNum: 2 },
      { id: docIds[3], title: 'Регламент согласований', description: 'Сроки и порядок согласования документов в системе.', content: '<h2>Регламент согласований</h2><p>Срок согласования — 3 рабочих дня. При необходимости срок продлевается по заявке.</p>', status: 'published', orderNum: 3 },
      { id: docIds[4], title: 'Глоссарий терминов', description: 'Основные термины и определения, используемые в LMS и АИУС.', content: '<h2>Глоссарий</h2><p><strong>LMS</strong> — система управления обучением.</p><p><strong>АИУС</strong> — автоматизированная информационно-управляющая система.</p><p><strong>Гриф</strong> — уровень конфиденциальности материала.</p>', status: 'published', orderNum: 4 },
      { id: docIds[5], title: 'Техническая поддержка', description: 'Контактные данные и порядок обращения в техподдержку.', content: '<h2>Техническая поддержка</h2><p>По вопросам работы системы обращайтесь: support@company.local, внутренний телефон 1234.</p>', status: 'published', orderNum: 5 },
      { id: docIds[6], title: 'Политика паролей', description: 'Требования к паролям и смена пароля.', content: '<h2>Политика паролей</h2><p>Пароль не менее 8 символов, рекомендуется комбинация букв и цифр. Меняйте пароль не реже раза в 90 дней.</p>', status: 'published', orderNum: 6 },
      { id: docIds[7], title: 'Роли и права доступа', description: 'Описание ролей в системе и прав доступа к материалам.', content: '<h2>Роли и права доступа</h2><p>Администратор — полный доступ. Руководитель, Специалист, Сотрудник — доступ к курсам и документации по назначенным ролям (ABAC).</p>', status: 'published', orderNum: 7 },
      { id: docIds[8], title: 'Архив документов', description: 'Порядок хранения и поиска архивных документов.', content: '<h2>Архив документов</h2><p>Документы со статусом «Архив» хранятся 5 лет. Поиск по реквизитам и дате.</p>', status: 'published', orderNum: 8 },
      { id: docIds[9], title: 'Обновления системы', description: 'График обновлений и уведомления пользователей.', content: '<h2>Обновления системы</h2><p>Плановые обновления — по воскресеньям с 02:00 до 06:00. О сбоях и изменениях сообщается по рассылке.</p>', status: 'published', orderNum: 9 }
    ];

    for (const doc of documentationMaterials) {
      await pool.query(
        `INSERT INTO materials (id, course_id, title, description, content, status, order_num, material_type, access_level_id, created_by)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, 'documentation', $7, $8)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, content = EXCLUDED.content, status = EXCLUDED.status`,
        [doc.id, doc.title, doc.description, doc.content, doc.status, doc.orderNum, publicLevelId, adminId]
      );
      for (const roleId of [employeeRoleId, specialistRoleId, managerRoleId]) {
        await pool.query(
          `INSERT INTO material_roles (id, material_id, role_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (material_id, role_id) DO NOTHING`,
          [uuidv4(), doc.id, roleId]
        );
      }
    }
    console.log('✅ Документация создана');

    // Create Tests
    const test1Id = uuidv4();
    const test2Id = uuidv4();

    await pool.query(
      `INSERT INTO tests (id, course_id, title, description, test_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [test1Id, courseIds[0], 'Тест по документообороту', 'Проверка знаний документооборота', 'multiple_choice', adminId]
    );

    await pool.query(
      `INSERT INTO tests (id, course_id, title, description, test_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [test2Id, courseIds[1], 'Тест по договорной деятельности', 'Проверка знаний договорной деятельности', 'single_choice', adminId]
    );

    console.log('✅ Tests created');

    // Create Questions for Test 1
    const q1Id = uuidv4();
    const q2Id = uuidv4();

    await pool.query(
      `INSERT INTO test_questions (id, test_id, question_text, question_type, order_num)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [q1Id, test1Id, 'Какие основные функции документооборота?', 'multiple_choice', 1]
    );

    await pool.query(
      `INSERT INTO test_questions (id, test_id, question_text, question_type, order_num)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [q2Id, test1Id, 'Что такое согласование документов?', 'text_input', 2]
    );

    console.log('✅ Questions created');

    // Create Answers for Questions
    const answers = [
      { id: uuidv4(), questionId: q1Id, text: 'Создание документов', isCorrect: true, orderNum: 1 },
      { id: uuidv4(), questionId: q1Id, text: 'Согласование документов', isCorrect: true, orderNum: 2 },
      { id: uuidv4(), questionId: q1Id, text: 'Архивирование документов', isCorrect: true, orderNum: 3 },
      { id: uuidv4(), questionId: q1Id, text: 'Удаление документов', isCorrect: false, orderNum: 4 }
    ];

    for (const answer of answers) {
      await pool.query(
        `INSERT INTO test_answers (id, question_id, answer_text, is_correct, order_num)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [answer.id, answer.questionId, answer.text, answer.isCorrect, answer.orderNum]
      );
    }

    console.log('✅ Answers created');

    // Create User Progress (для всех опубликованных курсов)
    for (const user of testUsers) {
      for (let i = 0; i < courseIds.length; i++) {
        if (courses[i].status === 'published') {
          const totalForCourse = materials.filter(m => m.courseId === courseIds[i]).length || 1;
          await pool.query(
            `INSERT INTO user_progress (id, user_id, course_id, status, completed_materials, total_materials)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, course_id) DO UPDATE SET total_materials = EXCLUDED.total_materials`,
            [uuidv4(), user.id, courseIds[i], 'in_progress', 0, totalForCourse]
          );
        }
      }
    }

    console.log('✅ User progress created');

    console.log('\n✨ Database seeding completed successfully!');
    console.log('\n📊 Test Accounts:');
    console.log('Admin:');
    console.log('  Login: admin');
    console.log('  Password: admin123');
    console.log('\nManager:');
    console.log('  Login: ivan_petrov');
    console.log('  Password: password123');
    console.log('\nEmployee:');
    console.log('  Login: maria_sidorova');
    console.log('  Password: password123');
    console.log('\nSpecialist:');
    console.log('  Login: dmitry_volkov');
    console.log('  Password: password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
