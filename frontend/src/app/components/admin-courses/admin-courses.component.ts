import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CourseService } from '../../services/course.service';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-courses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="admin-courses">
      <div class="breadcrumb">
        <a routerLink="/admin">← Панель управления</a>
      </div>
      
      <h2>Управление курсами</h2>

      <div class="action-buttons">
        <button (click)="toggleForm()" class="btn btn-primary">+ Добавить новый курс</button>
      </div>

      <form *ngIf="showForm" [formGroup]="courseForm" (ngSubmit)="saveCourse()" class="form-section">
        <div class="form-group">
          <label>Название курса *</label>
          <input type="text" formControlName="title" class="form-control" placeholder="Введите название курса">
        </div>
        <div class="form-group">
          <label>Описание</label>
          <textarea formControlName="description" class="form-control" placeholder="Введите описание курса" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Статус</label>
          <select formControlName="status" class="form-control">
            <option value="draft">Черновик</option>
            <option value="published">Опубликован</option>
            <option value="archived">Архивирован</option>
          </select>
        </div>

        <!-- 🟢 НОВОЕ ПОЛЕ: Ответственный руководитель -->
        <div class="form-group">
          <label>Ответственный руководитель</label>
          <select formControlName="responsible_leader" class="form-control">
            <option [value]="null">— Не выбран —</option>
            <option *ngFor="let user of usersList" [value]="user.id">
              {{ user.fio }} ({{ user.position || 'без должности' }})
            </option>
          </select>
          <small class="hint-text">Ответственный будет видеть статистику по курсу в своем дашборде</small>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-success" [disabled]="courseForm.invalid">Сохранить курс</button>
          <button type="button" (click)="toggleForm()" class="btn btn-secondary">Отмена</button>
        </div>
      </form>

      <div class="courses-table">
        <table *ngIf="courses.length > 0" class="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Ответственный</th>
              <th>Статус</th>
              <th>Создан</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let course of courses">
              <td>{{ course.title }}</td>
              <td>
                <span *ngIf="getResponsibleName(course.responsible_leader); else noResponsible">
                  {{ getResponsibleName(course.responsible_leader) }}
                </span>
                <ng-template #noResponsible>—</ng-template>
              </td>
              <td><span class="badge" [ngClass]="course.status">{{ getStatusLabel(course.status) }}</span></td>
              <td>{{ course.created_at | date:'short' }}</td>
              <td>
                <button (click)="editCourse(course)" class="btn btn-sm btn-info">✏️ Редактировать</button>
                <button (click)="deleteCourse(course.id)" class="btn btn-sm btn-danger">🗑️ Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="courses.length === 0" class="no-data">Пока нет курсов</div>
      </div>
    </div>
  `,
  styles: [`
    .breadcrumb { margin-bottom: 15px; }
    .breadcrumb a { color: #667eea; text-decoration: none; font-size: 14px; }
    .breadcrumb a:hover { text-decoration: underline; }
    .admin-courses { padding: 20px; }
    h2 { margin-top: 0; color: #333; }
    .action-buttons { margin: 20px 0; }
    .form-section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; color: #555; font-weight: 500; }
    .form-control { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; }
    textarea.form-control { resize: vertical; }
    .form-actions { margin-top: 20px; }
    .btn { padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.3s; margin-right: 5px; }
    .btn-primary { background: #667eea; color: white; }
    .btn-primary:hover { background: #5568d3; }
    .btn-success { background: #4caf50; color: white; }
    .btn-success:disabled { background: #ccc; cursor: not-allowed; }
    .btn-secondary { background: #999; color: white; }
    .btn-info { background: #2196f3; color: white; padding: 5px 10px; font-size: 12px; }
    .btn-danger { background: #f44336; color: white; padding: 5px 10px; font-size: 12px; }
    .btn-sm { padding: 5px 10px; font-size: 12px; margin-right: 5px; }
    .courses-table { background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; margin: 0; }
    .table thead { background: #f5f5f5; border-bottom: 2px solid #ddd; }
    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    .table tr:hover { background: #f9f9f9; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 3px; font-size: 12px; color: white; }
    .badge.published { background: #4caf50; }
    .badge.draft { background: #ff9800; }
    .badge.archived { background: #999; }
    .no-data { text-align: center; padding: 40px; color: #999; }
    .hint-text { font-size: 11px; color: #999; margin-top: 5px; display: block; }
  `]
})
export class AdminCoursesComponent implements OnInit {
  courses: any[] = [];
  usersList: any[] = [];
  courseForm!: FormGroup;
  showForm = false;
  editingId: string | null = null;

  constructor(
    private courseService: CourseService,
    private adminService: AdminService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
    console.log('AdminCoursesComponent инициализирован');
    this.initForm();
    this.loadCourses();
    this.loadUsers();
  }

  initForm(): void {
    this.courseForm = this.formBuilder.group({
      title: ['', Validators.required],
      description: [''],
      status: ['draft'],
      responsible_leader: [null]  // 🟢 ДОБАВИТЬ поле
    });
  }

  loadCourses(): void {
    console.log('Загрузка курсов...');
    this.courseService.getCourses().subscribe({
      next: (data) => {
        console.log('Курсы загружены:', data.length, 'курсов');
        this.courses = data;
      },
      error: (error) => {
        console.error('Ошибка загрузки курсов:', error);
      }
    });
  }

  // 🟢 ДОБАВИТЬ загрузку пользователей
  loadUsers(): void {
    this.adminService.getUsers().subscribe({
      next: (users) => {
        this.usersList = users.filter((u: any) => u.is_active);
        console.log('Пользователи загружены:', this.usersList.length);
      },
      error: (err) => {
        console.error('Ошибка загрузки пользователей:', err);
        this.usersList = [];
      }
    });
  }

  // 🟢 ДОБАВИТЬ получение имени ответственного
  getResponsibleName(userId: string): string {
    const user = this.usersList.find(u => u.id === userId);
    return user ? `${user.fio} (${user.position || 'сотрудник'})` : '';
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.courseForm.reset({ status: 'draft', responsible_leader: null });
      this.editingId = null;
    }
  }

  saveCourse(): void {
    if (this.courseForm.invalid) return;

    const data = this.courseForm.value;
    console.log('Сохраняем курс:', data);

    if (this.editingId) {
      this.courseService.updateCourse(this.editingId, data).subscribe({
        next: () => {
          this.loadCourses();
          this.toggleForm();
          alert('Курс обновлен');
        },
        error: (error) => console.error('Ошибка обновления курса:', error)
      });
    } else {
      this.courseService.createCourse(data).subscribe({
        next: () => {
          this.loadCourses();
          this.toggleForm();
          alert('Курс создан');
        },
        error: (error) => console.error('Ошибка создания курса:', error)
      });
    }
  }

  editCourse(course: any): void {
    this.editingId = course.id;
    this.courseForm.patchValue({
      title: course.title,
      description: course.description || '',
      status: course.status || 'draft',
      responsible_leader: course.responsible_leader || null
    });
    this.showForm = true;
  }

  deleteCourse(id: string): void {
    if (confirm('Вы уверены, что хотите удалить этот курс?')) {
      this.courseService.deleteCourse(id).subscribe({
        next: () => this.loadCourses(),
        error: (error) => console.error('Ошибка удаления курса:', error)
      });
    }
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      published: 'Опубликован',
      draft: 'Черновик',
      archived: 'Архивирован'
    };
    return labels[status] || status;
  }
}