import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-positions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="admin-positions">
      <div class="breadcrumb">
        <a routerLink="/admin">← Панель управления</a>
      </div>
      
      <h2>Управление должностями</h2>

      <div class="actions">
        <button (click)="toggleForm()" class="btn btn-primary">➕ Добавить должность</button>
        <button (click)="loadPositions()" class="btn btn-secondary">🔄 Обновить</button>
      </div>

      <!-- Форма -->
      <div *ngIf="showForm" class="form-card">
        <h3>{{ editingId ? 'Редактирование' : 'Новая должность' }}</h3>
        <form [formGroup]="positionForm" (ngSubmit)="save()">
          <div class="form-group">
            <label>Название *</label>
            <input type="text" formControlName="name" class="form-control">
          </div>
          <div class="form-group">
            <label>Важность (0-100)</label>
            <input type="range" formControlName="importance" min="0" max="100" class="slider">
            <span class="value">{{ positionForm.get('importance')?.value }}</span>
          </div>
          <div class="form-group">
            <label>Описание</label>
            <textarea formControlName="description" class="form-control" rows="3"></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-success">💾 Сохранить</button>
            <button type="button" (click)="toggleForm()" class="btn btn-secondary">❌ Отмена</button>
          </div>
        </form>
      </div>

      <!-- Таблица -->
      <div class="table-container" *ngIf="positions.length > 0">
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Важность</th>
              <th>Описание</th>
              <th>Пользователей</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of positions">
              <td><strong>{{ p.name }}</strong></td>
              <td>
                <span class="badge" [class.high]="p.importance >= 70" 
                      [class.medium]="p.importance >= 40 && p.importance < 70"
                      [class.low]="p.importance < 40">
                  {{ p.importance }}
                </span>
              </td>
              <td>{{ p.description || '—' }}</td>
              <td>{{ p.users_count || 0 }}</td>
              <td>
                <span class="status" [class.active]="p.is_active">
                  {{ p.is_active ? 'Активна' : 'Неактивна' }}
                </span>
              </td>
              <td>
                <button (click)="edit(p)" class="btn-icon edit">✏️</button>
                <button (click)="delete(p.id)" class="btn-icon delete">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="positions.length === 0 && !isLoading" class="empty">
        <p>📋 Нет должностей</p>
        <button (click)="toggleForm()" class="btn btn-primary">Создать первую должность</button>
      </div>

      <div *ngIf="isLoading" class="loading">
        <div class="spinner"></div>
        <p>Загрузка...</p>
      </div>
    </div>
  `,
  styles: [`
    .admin-positions { padding: 20px; max-width: 1200px; margin: 0 auto; }
    h2 { margin-bottom: 20px; color: #333; }
    .actions { margin-bottom: 20px; display: flex; gap: 10px; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #667eea; color: white; }
    .btn-primary:hover { background: #5a67d8; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:hover { background: #5a6268; }
    .btn-success { background: #28a745; color: white; }
    .btn-success:hover { background: #218838; }
    .form-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
    .form-control { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    .slider { width: 200px; margin-right: 10px; }
    .value { display: inline-block; width: 40px; text-align: center; font-weight: bold; color: #667eea; }
    .form-actions { display: flex; gap: 10px; margin-top: 20px; }
    .table-container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #555; }
    tr:hover { background: #f5f5f5; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .badge.high { background: #f44336; color: white; }
    .badge.medium { background: #ff9800; color: white; }
    .badge.low { background: #4caf50; color: white; }
    .status { padding: 4px 12px; border-radius: 20px; font-size: 12px; background: #e9ecef; color: #6c757d; }
    .status.active { background: #c8e6c9; color: #2e7d32; }
    .btn-icon { background: none; border: none; font-size: 18px; cursor: pointer; padding: 5px; margin: 0 3px; transition: transform 0.2s; }
    .btn-icon:hover { transform: scale(1.1); }
    .edit:hover { color: #2196f3; }
    .delete:hover { color: #f44336; }
    .empty { text-align: center; padding: 60px 20px; color: #999; }
    .loading { text-align: center; padding: 60px 20px; }
    .spinner { width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `]
})
export class AdminPositionsComponent implements OnInit {
  positions: any[] = [];
  positionForm!: FormGroup;
  showForm = false;
  editingId: string | null = null;
  isLoading = false;

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.positionForm = this.fb.group({
      name: ['', Validators.required],
      importance: [50, [Validators.required, Validators.min(0), Validators.max(100)]],
      description: ['']
    });
    this.loadPositions();
  }

  loadPositions(): void {
    this.isLoading = true;
    this.adminService.getPositions().subscribe({
      next: (res: any) => {
        this.positions = res.data || [];
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Ошибка:', err);
        this.isLoading = false;
        alert('Ошибка загрузки должностей');
      }
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.positionForm.reset({ importance: 50, description: '' });
      this.editingId = null;
    }
  }

  save(): void {
    if (this.positionForm.invalid) {
      alert('Заполните название');
      return;
    }

    const data = this.positionForm.value;

    if (this.editingId) {
      this.adminService.updatePosition(this.editingId, data).subscribe({
        next: () => {
          this.loadPositions();
          this.toggleForm();
          alert('Должность обновлена');
        },
        error: () => alert('Ошибка обновления')
      });
    } else {
      this.adminService.createPosition(data).subscribe({
        next: () => {
          this.loadPositions();
          this.toggleForm();
          alert('Должность создана');
        },
        error: () => alert('Ошибка создания')
      });
    }
  }

  edit(position: any): void {
    this.editingId = position.id;
    this.positionForm.patchValue({
      name: position.name,
      importance: position.importance,
      description: position.description || ''
    });
    this.showForm = true;
  }

  delete(id: string): void {
    if (confirm('Удалить должность?')) {
      this.adminService.deletePosition(id).subscribe({
        next: (res: any) => {
          this.loadPositions();
          alert(res.message || 'Удалено');
        },
        error: () => alert('Ошибка удаления')
      });
    }
  }
}