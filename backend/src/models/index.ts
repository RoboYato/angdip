export interface User {
  id: string;
  fio: string;
  login: string;
  password_hash?: string;
  email?: string;
  // 🟢 НОВОЕ ПОЛЕ: связь с должностью
  position_id?: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

// 🟢 НОВЫЙ ИНТЕРФЕЙС: Position (Должность)
// ============================================
export interface Position {
  id: string;
  name: string;              // Наименование должности
  importance: number;        // Важность (0-100)
  description?: string;      // Описание должностных обязанностей
  is_active: boolean;        // Активна ли должность
  created_by?: string;       // Кто создал (ID пользователя)
  created_at: Date;
  updated_at: Date;
}

// 🟢 НОВЫЙ ИНТЕРФЕЙС: Position с дополнительной информацией
// ============================================
export interface PositionWithStats extends Position {
  users_count?: number;      // Количество пользователей с этой должностью
  materials_count?: number;  // Количество материалов, требующих эту должность
}

// ============================================
// 🟢 НОВЫЙ ИНТЕРФЕЙС: Создание/Обновление должности (без ID и дат)
// ============================================
export interface PositionInput {
  name: string;
  importance: number;
  description?: string;
  is_active?: boolean;
}

// ============================================
// 🟢 НОВЫЙ ИНТЕРФЕЙС: Фильтры для поиска должностей
// ============================================
export interface PositionFilters {
  search?: string;           // Поиск по названию
  min_importance?: number;   // Минимальная важность
  max_importance?: number;   // Максимальная важность
  is_active?: boolean;       // Активна/неактивна
  page?: number;             // Пагинация: страница
  limit?: number;            // Пагинация: лимит
}

// ============================================
// 🟢 НОВЫЙ ИНТЕРФЕЙС: Ответ API для пагинации
// ============================================
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ============================================
// 🟢 НОВЫЙ ИНТЕРФЕЙС: Проверка доступа по должности
// ============================================
export interface PositionAccessCheck {
  user_id: string;
  user_position_id?: string;
  user_position_name?: string;
  required_position_ids: string[];
  required_position_names: string[];
  has_access: boolean;
  access_reason?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AccessLevel {
  id: string;
  name: string;
  code: string;
  priority: number;
  description?: string;
  requires_password: boolean;
  created_at: Date;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  created_by: string;
  responsible_leader?: string;
  created_at: Date;
  updated_at: Date;
}

/** Набор условий ABAC для материала (OR между наборами). */
export interface MaterialAccessRuleSet {
  id?: string;
  material_id?: string;
  role?: string | null;
  classification?: string | null;
  position?: string | null;
  role_required: boolean;
  classification_required: boolean;
  position_required: boolean;
  sort_order?: number;
  responsible_user_id?: string | null;
}

export interface Material {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  content?: string;
  status: 'draft' | 'published' | 'archived';
  order_num: number;
  access_level_id?: string;
    // 🟢 НОВЫЕ ПОЛЯ для должностей
  required_positions?: string[];        // Текстовые названия должностей (deprecated)
  required_position_ids?: string[];     // ID должностей (новый способ)
  required_departments?: string[];      // Требуемые подразделения
   responsible_leader?: string;
  responsible_user_id?: string | null;
  password_expires_at?: string | Date | null;
  access_rule_sets?: MaterialAccessRuleSet[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message?: string | null;
  data?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string | Date;
}

export interface NotificationLogEntry {
  id: string;
  material_id: string;
  rule_set_id?: string | null;
  responsible_user_id: string;
  created_at: string | Date;
  days_before_deadline: number;
}

export interface MaterialAssignment {
  id: string;
  material_id: string;
  user_id: string;
  assigned_at: string | Date;
  first_opened_at?: string | Date | null;
  completed_at?: string | Date | null;
}

export interface File {
  id: string;
  material_id?: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  uploaded_by?: string;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string;
  material_id?: string;
  action: string;
  action_details?: any;
  ip_address?: string;
  created_at: Date;
}

export interface UserProgress {
  id: string;
  user_id: string;
  course_id: string;
  status: 'new' | 'in_progress' | 'completed';
  completed_materials: number;
  total_materials: number;
  last_accessed?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Test {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  test_type: 'single_choice' | 'multiple_choice' | 'text_input';
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface TestQuestion {
  id: string;
  test_id: string;
  question_text: string;
  question_type: string;
  order_num: number;
  created_at: Date;
}

export interface TestAnswer {
  id: string;
  question_id: string;
  answer_text?: string;
  is_correct: boolean;
  order_num: number;
  created_at: Date;
}

export interface UserTestResult {
  id: string;
  user_id: string;
  test_id: string;
  score: number;
  passed: boolean;
  completed_at: Date;
  created_at: Date;
}

export interface AuthRequest {
  login: string;
  password: string;
}

export interface JWTPayload {
  userId: string;
  login: string;
  isAdmin: boolean;
}


// ============================================
// 🟢 НОВЫЙ ИНТЕРФЕЙС: Расширенный пользователь с должностью
// ============================================
export interface UserWithPosition extends User {
  position_details?: Position;  // Детальная информация о должности
  position_name?: string;       // Название должности (для удобства)
  position_importance?: number; // Важность должности (для удобства)
}

// ============================================
// 🟢 НОВЫЙ ИНТЕРФЕЙС: Запрос на назначение должности пользователю
// ============================================
export interface AssignPositionRequest {
  user_id: string;
  position_id: string;
}

// ============================================
// 🟢 НОВЫЙ ИНТЕРФЕЙС: Ответ с проверкой доступа к материалу
// ============================================
export interface MaterialAccessCheckResponse {
  material_id: string;
  material_title: string;
  user_id: string;
  user_name: string;
  user_position?: string;
  has_access: boolean;
  access_denied_reason?: 'no_position' | 'position_mismatch' | 'department_mismatch' | 'role_mismatch' | 'no_direct_access';
  required_positions?: string[];
  required_departments?: string[];
  access_method?: 'admin' | 'direct' | 'role' | 'position' | 'department' | 'course';
}