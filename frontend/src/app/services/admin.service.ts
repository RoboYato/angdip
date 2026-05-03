import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = '/api/admin';

  constructor(private http: HttpClient) {}

  // Roles
  getRoles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/roles`);
  }

  createRole(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/roles`, data);
  }

  updateRole(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/roles/${id}`, data);
  }

  deleteRole(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/roles/${id}`);
  }

  // Access Levels
  getAccessLevels(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/access-levels`);
  }

  createAccessLevel(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/access-levels`, data);
  }

  updateAccessLevel(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/access-levels/${id}`, data);
  }

  deleteAccessLevel(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/access-levels/${id}`);
  }

  // Users
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  createUser(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, data);
  }

  updateUser(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${id}`, data);
  }

  deactivateUser(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${id}`);
  }

  assignRoleToUser(userId: string, roleId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/user-roles`, { userId, roleId });
  }

  removeRoleFromUser(userId: string, roleId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/user-roles/${userId}/${roleId}`);
  }

  removeAllUserAccessLevels(userId: number | string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}/access-levels`);
  }

  addUserAccessLevel(userId: number | string, levelId: number | string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/${userId}/access-levels`, { levelId });
  }

  /** Уникальные названия отделов (пользователи + материалы) для подсказок в формах */
  getDepartments(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/departments`);
  }

  getAuditLogs(materialId?: string, limit?: number, offset?: number, action?: string): Observable<any[]> {
    let url = `${this.apiUrl}/audit-logs`;
    const params = new URLSearchParams();
    if (materialId) params.append('materialId', materialId);
    if (action) params.append('action', action);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset?.toString() || '0');
    if (params.toString()) url += '?' + params.toString();
    return this.http.get<any[]>(url);
  }

  // Progress tracking
  getUserProgress(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user-progress`);
  }

  getUserMaterials(userId: string, courseId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user-progress/${userId}/${courseId}/materials`);
  }

  getUserTestAttempts(userId: string, courseId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user-progress/${userId}/${courseId}/test-attempts`);
  }

  // Courses
  getCourses(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/courses`);
  }

// ============================================
  // 🟢 ДОЛЖНОСТИ (POSITIONS) - добавлено
  // ============================================

  /**
   * Получить все активные должности
   */
  getPositions(): Observable<any> {
  return this.http.get<any>(`${this.apiUrl}/positions`);
}

  /**
   * Получить все должности (включая неактивные) - только для админа
   */
  getAllPositions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/positions/all`);
  }

  /**
   * Получить должность по ID
   */
  getPositionById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/positions/${id}`);
  }

  /**
   * Создать новую должность
   */
  createPosition(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/positions`, data);
  }

  /**
   * Обновить должность
   */
  updatePosition(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/positions/${id}`, data);
  }

  /**
   * Удалить должность
   */
  deletePosition(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/positions/${id}`);
  }

  /**
   * Поиск должностей по названию или описанию
   */
  searchPositions(query: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/positions/search/${query}`);
  }

  /**
   * Получить статистику по должностям
   */
  getPositionsStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/positions/stats`);
  }

  /**
   * Назначить должность пользователю
   */
  assignPositionToUser(userId: string, positionId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/positions/assign`, { userId, positionId });
  }

  /**
   * Получить пользователей по должности
   */
  getUsersByPosition(positionId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/positions/${positionId}/users`);
  }

    // 🟢 ДОБАВИТЬ ЭТОТ МЕТОД
  getResponsibleStatsDetailed(): Observable<any[]> {
    return this.http.get<any[]>('/api/admin/responsible-stats/detailed');
  }

  getResponsibleCourses(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}/responsible-courses`);
}
// Courses (Admin)
createCourse(data: any): Observable<any> {
  return this.http.post(`${this.apiUrl}/courses`, data);
}

updateCourse(id: string, data: any): Observable<any> {
  return this.http.put(`${this.apiUrl}/courses/${id}`, data);
}

deleteCourse(id: string): Observable<any> {
  return this.http.delete(`${this.apiUrl}/courses/${id}`);
}
getResponsibleProgress(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiUrl}/responsible-progress`);
}

  /** Ручной запуск генерации напоминаний по документации (для админов). `force: true` — без проверки календарного графика (удобно для теста). */
  runDocumentationNotifications(options?: { force?: boolean }): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/run`, { force: options?.force === true });
  }

  /** Документация, за которую текущий пользователь отвечает (материал или набор правил). */
  getResponsibleMaterials(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/responsible-materials`);
  }

  /** Сводка дашборда ответственного: материалы, назначения, статистика. */
  getResponsibleDocumentationDashboard(): Observable<any> {
    return this.http.get(`${this.apiUrl}/responsible-documentation-dashboard`);
  }

  /** Данные для печатного отчёта по сотруднику (материалы под ответственностью текущего пользователя). */
  getResponsibleReportForUser(userId: string): Observable<any> {
    return this.http.get<any>(`/api/responsible/report/user/${userId}`);
  }

  /** Сводный отчёт по прогрессу всех пользователей (только админ). */
  getOverallAdminReport(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/reports/overall`);
  }
}
