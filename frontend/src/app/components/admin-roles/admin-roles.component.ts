import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="admin-roles">
      <div class="breadcrumb">
        <a routerLink="/admin">← Панель управления</a>
      </div>
      
      <h2>Управление ролями и уровнями доступа</h2>

      <div class="roles-section">
        <h3>Роли</h3>
        <div class="action-buttons">
          <button (click)="toggleRoleForm()" class="btn btn-primary">+ Добавить роль</button>
        </div>

        <form *ngIf="showRoleForm" [formGroup]="roleForm" (ngSubmit)="saveRole()" class="form-section">
          <div class="form-group">
            <label>Название роли</label>
            <input type="text" formControlName="name" class="form-control" placeholder="Введите название">
          </div>
          <div class="form-group">
            <label>Описание</label>
            <textarea formControlName="description" class="form-control" placeholder="Введите описание"></textarea>
          </div>
          <button type="submit" class="btn btn-success">Сохранить роль</button>
          <button type="button" (click)="toggleRoleForm()" class="btn btn-secondary">Отмена</button>
        </form>

        <div class="roles-list">
          <div *ngFor="let role of roles" class="role-item">
            <div>
              <h4>{{ role.name }}</h4>
              <p *ngIf="role.description">{{ role.description }}</p>
            </div>
            <div class="actions">
              <button (click)="editRole(role)" class="btn btn-sm btn-info">Редактировать</button>
              <button *ngIf="!role.is_system" (click)="deleteRole(role.id)" class="btn btn-sm btn-danger">Удалить</button>
            </div>
          </div>
        </div>
      </div>

      <div class="access-levels-section">
        <h3>Уровни доступа</h3>
        <div class="action-buttons">
          <button (click)="toggleAccessForm()" class="btn btn-primary">+ Добавить уровень</button>
        </div>

        <form *ngIf="showAccessForm" [formGroup]="accessForm" (ngSubmit)="saveAccessLevel()" class="form-section">
          <div class="form-group">
            <label>Название</label>
            <input type="text" formControlName="name" class="form-control" placeholder="Введите название">
          </div>
          <div class="form-group">
            <label>Код</label>
            <input type="text" formControlName="code" class="form-control" placeholder="Введите код">
          </div>
          <div class="form-group">
            <label>Приоритет</label>
            <input type="number" formControlName="priority" class="form-control" placeholder="Введите приоритет">
          </div>
          <div class="form-group">
            <label>Описание</label>
            <textarea formControlName="description" class="form-control" placeholder="Введите описание"></textarea>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" formControlName="requires_password">
              Требуется пароль
            </label>
          </div>
          <button type="submit" class="btn btn-success">Сохранить уровень</button>
          <button type="button" (click)="toggleAccessForm()" class="btn btn-secondary">Отмена</button>
        </form>

        <div class="access-levels-list">
          <table class="table" *ngIf="accessLevels.length > 0">
            <thead>
              <tr>
                <th>Название</th>
                <th>Код</th>
                <th>Приоритет</th>
                <th>Требуется пароль</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let level of accessLevels">
                <td>{{ level.name }}</td>
                <td>{{ level.code }}</td>
                <td>{{ level.priority }}</td>
                <td>{{ level.requires_password ? 'Да' : 'Нет' }}</td>
                <td class="actions">
                  <button (click)="editAccessLevel(level)" class="btn btn-sm btn-info">Редактировать</button>
                  <button (click)="deleteAccessLevel(level.id)" class="btn btn-sm btn-danger">Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-roles {
      padding: 20px;
    }

    h2 {
      margin-top: 0;
      color: #333;
    }

    h3 {
      margin-top: 30px;
      color: #333;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }

    .action-buttons {
      margin: 15px 0;
    }

    .form-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .form-group {
      margin-bottom: 15px;
    }

    label {
      display: block;
      margin-bottom: 5px;
      color: #555;
      font-weight: 500;
    }

    .form-control {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .btn {
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s;
      margin-right: 5px;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-success {
      background: #4caf50;
      color: white;
    }

    .btn-secondary {
      background: #999;
      color: white;
    }

    .btn-info {
      background: #2196f3;
      color: white;
      padding: 5px 10px;
      font-size: 12px;
    }

    .btn-danger {
      background: #f44336;
      color: white;
      padding: 5px 10px;
      font-size: 12px;
    }

    .btn-sm {
      padding: 5px 10px;
      font-size: 12px;
      margin-right: 5px;
    }

    .roles-list {
      display: grid;
      gap: 15px;
    }

    .role-item {
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .role-item h4 {
      margin: 0 0 5px 0;
    }

    .role-item p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .actions {
      display: flex;
      gap: 5px;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }

    .table thead {
      background: #f5f5f5;
      border-bottom: 2px solid #ddd;
    }

    .table th, .table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    .roles-section, .access-levels-section {
      margin-bottom: 30px;
    }
  `]
})
export class AdminRolesComponent implements OnInit {
  roles: any[] = [];
  accessLevels: any[] = [];
  roleForm!: FormGroup;
  accessForm!: FormGroup;
  showRoleForm = false;
  showAccessForm = false;
  editingRoleId: string | null = null;
  editingAccessLevelId: string | null = null;

  constructor(
    private adminService: AdminService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadRoles();
    this.loadAccessLevels();
  }

  initForms(): void {
    this.roleForm = this.formBuilder.group({
      name: ['', Validators.required],
      description: ['']
    });

    this.accessForm = this.formBuilder.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      priority: [0, Validators.required],
      description: [''],
      requires_password: [false]
    });
  }

  loadRoles(): void {
    this.adminService.getRoles().subscribe({
      next: (data) => {
        this.roles = data;
      },
      error: (error) => console.error('Ошибка загрузки ролей:', error)
    });
  }

  loadAccessLevels(): void {
    this.adminService.getAccessLevels().subscribe({
      next: (data) => {
        this.accessLevels = data;
      },
      error: (error) => console.error('Ошибка загрузки уровней доступа:', error)
    });
  }

  toggleRoleForm(): void {
    this.showRoleForm = !this.showRoleForm;
    if (!this.showRoleForm) {
      this.roleForm.reset();
      this.editingRoleId = null;
    }
  }

  toggleAccessForm(): void {
    this.showAccessForm = !this.showAccessForm;
    if (!this.showAccessForm) {
      this.accessForm.reset();
      this.editingAccessLevelId = null;
    }
  }

  saveRole(): void {
    if (this.roleForm.invalid) return;

    const data = this.roleForm.value;

    if (this.editingRoleId) {
      this.adminService.updateRole(this.editingRoleId, data).subscribe({
        next: () => {
          this.loadRoles();
          this.toggleRoleForm();
        },
        error: (error) => console.error('Ошибка обновления роли:', error)
      });
    } else {
      this.adminService.createRole(data).subscribe({
        next: () => {
          this.loadRoles();
          this.toggleRoleForm();
        },
        error: (error) => console.error('Ошибка создания роли:', error)
      });
    }
  }

  saveAccessLevel(): void {
    if (this.accessForm.invalid) return;

    const data = this.accessForm.value;

    if (this.editingAccessLevelId) {
      this.adminService.updateAccessLevel(this.editingAccessLevelId, data).subscribe({
        next: () => {
          this.loadAccessLevels();
          this.toggleAccessForm();
        },
        error: (error) => console.error('Ошибка обновления уровня доступа:', error)
      });
    } else {
      this.adminService.createAccessLevel(data).subscribe({
        next: () => {
          this.loadAccessLevels();
          this.toggleAccessForm();
        },
        error: (error) => console.error('Ошибка создания уровня доступа:', error)
      });
    }
  }

  editAccessLevel(level: any): void {
    this.editingAccessLevelId = level.id;
    this.accessForm.patchValue(level);
    this.showAccessForm = true;
  }

  deleteAccessLevel(id: string): void {
    if (confirm('Вы уверены, что хотите удалить этот уровень доступа?')) {
      this.adminService.deleteAccessLevel(id).subscribe({
        next: () => this.loadAccessLevels(),
        error: (error) => console.error('Ошибка удаления уровня доступа:', error)
      });
    }
  }

  editRole(role: any): void {
    this.editingRoleId = role.id;
    this.roleForm.patchValue(role);
    this.showRoleForm = true;
  }

  deleteRole(id: string): void {
    if (confirm('Вы уверены, что хотите удалить эту роль?')) {
      this.adminService.deleteRole(id).subscribe({
        next: () => this.loadRoles(),
        error: (error) => console.error('Ошибка удаления роли:', error)
      });
    }
  }
}
