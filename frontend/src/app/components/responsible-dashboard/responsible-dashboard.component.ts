import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { openPrintableReport, buildResponsibleReportBody } from '../../utils/print-report';

type DocDashboard = {
  stats: {
    totalAssignments: number;
    completedAssignments: number;
    openedNotCompleted: number;
    averageProgressPercent: number;
    activeUsers: number;
  };
  materials: Array<{
    id: string;
    title: string;
    course_id: string | null;
    course_title: string | null;
    password_expires_at: string | null;
  }>;
  assignments: Array<{
    user_id: string;
    user_name: string;
    material_id: string;
    material_title: string;
    course_id: string | null;
    course_title: string | null;
    password_expires_at: string | null;
    first_opened_at: string | null;
    completed_at: string | null;
    assigned_at: string | null;
    progress_percent: number;
    status: string;
    updated_at: string | null;
  }>;
};

@Component({
  selector: 'app-responsible-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="responsible-dashboard">
      <div class="breadcrumb">
        <a routerLink="/user">← Назад к обучению</a>
      </div>

      <h2>📊 Дашборд ответственного руководителя</h2>
      <p>Отслеживание прогресса по документации, где вы указаны ответственным</p>

      <div *ngIf="dashboardError" class="error-banner">{{ dashboardError }}</div>

      <div class="notifications-panel">
        <h3>🔔 Уведомления</h3>
        <p class="hint" *ngIf="authService.isAdmin()">
          <button type="button" class="btn btn-secondary btn-sm" (click)="runReminderJob()" [disabled]="reminderJobRunning">
            Запустить проверку напоминаний (админ, без графика)
          </button>
        </p>
        <div *ngIf="notificationsLoading" class="loading">Загрузка уведомлений…</div>
        <div *ngIf="!notificationsLoading && notifications.length === 0" class="no-data">Нет уведомлений</div>
        <ul class="notification-list" *ngIf="!notificationsLoading && notifications.length > 0">
          <li *ngFor="let n of notifications" [class.unread]="!n?.is_read">
            <div class="n-title">{{ n?.title }}</div>
            <div class="n-meta">{{ n?.created_at ? (n.created_at | date : 'dd.MM.yyyy HH:mm') : '—' }} · {{ n?.type || '' }}</div>
            <pre class="n-body">{{ n?.message }}</pre>
            <button type="button" class="btn btn-sm" *ngIf="!n?.is_read" (click)="markNotificationRead(n)">Отметить прочитанным</button>
          </li>
        </ul>
      </div>

      <div *ngIf="dashboardLoading" class="loading page-loading">Загрузка дашборда…</div>

      <ng-container *ngIf="!dashboardLoading && !dashboardError">
        <div class="stats-overview">
          <div class="stat-card">
            <h3>Всего назначений</h3>
            <p class="stat-number">{{ docDashboard?.stats?.totalAssignments ?? 0 }}</p>
          </div>
          <div class="stat-card">
            <h3>Завершено</h3>
            <p class="stat-number">{{ docDashboard?.stats?.completedAssignments ?? 0 }}</p>
          </div>
          <div class="stat-card">
            <h3>Средний прогресс</h3>
            <p class="stat-number">{{ docDashboard?.stats?.averageProgressPercent ?? 0 }}%</p>
          </div>
          <div class="stat-card">
            <h3>Сотрудников в охвате</h3>
            <p class="stat-number">{{ docDashboard?.stats?.activeUsers ?? 0 }}</p>
          </div>
        </div>

        <div class="progress-table-section">
          <h3>Детальный прогресс по документации</h3>

          <div class="filters-section">
            <div class="filter-group">
              <label for="courseFilter">Фильтр по курсу:</label>
              <select id="courseFilter" [(ngModel)]="selectedCourseId" (change)="filterProgress()">
                <option value="">Все курсы</option>
                <option *ngFor="let course of responsibleCourses" [value]="course.id">
                  {{ course.title }}
                </option>
              </select>
            </div>
            <div class="filter-group">
              <label for="statusFilter">Фильтр по статусу:</label>
              <select id="statusFilter" [(ngModel)]="selectedStatus" (change)="filterProgress()">
                <option value="">Все статусы</option>
                <option value="in_progress">В процессе</option>
                <option value="completed">Завершен</option>
                <option value="not_started">Не начат</option>
              </select>
            </div>
          </div>

          <div class="table-container">
            <table class="table" *ngIf="filteredProgress.length > 0">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Материал</th>
                  <th>Курс</th>
                  <th>Прогресс</th>
                  <th>Статус</th>
                  <th>Последняя активность</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let progress of filteredProgress">
                  <td>{{ progress.user_name }}</td>
                  <td>{{ progress.material_title }}</td>
                  <td>{{ progress.course_title || '— без курса —' }}</td>
                  <td>
                    <div class="progress-container">
                      <div class="progress-bar">
                        <div class="progress-fill" [style.width.%]="progress.progress_percent ?? 0"></div>
                      </div>
                      <span class="progress-text">{{ progress.progress_percent ?? 0 }}%</span>
                    </div>
                  </td>
                  <td>
                    <span class="status-badge" [ngClass]="progress.status || 'not_started'">
                      {{ getStatusText(progress.status) }}
                    </span>
                  </td>
                  <td>{{ progress.updated_at ? (progress.updated_at | date : 'dd.MM.yyyy HH:mm') : '—' }}</td>
                  <td>
                    <button class="btn btn-sm btn-info" type="button" (click)="viewUserDetails(progress)">📊 Подробно</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="materials-panel nested">
              <h4>📄 Документация под вашу ответственность</h4>
              <table class="table materials-mini" *ngIf="(docDashboard?.materials?.length ?? 0) > 0">
                <thead>
                  <tr>
                    <th>Материал</th>
                    <th>Курс</th>
                    <th>Срок (дедлайн)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let mat of docDashboard?.materials || []">
                    <td>{{ mat.title }}</td>
                    <td>{{ mat.course_title || '— без курса —' }}</td>
                    <td>{{ mat.password_expires_at ? (mat.password_expires_at | date : 'dd.MM.yyyy HH:mm') : '—' }}</td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="(docDashboard?.materials?.length ?? 0) === 0" class="no-data inline">
                Нет документации под вашу ответственность
              </div>
            </div>

            <div *ngIf="filteredProgress.length === 0 && (docDashboard?.assignments?.length ?? 0) > 0" class="no-data">
              Нет строк, подходящих под выбранные фильтры
            </div>
            <div *ngIf="(docDashboard?.assignments?.length ?? 0) === 0" class="no-data">
              По вашим материалам пока нет назначений сотрудников (проверьте наборы правил доступа к документации).
            </div>
          </div>
        </div>
      </ng-container>

      <div *ngIf="showModal" class="modal-overlay" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Детальный прогресс: {{ selectedUserProgress?.fio || selectedUserProgress?.user_name }}</h3>
            <div class="modal-header-actions">
              <button type="button" class="btn btn-sm btn-print" (click)="printResponsibleReport($event)">
                🖨️ Распечатать отчёт
              </button>
              <button type="button" class="close-btn" (click)="closeModal()">×</button>
            </div>
          </div>

          <div class="modal-body">
            <div *ngIf="selectedUserProgress">
              <h4>Курс: {{ selectedUserProgress.course_title }}</h4>
              <h4 *ngIf="selectedUserProgress.material_title">Материал: {{ selectedUserProgress.material_title }}</h4>
              <div class="progress-details">
                <p><strong>Прогресс:</strong> {{ selectedUserProgress.progress_percent ?? 0 }}%</p>
                <p *ngIf="selectedUserProgress.total_materials != null">
                  <strong>Завершено материалов:</strong> {{ selectedUserProgress.completed_materials }} из
                  {{ selectedUserProgress.total_materials }}
                </p>
                <p *ngIf="selectedUserProgress.created_at">
                  <strong>Дата записи:</strong> {{ selectedUserProgress.created_at | date : 'dd.MM.yyyy HH:mm' }}
                </p>
                <p *ngIf="selectedUserProgress.updated_at">
                  <strong>Последнее обновление:</strong> {{ selectedUserProgress.updated_at | date : 'dd.MM.yyyy HH:mm' }}
                </p>
              </div>

              <div class="materials-progress">
                <h5>Прогресс по материалам курса:</h5>
                <div *ngFor="let material of userMaterials" class="material-item">
                  <span class="material-title">{{ material.title }}</span>
                  <span class="completion-status" [ngClass]="material.is_completed ? 'completed' : 'not-completed'">
                    {{ material.is_completed ? '✓ Завершен' : '○ Не завершен' }}
                  </span>
                  <span class="completion-date" *ngIf="material.completed_at">
                    {{ material.completed_at | date : 'dd.MM.yyyy HH:mm' }}
                  </span>
                </div>
                <div *ngIf="userMaterials.length === 0" class="no-materials">Нет материалов в этом курсе</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .responsible-dashboard { padding: 20px; max-width: 1400px; margin: 0 auto; }
    h2, h3 { color: #333; margin-top: 0; }
    h4 { color: #444; margin-top: 12px; }
    .breadcrumb a { color: #667eea; text-decoration: none; font-size: 14px; }
    .breadcrumb a:hover { text-decoration: underline; }
    .error-banner { background: #ffebee; color: #c62828; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .page-loading { margin: 24px 0; }
    .filters-section { display: flex; gap: 20px; margin: 20px 0; padding: 20px; background: #fafafa; border-radius: 8px; }
    .filter-group { display: flex; flex-direction: column; gap: 5px; }
    .filter-group label { font-weight: 500; color: #333; }
    .filter-group select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-width: 200px; }
    .stats-overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-card h3 { margin: 0 0 10px 0; font-size: 14px; font-weight: normal; opacity: 0.9; color: white; }
    .stat-number { font-size: 32px; font-weight: bold; margin: 0; }
    .progress-table-section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    .table-container { overflow-x: auto; }
    .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    .table thead th { background: #f5f5f5; font-weight: 600; color: #333; }
    .progress-container { display: flex; align-items: center; gap: 10px; }
    .progress-bar { width: 100px; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #4caf50 0%, #8bc34a 100%); transition: width 0.3s ease; }
    .progress-text { font-size: 12px; font-weight: 500; color: #666; }
    .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: uppercase; }
    .status-badge.completed { background: #e8f5e8; color: #2e7d32; }
    .status-badge.in_progress { background: #e3f2fd; color: #1976d2; }
    .status-badge.not_started { background: #fff3e0; color: #f57c00; }
    .btn { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.3s; }
    .btn-sm { padding: 4px 8px; font-size: 11px; }
    .btn-info { background: #17a2b8; color: white; }
    .btn-info:hover { background: #138496; }
    .no-data, .loading { text-align: center; padding: 40px; color: #999; }
    .no-data.inline { padding: 16px; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; border-radius: 8px; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 20px; border-bottom: 1px solid #eee; }
    .modal-header h3 { margin: 0; color: #333; flex: 1; min-width: 0; }
    .modal-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .btn-print { background: #6c757d; color: #fff; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 12px; }
    .btn-print:hover { background: #5a6268; }
    .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; }
    .close-btn:hover { color: #333; }
    .modal-body { padding: 20px; }
    .progress-details p { margin: 8px 0; }
    .materials-progress { margin-top: 20px; }
    .materials-progress h5 { margin-bottom: 15px; color: #333; }
    .material-item { display: flex; align-items: center; gap: 15px; padding: 10px; border-bottom: 1px solid #f0f0f0; flex-wrap: wrap; }
    .material-title { flex: 1; font-weight: 500; min-width: 150px; }
    .completion-status { font-size: 12px; font-weight: bold; padding: 4px 8px; border-radius: 12px; }
    .completion-status.completed { background: #e8f5e8; color: #2e7d32; }
    .completion-status.not-completed { background: #fff3e0; color: #f57c00; }
    .completion-date { font-size: 12px; color: #666; }
    .no-materials { text-align: center; color: #999; padding: 20px; }
    .notifications-panel { background: white; padding: 20px; border-radius: 8px; margin-bottom: 24px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    .notifications-panel h3 { margin-top: 0; }
    .notification-list { list-style: none; padding: 0; margin: 0; }
    .notification-list li { border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fafafa; }
    .notification-list li.unread { border-color: #667eea; background: #f0f4ff; }
    .n-title { font-weight: 600; color: #333; margin-bottom: 4px; }
    .n-meta { font-size: 12px; color: #888; margin-bottom: 8px; }
    .n-body { margin: 0 0 8px 0; font-family: inherit; font-size: 13px; white-space: pre-wrap; color: #444; }
    .btn-secondary { background: #6c757d; color: white; }
    .hint { margin: 0 0 12px 0; }
    .materials-panel.nested { margin-top: 28px; padding-top: 20px; border-top: 1px solid #eee; }
    .materials-panel.nested h4 { margin-top: 0; }
    .materials-mini { margin-top: 12px; }
  `
  ]
})
export class ResponsibleDashboardComponent implements OnInit {
  docDashboard: DocDashboard | null = null;
  dashboardLoading = true;
  dashboardError: string | null = null;

  filteredProgress: any[] = [];
  responsibleCourses: { id: string; title: string }[] = [];
  selectedCourseId = '';
  selectedStatus = '';
  showModal = false;
  selectedUserProgress: any = null;
  userMaterials: any[] = [];

  notifications: any[] = [];
  notificationsLoading = false;
  reminderJobRunning = false;

  constructor(
    private adminService: AdminService,
    public authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadDocDashboard();
    this.loadNotifications();
  }

  loadDocDashboard(): void {
    this.dashboardLoading = true;
    this.dashboardError = null;
    this.adminService.getResponsibleDocumentationDashboard().subscribe({
      next: (d) => {
        this.docDashboard = d;
        this.responsibleCourses = this.buildCourseOptions(d);
        this.filterProgress();
        this.dashboardLoading = false;
      },
      error: () => {
        this.docDashboard = null;
        this.filteredProgress = [];
        this.responsibleCourses = [];
        this.dashboardError = 'Не удалось загрузить данные дашборда. Проверьте авторизацию и права доступа.';
        this.dashboardLoading = false;
      }
    });
  }

  private buildCourseOptions(d: DocDashboard): { id: string; title: string }[] {
    const out: { id: string; title: string }[] = [];
    const seen = new Set<string>();
    for (const m of d.materials || []) {
      if (m.course_id && !seen.has(m.course_id)) {
        seen.add(m.course_id);
        out.push({ id: m.course_id, title: m.course_title || 'Курс' });
      }
    }
    return out.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }

  loadNotifications(): void {
    this.notificationsLoading = true;
    this.notificationService.getNotifications(false, 80).subscribe({
      next: (rows) => {
        this.notifications = rows || [];
        this.notificationsLoading = false;
      },
      error: () => {
        this.notifications = [];
        this.notificationsLoading = false;
      }
    });
  }

  markNotificationRead(n: any): void {
    if (!n?.id) {
      return;
    }
    this.notificationService.markAsRead(n.id).subscribe({
      next: () => {
        n.is_read = true;
      },
      error: (e) => console.error(e)
    });
  }

  runReminderJob(): void {
    this.reminderJobRunning = true;
    this.adminService.runDocumentationNotifications({ force: true }).subscribe({
      next: (r) => {
        this.reminderJobRunning = false;
        alert('Готово: ' + JSON.stringify(r));
        this.loadNotifications();
        this.loadDocDashboard();
      },
      error: (e) => {
        this.reminderJobRunning = false;
        console.error(e);
        alert('Ошибка запуска');
      }
    });
  }

  filterProgress(): void {
    const src = this.docDashboard?.assignments || [];
    this.filteredProgress = src.filter((row) => {
      const courseMatch =
        !this.selectedCourseId || String(row.course_id || '') === String(this.selectedCourseId);
      const statusMatch = !this.selectedStatus || row.status === this.selectedStatus;
      return courseMatch && statusMatch;
    });
  }

  getStatusText(status: string | undefined): string {
    switch (status) {
      case 'completed':
        return 'Завершен';
      case 'in_progress':
        return 'В процессе';
      case 'not_started':
        return 'Не начат';
      default:
        return status || '—';
    }
  }

  viewUserDetails(row: any): void {
    this.selectedUserProgress = {
      fio: row.user_name,
      user_name: row.user_name,
      course_title: row.course_title || '— без курса —',
      material_title: row.material_title,
      progress_percent: row.progress_percent ?? 0,
      completed_materials: row.completed_at ? 1 : 0,
      total_materials: 1,
      created_at: row.assigned_at || row.first_opened_at,
      updated_at: row.updated_at || row.first_opened_at || row.assigned_at,
      user_id: row.user_id,
      course_id: row.course_id
    };

    if (row.course_id) {
      this.adminService.getUserMaterials(row.user_id, row.course_id).subscribe({
        next: (data) => {
          this.userMaterials = data;
        },
        error: () => {
          this.userMaterials = [];
        }
      });
    } else {
      this.userMaterials = [
        {
          title: row.material_title,
          is_completed: !!row.completed_at,
          completed_at: row.completed_at
        }
      ];
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedUserProgress = null;
    this.userMaterials = [];
  }

  printResponsibleReport(ev?: Event): void {
    ev?.stopPropagation?.();
    const uid = this.selectedUserProgress?.user_id;
    if (!uid) {
      return;
    }
    this.adminService.getResponsibleReportForUser(uid).subscribe({
      next: (data) => {
        const body = buildResponsibleReportBody(data);
        const title = `Отчёт по сотруднику: ${data?.user?.fio || this.selectedUserProgress?.fio || ''}`;
        openPrintableReport(title, title, body);
      },
      error: (e) => {
        console.error(e);
        alert(
          'Не удалось сформировать отчёт. Убедитесь, что у сотрудника есть материалы в зоне вашей ответственности.'
        );
      }
    });
  }
}
