import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { openPrintableReport, buildOverallAdminReportBody, type PrintableReportKind } from '../../utils/print-report';

@Component({
  selector: 'app-admin-progress',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="admin-progress">
      <div class="breadcrumb">
        <a routerLink="/admin">← Панель управления</a>
      </div>
      
      <div class="page-title-row">
        <h2>Отслеживание прогресса пользователей</h2>
        <button type="button" class="btn btn-print-report" (click)="printOverallReport()" [disabled]="overallReportLoading">
          {{ overallReportLoading ? '…' : '📄 Сформировать общий отчёт' }}
        </button>
      </div>

      <div class="filters-section">
        <div class="filter-group">
          <label for="courseFilter">Фильтр по курсу:</label>
          <select id="courseFilter" [(ngModel)]="selectedCourse" (change)="filterProgress()">
            <option value="">Все курсы</option>
            <option *ngFor="let course of courses" [value]="course.id">{{ course.title }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="statusFilter">Фильтр по статусу:</label>
          <select id="statusFilter" [(ngModel)]="selectedStatus" (change)="filterProgress()">
            <option value="">Все статусы</option>
            <option value="in_progress">В процессе</option>
            <option value="completed">Завершен</option>
            <option value="new">Не начат</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="deptFilter">Отдел (подстрока):</label>
          <input id="deptFilter" type="text" [(ngModel)]="filterDepartment" (ngModelChange)="filterProgress()" placeholder="Напр. бухгалтерия">
        </div>
        <div class="filter-group">
          <label for="roleFilter">Роль (подстрока):</label>
          <input id="roleFilter" type="text" [(ngModel)]="filterRole" (ngModelChange)="filterProgress()" placeholder="Напр. student">
        </div>
      </div>

      <div class="stats-overview">
        <div class="stat-card">
          <h3>Всего записей на курсы</h3>
          <p class="stat-number">{{ totalEnrollments }}</p>
        </div>
        <div class="stat-card">
          <h3>Завершенных курсов</h3>
          <p class="stat-number">{{ completedCount }}</p>
        </div>
        <div class="stat-card">
          <h3>Средний прогресс</h3>
          <p class="stat-number">{{ averageProgress }}%</p>
        </div>
        <div class="stat-card">
          <h3>Активных пользователей</h3>
          <p class="stat-number">{{ activeUsersCount }}</p>
        </div>
      </div>

      <div class="progress-table-section">
        <h3>Детальный прогресс</h3>
        <div class="table-container">
          <table class="table" *ngIf="userProgress.length > 0">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Отдел</th>
                <th>Роли</th>
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
                <td>{{ progress.department || '—' }}</td>
                <td class="roles-cell">{{ progress.roles || '—' }}</td>
                <td>{{ progress.course_title }}</td>
                <td>
                  <div class="progress-container">
                    <div class="progress-bar">
                      <div class="progress-fill" [style.width.%]="progress.progress_percent"></div>
                    </div>
                    <span class="progress-text">{{ progress.progress_percent }}%</span>
                  </div>
                </td>
                <td>
                  <span class="status-badge" [ngClass]="progress.status">
                    {{ getStatusText(progress.status) }}
                  </span>
                </td>
                <td>{{ progress.updated_at | date:'dd.MM.yyyy HH:mm' }}</td>
                <td>
                  <button class="btn btn-sm btn-info" (click)="viewUserDetails(progress.user_id, progress.course_id)">
                    📊 Подробно
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div *ngIf="userProgress.length === 0" class="no-data">
            Нет данных о прогрессе
          </div>
        </div>
      </div>

      <!-- Modal for user details -->
      <div *ngIf="showModal" class="modal-overlay" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Детальный прогресс: {{ selectedUserProgress?.user_name }}</h3>
            <button class="close-btn" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <div *ngIf="selectedUserProgress">
              <h4>Курс: {{ selectedUserProgress.course_title }}</h4>
              <div class="progress-details">
                <p><strong>Прогресс:</strong> {{ selectedUserProgress.progress_percent }}%</p>
                <p><strong>Завершено материалов:</strong> {{ selectedUserProgress.completed_materials }} из {{ selectedUserProgress.total_materials }}</p>
                <p><strong>Дата записи:</strong> {{ selectedUserProgress.created_at | date:'dd.MM.yyyy HH:mm' }}</p>
                <p><strong>Последнее обновление:</strong> {{ selectedUserProgress.updated_at | date:'dd.MM.yyyy HH:mm' }}</p>
              </div>

              <div class="materials-progress">
                <h5>Прогресс по материалам:</h5>
                <div *ngFor="let material of userMaterials" class="material-item">
                  <span class="material-title">{{ material.title }}</span>
                  <span class="completion-status" [ngClass]="material.is_completed ? 'completed' : 'not-completed'">
                    {{ material.is_completed ? '✓ Завершен' : '○ Не завершен' }}
                  </span>
                  <span class="completion-date" *ngIf="material.completed_at">
                    {{ material.completed_at | date:'dd.MM.yyyy HH:mm' }}
                  </span>
                </div>
              </div>

              <div class="test-attempts-section">
                <h5>История попыток тестов:</h5>
                <div *ngIf="userTestAttempts.length === 0" class="no-attempts">
                  Попытки тестов отсутствуют
                </div>
                <table *ngIf="userTestAttempts.length > 0" class="attempts-table">
                  <thead>
                    <tr>
                      <th>Тест</th>
                      <th>Результат</th>
                      <th>Статус</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let attempt of userTestAttempts">
                      <td>{{ attempt.test_title }}</td>
                      <td>{{ attempt.score }}%</td>
                      <td>
                        <span class="attempt-badge" [ngClass]="attempt.passed ? 'passed' : 'failed'">
                          {{ attempt.passed ? '✓ Сдан' : '✗ Не сдан' }}
                        </span>
                      </td>
                      <td>{{ attempt.completed_at | date:'dd.MM.yyyy HH:mm' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-progress {
      padding: 20px;
    }

    h2, h3 {
      color: #333;
      margin-top: 0;
    }

    .page-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    .btn-print-report {
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      background: #2e7d32;
      color: white;
      font-size: 14px;
      cursor: pointer;
    }

    .btn-print-report:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-print-report:hover:not(:disabled) {
      background: #1b5e20;
    }

    .roles-cell {
      max-width: 220px;
      font-size: 12px;
      word-break: break-word;
    }

    .breadcrumb a {
      color: #667eea;
      text-decoration: none;
      font-size: 14px;
    }

    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .filters-section {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .filter-group label {
      font-weight: 500;
      color: #333;
    }

    .filter-group select {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      min-width: 150px;
    }

    .stats-overview {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }

    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }

    .stat-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      font-weight: normal;
      opacity: 0.9;
      color: white;
    }

    .stat-number {
      font-size: 32px;
      font-weight: bold;
      margin: 0;
    }

    .progress-table-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .table-container {
      overflow-x: auto;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }

    .table th,
    .table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    .table thead th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }

    .progress-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .progress-bar {
      width: 100px;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #8bc34a 100%);
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 12px;
      font-weight: 500;
      color: #666;
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .status-badge.completed {
      background: #e8f5e8;
      color: #2e7d32;
    }

    .status-badge.in_progress {
      background: #e3f2fd;
      color: #1976d2;
    }

    .status-badge.not_started,
    .status-badge.new {
      background: #fff3e0;
      color: #f57c00;
    }

    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      text-decoration: none;
      display: inline-block;
      transition: all 0.3s;
    }

    .btn-sm {
      padding: 4px 8px;
      font-size: 11px;
    }

    .btn-info {
      background: #17a2b8;
      color: white;
    }

    .btn-info:hover {
      background: #138496;
    }

    .no-data {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    /* Modal styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
    }

    .modal-header h3 {
      margin: 0;
      color: #333;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    }

    .close-btn:hover {
      color: #333;
    }

    .modal-body {
      padding: 20px;
    }

    .progress-details p {
      margin: 8px 0;
    }

    .materials-progress {
      margin-top: 20px;
    }

    .materials-progress h5 {
      margin-bottom: 15px;
      color: #333;
    }

    .material-item {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 10px;
      border-bottom: 1px solid #f0f0f0;
    }

    .material-title {
      flex: 1;
      font-weight: 500;
    }

    .completion-status {
      font-size: 12px;
      font-weight: bold;
      padding: 4px 8px;
      border-radius: 12px;
    }

    .completion-status.completed {
      background: #e8f5e8;
      color: #2e7d32;
    }

    .completion-status.not-completed {
      background: #fff3e0;
      color: #f57c00;
    }

    .completion-date {
      font-size: 12px;
      color: #666;
    }

    .test-attempts-section {
      margin-top: 24px;
      border-top: 2px solid #f0f0f0;
      padding-top: 16px;
    }

    .test-attempts-section h5 {
      margin-bottom: 12px;
      color: #333;
    }

    .no-attempts {
      color: #999;
      font-size: 14px;
      padding: 10px 0;
    }

    .attempts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .attempts-table th {
      background: #f5f5f5;
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid #ddd;
    }

    .attempts-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #f0f0f0;
    }

    .attempt-badge {
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: bold;
    }

    .attempt-badge.passed {
      background: #e8f5e8;
      color: #2e7d32;
    }

    .attempt-badge.failed {
      background: #ffebee;
      color: #c62828;
    }
  `]
})
export class AdminProgressComponent implements OnInit {
  userProgress: any[] = [];
  filteredProgress: any[] = [];
  courses: any[] = [];
  selectedCourse = '';
  selectedStatus = '';
  filterDepartment = '';
  filterRole = '';
  overallReportLoading = false;
  totalEnrollments = 0;
  completedCount = 0;
  averageProgress = 0;
  activeUsersCount = 0;
  
  showModal = false;
  selectedUserProgress: any = null;
  userMaterials: any[] = [];
  userTestAttempts: any[] = [];

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.loadCourses();
    this.loadUserProgress();
  }

  loadCourses() {
    this.adminService.getCourses().subscribe({
      next: (data) => {
        this.courses = data;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
      }
    });
  }

  loadUserProgress() {
    this.adminService.getUserProgress().subscribe({
      next: (data) => {
        this.userProgress = data;
        this.filterProgress();
      },
      error: (error) => {
        console.error('Error loading user progress:', error);
      }
    });
  }

  filterProgress() {
    const fd = (this.filterDepartment || '').trim().toLowerCase();
    const fr = (this.filterRole || '').trim().toLowerCase();
    this.filteredProgress = this.userProgress.filter((progress) => {
      const courseMatch = !this.selectedCourse || progress.course_id === this.selectedCourse;
      const statusMatch = !this.selectedStatus || progress.status === this.selectedStatus;
      const deptMatch =
        !fd || String(progress.department || '').toLowerCase().includes(fd);
      const roleMatch =
        !fr || String(progress.roles || '').toLowerCase().includes(fr);
      return courseMatch && statusMatch && deptMatch && roleMatch;
    });
    this.calculateStats();
  }

  calculateStats() {
    const src = this.filteredProgress;
    this.totalEnrollments = src.length;
    this.completedCount = src.filter((p) => p.status === 'completed').length;

    const totalProgress = src.reduce((sum, p) => sum + (Number(p.progress_percent) || 0), 0);
    this.averageProgress = this.totalEnrollments > 0 ? Math.round(totalProgress / this.totalEnrollments) : 0;

    const uniqueUsers = new Set(src.map((p) => p.user_id));
    this.activeUsersCount = uniqueUsers.size;
  }

  printOverallReport(): void {
    this.overallReportLoading = true;
    this.adminService.getOverallAdminReport().subscribe({
      next: (data) => {
        this.overallReportLoading = false;
        const body = buildOverallAdminReportBody(data);
        const title = 'Сводный отчёт по прогрессу пользователей';
        const kind: PrintableReportKind = 'overall-admin';
        openPrintableReport(title, title, body, kind);
      },
      error: (err) => {
        this.overallReportLoading = false;
        console.error(err);
        alert('Не удалось получить сводный отчёт (нужны права администратора).');
      }
    });
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'completed': return 'Завершен';
      case 'in_progress': return 'В процессе';
      case 'new':
      case 'not_started': return 'Не начат';
      default: return status;
    }
  }

  viewUserDetails(userId: string, courseId: string) {
    this.selectedUserProgress = this.userProgress.find(
      p => p.user_id === userId && p.course_id === courseId
    );
    
    if (this.selectedUserProgress) {
      this.loadUserMaterials(userId, courseId);
      this.loadUserTestAttempts(userId, courseId);
      this.showModal = true;
    }
  }

  loadUserMaterials(userId: string, courseId: string) {
    this.adminService.getUserMaterials(userId, courseId).subscribe({
      next: (data) => {
        this.userMaterials = data;
      },
      error: (error) => {
        console.error('Error loading user materials:', error);
        this.userMaterials = [];
      }
    });
  }

  loadUserTestAttempts(userId: string, courseId: string) {
    this.adminService.getUserTestAttempts(userId, courseId).subscribe({
      next: (data) => {
        this.userTestAttempts = data;
      },
      error: (error) => {
        console.error('Error loading test attempts:', error);
        this.userTestAttempts = [];
      }
    });
  }

  closeModal() {
    this.showModal = false;
    this.selectedUserProgress = null;
    this.userMaterials = [];
    this.userTestAttempts = [];
  }
}