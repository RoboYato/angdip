import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="admin-container">
      <nav class="sidebar">
        <div class="logo">LMS Admin</div>
        <ul class="menu">
          <li><a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">📊 Панель управления</a></li>
          <li><a routerLink="/admin/courses" routerLinkActive="active">📚 Курсы</a></li>
          <li><a routerLink="/admin/materials" routerLinkActive="active">📄 Материалы и документация</a></li>
          <li><a routerLink="/admin/positions">📋 Управление должностями</a></li>
          <li><a routerLink="/admin/users" routerLinkActive="active">👥 Пользователи</a></li>
          <li><a routerLink="/admin/progress" routerLinkActive="active">📈 Прогресс обучения</a></li>
          <li><a routerLink="/admin/tests" routerLinkActive="active">📝 Тестирование</a></li>
          <li><a routerLink="/admin/audit" routerLinkActive="active">🧾 Журнал аудита</a></li>
          <li class="logout"><a (click)="logout()">🚪 Выход</a></li>
        </ul>
      </nav>

      <div class="main-content">
        <header>
          <h1>Журнал аудита</h1>
          <p>История действий пользователей и доступа к материалам</p>
        </header>

        <div class="filters">
          <div class="filter-group">
            <label>Материал (ID)</label>
            <input type="text" [(ngModel)]="filters.materialId" placeholder="UUID материала">
          </div>
          <div class="filter-group">
            <label>Действие</label>
            <select [(ngModel)]="filters.action">
              <option value="">Все</option>
              <option value="material_view">Просмотр материала</option>
              <option value="material_created">Создание материала</option>
              <option value="material_updated">Обновление материала</option>
              <option value="material_deleted">Удаление материала</option>
              <option value="access_denied">Отказ в доступе</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Лимит</label>
            <select [(ngModel)]="filters.limit">
              <option [value]="50">50</option>
              <option [value]="100">100</option>
              <option [value]="200">200</option>
            </select>
          </div>
          <button class="btn btn-primary" (click)="loadLogs()">🔍 Применить</button>
        </div>

        <div class="table-wrapper" *ngIf="logs.length > 0; else emptyState">
          <table class="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Материал</th>
                <th>IP</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of logs">
                <td>{{ log.created_at | date:'dd.MM.yyyy HH:mm' }}</td>
                <td>
                  <div class="user">
                    <div class="login">{{ log.user_login || '-' }}</div>
                    <div class="fio">{{ log.user_fio || '' }}</div>
                  </div>
                </td>
                <td><span class="badge">{{ log.action }}</span></td>
                <td>
                  <div class="material">
                    <div class="title">{{ log.material_title || '-' }}</div>
                    <div class="id">{{ log.material_id || '' }}</div>
                  </div>
                </td>
                <td>{{ log.ip_address || '-' }}</td>
                <td class="details">
                  <pre>{{ log.action_details | json }}</pre>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #emptyState>
          <div class="empty">Нет записей аудита по заданным фильтрам</div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .admin-container { display: flex; height: 100vh; background: #f5f5f5; }
    .sidebar { width: 250px; background: #2c3e50; color: white; padding: 20px; }
    .logo { font-size: 20px; font-weight: bold; margin-bottom: 30px; text-align: center; }
    .menu { list-style: none; padding: 0; margin: 0; }
    .menu li { margin-bottom: 10px; }
    .menu a { display: block; padding: 12px; color: white; text-decoration: none; border-radius: 4px; }
    .menu a:hover, .menu a.active { background: #34495e; }
    .menu .logout a { background: #e74c3c; margin-top: 20px; }
    .main-content { flex: 1; padding: 30px; overflow-y: auto; }
    header { margin-bottom: 20px; }
    h1 { margin: 0 0 6px; color: #2c3e50; }
    .filters { display: grid; grid-template-columns: 1fr 1fr 120px 140px; gap: 12px; align-items: end; margin-bottom: 20px; }
    .filter-group label { display: block; margin-bottom: 6px; font-weight: 600; color: #555; }
    .filter-group input, .filter-group select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
    .btn { padding: 10px 14px; border: none; border-radius: 4px; cursor: pointer; }
    .btn-primary { background: #3498db; color: white; }
    .table-wrapper { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { padding: 12px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
    .table thead { background: #f5f5f5; }
    .badge { background: #ecf0f1; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .user .login { font-weight: 600; }
    .user .fio { font-size: 12px; color: #666; }
    .material .title { font-weight: 600; }
    .material .id { font-size: 11px; color: #888; }
    .details pre { margin: 0; max-width: 320px; white-space: pre-wrap; word-break: break-word; }
    .empty { background: white; padding: 30px; border-radius: 8px; text-align: center; color: #777; }
  `]
})
export class AdminAuditComponent implements OnInit {
  logs: any[] = [];
  filters = {
    materialId: '',
    action: '',
    limit: 100
  };

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.adminService
      .getAuditLogs(this.filters.materialId || undefined, this.filters.limit, 0, this.filters.action || undefined)
      .subscribe({
        next: (logs) => {
          this.logs = logs || [];
        },
        error: (error) => {
          console.error('Ошибка загрузки аудита:', error);
          this.logs = [];
        }
      });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
