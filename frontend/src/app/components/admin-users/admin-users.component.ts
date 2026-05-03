import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  template: `
    <div class="admin-users">
      <div class="breadcrumb">
        <a routerLink="/admin">← Панель управления</a>
      </div>
      
      <h2>Управление пользователями</h2>

      <div class="action-buttons">
        <button (click)="openAddForm()" class="btn btn-primary">+ Добавить пользователя</button>
      </div>

      <form *ngIf="showForm" [formGroup]="userForm" (ngSubmit)="saveUser()" class="form-section">
        
      
        <div class="form-group">
          <label>Полное имя</label>
          <input type="text" formControlName="fio" class="form-control" placeholder="Введите полное имя">
        </div>
        <div class="form-group">
          <label>Логин</label>
          <input type="text" formControlName="login" class="form-control" placeholder="Введите логин">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" formControlName="email" class="form-control" placeholder="Введите email">
        </div>
        
        
        <!-- 🟢 ИЗМЕНЕНО: выпадающий список должностей вместо текстового поля -->
        <div class="form-group">
          <label>Должность</label>
          <select formControlName="position_id" class="form-control">
            <option [value]="null">— Не выбрана —</option>
            <option *ngFor="let position of positionsList" [value]="position.id">
              {{ position.name }} (важность: {{ position.importance }})
            </option>
          </select>
          <small class="hint" *ngIf="positionsList.length === 0">
            Нет доступных должностей. Сначала создайте должности в разделе "Управление должностями"
          </small>
        </div>


        <div class="form-group">
          <label>Отдел</label>
          <input type="text" formControlName="department" class="form-control" placeholder="Напр. Отдел кадров">
        </div>
        <div class="form-group">
          <label>Пароль {{ editingId ? '(оставьте пустым, чтобы не менять)' : '*' }}</label>
          <input type="password" formControlName="password" class="form-control" placeholder="Введите пароль">
        </div>
        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" formControlName="isAdmin">
            <span>Администратор</span>
          </label>
        </div>

        <!-- Роли пользователя -->
        <div class="form-group">
          <label>Роли пользователя <span class="hint">(Ctrl/Cmd для выбора нескольких)</span></label>
          <select multiple [(ngModel)]="selectedUserRoles" [ngModelOptions]="{standalone: true}" class="multi-select">
            <option *ngFor="let role of allRoles" [value]="role.id">{{ role.description || role.name }}</option>
          </select>
        </div>

<!-- Уровни доступа (грифы) пользователя -->
<div class="form-group">
  <label>Уровни доступа (грифы) <span class="hint">(Ctrl/Cmd для выбора нескольких)</span></label>
  <select multiple [(ngModel)]="selectedAccessLevels" [ngModelOptions]="{standalone: true}" class="multi-select">
    <option *ngFor="let level of accessLevelsList" [value]="level.id">
      {{ getLevelIcon(level.code) }} {{ level.name }} ({{ level.code }}) - Приоритет: {{ level.priority }}
      <span *ngIf="level.requires_password" class="password-icon">🔑</span>
    </option>
  </select>
  <small class="hint-text">Выберите уровни доступа, которые будут доступны пользователю</small>
</div>


        <button type="submit" class="btn btn-success">Сохранить</button>
        <button type="button" (click)="closeForm()" class="btn btn-secondary">Отмена</button>
      </form>

      <div class="users-table">
        <table *ngIf="users.length > 0" class="table">
          <thead>
            <tr>
              <th>Полное имя</th>
              <th>Логин</th>
              <th>Email</th>
              <th>Должность</th>
              <th>Отдел</th>
              <th>Роль</th>
              <th>Грифы</th> 
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of users">
              <td>{{ user.fio }}</td>
              <td>{{ user.login }}</td>
              <td>{{ user.email || '-' }}</td>
              <td>
                <span *ngIf="user.position_name; else noPosition">
                  {{ user.position_name }}
                  <small class="importance-badge" [class.high]="user.position_importance >= 70" 
                         [class.medium]="user.position_importance >= 40 && user.position_importance < 70"
                         [class.low]="user.position_importance < 40">
                    важность: {{ user.position_importance }}
                  </small>
                </span>
                <ng-template #noPosition>{{ user.position || '—' }}</ng-template>
              </td>
              <td>{{ user.department || '-' }}</td>
              <td>
                <span class="badge" [ngClass]="user.is_admin ? 'admin' : 'user'">
                  {{ user.is_admin ? '👑 Админ' : 'Пользователь' }}
                </span>
              </td>
                
    <!-- 🟢 НОВАЯ ЯЧЕЙКА ДЛЯ ГРИФОВ -->
    <td>
      <div class="access-levels-tags">
        <span *ngFor="let level of user.access_levels" class="level-tag" [ngClass]="getLevelClass(level.code)">
          {{ getLevelIcon(level.code) }} {{ level.name }}
        </span>
        <span *ngIf="!user.access_levels?.length" class="no-levels">—</span>
      </div>
    </td>
              <td>
                <span class="badge" [ngClass]="user.is_active ? 'active' : 'inactive'">
                  {{ user.is_active ? 'Активен' : 'Неактивен' }}
                </span>
              </td>
              <td>
                <button (click)="editUser(user)" class="btn btn-sm btn-info">Редактировать</button>
                <button (click)="toggleUserActive(user)" class="btn btn-sm"
                        [ngClass]="user.is_active ? 'btn-warning' : 'btn-success'">
                  {{ user.is_active ? 'Деактивировать' : 'Активировать' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="users.length === 0" class="no-data">Пока нет пользователей</div>
      </div>
    </div>
  `,
  styles: [`
    .breadcrumb {
      margin-bottom: 15px;
    }
    
    .breadcrumb a {
      color: #667eea;
      text-decoration: none;
      font-size: 14px;
    }
    .access-levels-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.level-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}




.level-public { background: #27ae60; color: white; }
.level-internal { background: #3498db; color: white; }
.level-confidential { background: #f39c12; color: white; }
.level-secret { background: #e74c3c; color: white; }
.level-top_secret { background: #8e44ad; color: white; }
.level-default { background: #95a5a6; color: white; }

.no-levels {
  color: #999;
  font-size: 12px;
}
    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .admin-users {
      padding: 20px;
    }

    h2 {
      margin-top: 0;
      color: #333;
    }

    .action-buttons {
      margin: 20px 0;
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

    .btn-warning {
      background: #ff9800;
      color: white;
      padding: 5px 10px;
      font-size: 12px;
    }

    .btn-sm {
      padding: 5px 10px;
      font-size: 12px;
      margin-right: 5px;
    }

    .users-table {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      overflow: hidden;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
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

    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 12px;
      color: white;
    }

    .badge.active {
      background: #4caf50;
    }

    .badge.inactive {
      background: #f44336;
    }

    .badge.admin {
      background: #ff9800;
    }

    .badge.user {
      background: #2196f3;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
    }

    .checkbox-group label {
      display: flex;
      align-items: center;
      cursor: pointer;
      margin-bottom: 0;
    }

    .checkbox-group input[type="checkbox"] {
      margin-right: 8px;
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .checkbox-group span {
      font-weight: 500;
      color: #333;
    }

    .no-data {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .multi-select {
      width: 100%;
      min-height: 80px;
      padding: 4px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
.password-icon {
  margin-left: 5px;
  font-size: 11px;
}

.hint-text {
  font-size: 11px;
  color: #999;
  margin-top: 5px;
  display: block;
}
    .hint {
      font-size: 11px;
      color: #999;
      font-weight: normal;
    }
  `]
})
export class AdminUsersComponent implements OnInit {
  users: any[] = [];
  allRoles: any[] = [];
  positionsList: any[] = [];  // 🟢 НОВОЕ: список должностей
  accessLevelsList: any[] = [];  // 🟢 ДОБАВИТЬ: список уровней доступа
  selectedUserRoles: string[] = [];
  selectedAccessLevels: string[] = [];  // 🟢 ДОБАВИТЬ: выбранные уровни доступа
  userForm!: FormGroup;
  showForm = false;
  editingId: string | null = null;

  constructor(
    private adminService: AdminService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
  //console.log('🔵 ngOnInit started');
  this.initForm();
  this.loadUsers();
  this.loadRoles();
  this.loadPositions();
  this.loadAccessLevels();  // 🟢 ДОБАВИТЬ
 // console.log('🔵 ngOnInit finished');
}

  initForm(): void {
    this.userForm = this.formBuilder.group({
      fio: ['', Validators.required],
      login: ['', Validators.required],
      email: ['', Validators.email],
      position_id: [null],  // 🟢 ИЗМЕНЕНО: теперь position_id вместо position
      department: [''],
      password: [''],
      isAdmin: [false]
    });
  }

  loadRoles(): void {
    this.adminService.getRoles().subscribe({
      next: (roles) => { this.allRoles = roles; },
      error: (err) => console.error('Ошибка загрузки ролей:', err)
    });
  }

  loadUsers(): void {
    this.adminService.getUsers().subscribe({
      next: (data) => { this.users = data; },
      error: (error) => console.error('Ошибка загрузки пользователей:', error)
    });
  }

   // 🟢 НОВОЕ: загрузка должностей
loadPositions(): void {
  //console.log('🔵 1. loadPositions() вызван');
  this.adminService.getPositions().subscribe({
    next: (res: any) => {
      //console.log('🟢 2. Ответ от API получен:', res);
      //console.log('🟢 3. res.data:', res?.data);
      this.positionsList = res.data || [];
      //console.log('🟢 4. positionsList после присвоения:', this.positionsList);
      //console.log('🟢 5. Длина positionsList:', this.positionsList.length);
    },
    error: (err) => {
      //console.error('🔴 2. Ошибка API:', err);
      this.positionsList = [];
    }
  });
}

loadAccessLevels(): void {
  this.adminService.getAccessLevels().subscribe({
    next: (levels) => {
      this.accessLevelsList = levels;
      console.log('=== УРОВНИ ДОСТУПА ===');
      console.log('Загружено уровней:', this.accessLevelsList.length);
      console.log('Данные:', this.accessLevelsList);
    },
    error: (err) => console.error('Ошибка загрузки уровней доступа:', err)
  });
}

getLevelIcon(code: string): string {
  const icons: Record<string, string> = {
    'PUBLIC': '🌐',
    'INTERNAL': '🏢',
    'CONFIDENTIAL': '🔒',
    'SECRET': '🔐',
    'TOP_SECRET': '🛡️'
  };
  return icons[code] || '🔓';
}

getLevelClass(code: string): string {
  const classMap: Record<string, string> = {
    'PUBLIC': 'level-public',
    'INTERNAL': 'level-internal',
    'CONFIDENTIAL': 'level-confidential',
    'SECRET': 'level-secret',
    'TOP_SECRET': 'level-top_secret'
  };
  return classMap[code] || 'level-default';
}
  openAddForm(): void {
    this.editingId = null;
    this.selectedUserRoles = [];
    this.selectedAccessLevels = []; 
    this.userForm.reset({ isAdmin: false, position_id: null }); // 🟢 значение по умолчанию
    this.userForm.get('password')?.setValidators(Validators.required);
    this.userForm.get('password')?.updateValueAndValidity();
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.userForm.reset();
    this.editingId = null;
    this.selectedUserRoles = [];
    this.selectedAccessLevels = [];
  }
private syncAccessLevels(userId: string): void {
  // Удаляем старые связи
  this.adminService.removeAllUserAccessLevels(userId).subscribe({
    next: () => {
      // Добавляем новые
      for (const levelId of this.selectedAccessLevels) {
        this.adminService.addUserAccessLevel(userId, levelId).subscribe();
      }
    },
    error: (err: any) => console.error('Ошибка обновления уровней доступа:', err)
  });
}
  saveUser(): void {
    if (this.userForm.invalid) return;

    const data: any = { ...this.userForm.value };
    // Не отправляем пустой пароль при редактировании
    if (!data.password) delete data.password;

    if (this.editingId) {
      this.adminService.updateUser(this.editingId, data).subscribe({
        next: (updated) => {
          this.syncRoles(updated.id || this.editingId!);
          this.syncAccessLevels(updated.id || this.editingId!);
          this.loadUsers();
          this.closeForm();
        },
        error: (error) => console.error('Ошибка обновления пользователя:', error)
      });
    } else {
      this.adminService.createUser(data).subscribe({
        next: (created) => {
          if (this.selectedUserRoles.length > 0) {
            this.syncRoles(created.id);
          }
          if (this.selectedAccessLevels.length > 0) {  // 🟢 ДОБАВИТЬ
         this.syncAccessLevels(created.id);
        }
          this.loadUsers();
          this.closeForm();
        },
        error: (error) => console.error('Ошибка создания пользователя:', error)
      });
    }
  }

  private syncRoles(userId: string): void {
    // Удаляем все старые роли, назначаем новые
    const user = this.users.find(u => u.id === userId);
    const oldRoles: string[] = (user?.roles || []).map((r: any) => r.id);
    for (const roleId of oldRoles) {
      this.adminService.removeRoleFromUser(userId, roleId).subscribe();
    }
    for (const roleId of this.selectedUserRoles) {
      this.adminService.assignRoleToUser(userId, roleId).subscribe();
    }
  }

  editUser(user: any): void {
    this.editingId = user.id;
    this.selectedUserRoles = (user.roles || []).map((r: any) => r.id);
    this.selectedAccessLevels = (user.access_levels || []).map((l: any) => l.id);  
    this.userForm.patchValue({
      fio: user.fio,
      login: user.login,
      email: user.email || '',
      position_id: user.position_id || null,  // 🟢 ИЗМЕНЕНО: используем position_id
      department: user.department || '',
      password: '',
      isAdmin: user.is_admin || false
    });
    // Пароль необязателен при редактировании
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.showForm = true;
  }

  toggleUserActive(user: any): void {
    const action = user.is_active ? 'деактивировать' : 'активировать';
    if (confirm(`Вы уверены, что хотите ${action} пользователя ${user.fio}?`)) {
      this.adminService.deactivateUser(user.id).subscribe({
        next: (res: any) => {
          user.is_active = res.is_active;
        },
        error: (error) => console.error('Ошибка изменения статуса пользователя:', error)
      });
    }
  }
}
