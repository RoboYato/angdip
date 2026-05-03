# Инструкция по запуску LMS системы

# Запуск уведомлений от админа отсюда
http://localhost:8888/responsible/dashboard

Перезапуск контейнеров
docker-compose down
docker-compose up -d --build

## 1. Запустите Docker Desktop вручную

Откройте приложение Docker Desktop на вашем Mac.
Подождите, пока Docker полностью запустится (иконка в строке меню станет активной).

## 2. Очистка Docker (если нужно)

```bash
cd /Users/shadownight/Desktop/angdip
docker-compose down -v
docker system prune -af --volumes
```

## 3. Сборка и запуск контейнеров

```bash
cd /Users/shadownight/Desktop/angdip
docker-compose up -d --build
```

## 4. Проверка статуса контейнеров

```bash
docker-compose ps
```

Должны работать 4 контейнера:
- lms_postgres (база данных)
- lms_backend (API сервер)
- lms_frontend (Angular приложение)
- lms_nginx (веб-сервер)

## 5. Проверка логов

Проверить логи backend (миграции и seeding):
```bash
docker-compose logs backend
```

Проверить логи всех сервисов:
```bash
docker-compose logs -f
```

## 6. Доступ к приложению

Откройте браузер и перейдите на:
**http://localhost:8888**

Nginx автоматически проксирует:
- `/` → Frontend (Angular)
- `/api/*` → Backend (Express API)

> **Примечание**: Если порт 80 занят другим приложением, используется порт 8888

## 7. Тестовые аккаунты

После запуска в БД будут созданы следующие пользователи:

- **Администратор**: 
  - Логин: `admin`
  - Пароль: `admin123`

- **Менеджер**: 
  - Логин: `ivan_petrov`
  - Пароль: `password123`

- **Сотрудник**: 
  - Логин: `maria_sidorova`
  - Пароль: `password123`

- **Специалист**: 
  - Логин: `dmitry_volkov`
  - Пароль: `password123`

## 8. Тестовые курсы

После seeding в БД будут созданы 4 курса:
1. Базовые навыки работы в АИУС
2. Договорная деятельность
3. Управление проектами
4. Безопасность данных

Каждый курс содержит материалы и тесты.

## 9. Остановка контейнеров

```bash
docker-compose down
```

Для удаления данных БД:
```bash
docker-compose down -v
```

## 10. Полная пересборка

Если нужно пересобрать с нуля:
```bash
docker-compose down -v
docker system prune -af --volumes
docker-compose up -d --build
```

## Архитектура

```
Браузер → http://localhost (порт 80)
    ↓
[NGINX] - проксирование запросов
    ↓
    ├── / → Frontend (порт 8080)
    └── /api/* → Backend (порт 3000)
                    ↓
              [PostgreSQL] (порт 5432)
```

## Структура БД

- **users** - пользователи системы
- **roles** - роли (admin, manager, employee, specialist)
- **access_levels** - уровни доступа (Public, Internal, Confidential, Secret, Top Secret)
- **courses** - курсы обучения
- **materials** - учебные материалы
- **tests** - тесты
- **test_questions** - вопросы тестов
- **test_answers** - варианты ответов
- **user_progress** - прогресс обучения пользователей
- **user_test_results** - результаты тестирования
- **audit_log** - журнал доступа к материалам
- **course_roles** - связь курсов и ролей
- **material_roles** - связь материалов и ролей

## API Endpoints

### Аутентификация
- POST `/api/auth/register` - регистрация
- POST `/api/auth/login` - авторизация
- GET `/api/auth/profile` - профиль пользователя

### Курсы (пользователь)
- GET `/api/courses` - список доступных курсов
- GET `/api/courses/:id` - детали курса
- GET `/api/courses/:id/materials/:materialId` - материал курса
- POST `/api/courses/progress` - обновить прогресс

### Материалы
- POST `/api/materials` - создать материал (admin)
- PUT `/api/materials/:id` - обновить материал (admin)
- DELETE `/api/materials/:id` - удалить материал (admin)

### Тесты
- GET `/api/tests/:id` - получить тест
- POST `/api/tests/:id/submit` - отправить ответы

### Админ панель
- GET `/api/admin/users` - список пользователей
- POST `/api/admin/courses` - создать курс
- PUT `/api/admin/courses/:id` - обновить курс
- DELETE `/api/admin/courses/:id` - удалить курс
- POST `/api/admin/courses/add-role` - добавить роль к курсу
- GET `/api/admin/roles` - список ролей
- POST `/api/admin/roles` - создать роль
