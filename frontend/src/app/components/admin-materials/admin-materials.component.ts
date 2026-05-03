import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MaterialService } from '../../services/material.service';
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';

declare var Quill: any;

@Component({
  selector: 'app-admin-materials',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="admin-container">
      <nav class="sidebar">
        <div class="logo">LMS Admin</div>
        <ul class="menu">
          <li><a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">📊 Панель управления</a></li>
          <li><a routerLink="/admin/courses" routerLinkActive="active">📚 Курсы</a></li>
          <li><a routerLink="/admin/materials" routerLinkActive="active">📄 Материалы и документация</a></li>
          <li><a routerLink="/admin/users" routerLinkActive="active">👥 Пользователи</a></li>
          <li><a routerLink="/admin/progress" routerLinkActive="active">📈 Прогресс обучения</a></li>
          <li><a routerLink="/admin/audit" routerLinkActive="active">🧾 Журнал аудита</a></li>
          <li class="logout"><a (click)="logout()">🚪 Выход</a></li>
        </ul>
      </nav>
      
      <div class="main-content">
        <header>
          <h1>Управление материалами и документацией</h1>
        </header>

        <div class="materials-section">
          <!-- Форма создания/редактирования материала -->
          <div class="create-material-form">
            <h2>{{ editingMaterial ? 'Редактировать' : 'Создать новый' }} материал</h2>
            <form (ngSubmit)="saveMaterial()">
              <div class="form-group">
                <label>Название *</label>
                <input type="text" [(ngModel)]="currentMaterial.title" name="title" required>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Тип материала *</label>
                  <select [(ngModel)]="currentMaterial.material_type" name="material_type" required (change)="onTypeChange()">
                    <option value="learning">📚 Обучающий материал</option>
                    <option value="documentation">📄 Документация</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Курс {{ currentMaterial.material_type === 'learning' ? '*' : '(опционально)' }}</label>
                  <select [(ngModel)]="currentMaterial.course_id" name="course_id"
                          [required]="currentMaterial.material_type === 'learning'">
                    <option value="">Выберите курс</option>
                    <option *ngFor="let course of courses" [value]="course.id">{{ course.title }}</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Гриф (уровень доступа)</label>
                  <select [(ngModel)]="currentMaterial.access_level_code" name="access_level" (change)="onAccessLevelChange()">
                    <option value="PUBLIC">🌐 Публичный</option>
                    <option value="INTERNAL">🏢 Внутренний</option>
                    <option value="CONFIDENTIAL">🔒 Конфиденциально</option>
                    <option value="SECRET">🔐 Секретно</option>
                    <option value="TOP_SECRET">🛡️ Совершенно секретно</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Статус</label>
                  <select [(ngModel)]="currentMaterial.status" name="status">
                    <option value="draft">Черновик</option>
                    <option value="published">Опубликован</option>
                  </select>
                </div>
              </div>

              <div class="form-group rule-sets-block">
                <label>Наборы правил доступа (ABAC)</label>
                <p class="hint-text">
                  Достаточно выполнения <strong>хотя бы одного</strong> набора. Для каждого атрибута включите «Проверять»,
                  если он должен совпадать с профилем пользователя; иначе поле игнорируется.
                  Если наборов нет — используется прежняя логика (связи ролей материала и полей ниже).
                </p>
                <button type="button" class="btn-add-rule" (click)="addAccessRuleSet()">+ Добавить набор</button>
                <table class="rule-sets-table" *ngIf="accessRuleSets.length > 0">
                  <thead>
                    <tr>
                      <th>Роль</th>
                      <th>Проверять роль</th>
                      <th>Гриф</th>
                      <th>Проверять гриф</th>
                      <th>Должность</th>
                      <th>Проверять должность</th>
                      <th>Ответственный</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of accessRuleSets; let i = index">
                      <td>
                        <select [(ngModel)]="row.role" [name]="'ars_role_' + i" class="form-control compact-select">
                          <option value="">—</option>
                          <option *ngFor="let role of roles" [value]="role.name">{{ role.description || role.name }}</option>
                        </select>
                      </td>
                      <td class="cell-center">
                        <input type="checkbox" [(ngModel)]="row.role_required" [name]="'ars_rr_' + i">
                      </td>
                      <td>
                        <select [(ngModel)]="row.classification" [name]="'ars_cl_' + i" class="form-control compact-select">
                          <option value="">—</option>
                          <option value="PUBLIC">Публичный</option>
                          <option value="INTERNAL">Внутренний</option>
                          <option value="CONFIDENTIAL">Конфиденциально</option>
                          <option value="SECRET">Секретно</option>
                          <option value="TOP_SECRET">Совершенно секретно</option>
                        </select>
                      </td>
                      <td class="cell-center">
                        <input type="checkbox" [(ngModel)]="row.classification_required" [name]="'ars_cr_' + i">
                      </td>
                      <td>
                        <select [(ngModel)]="row.position" [name]="'ars_pos_' + i" class="form-control compact-select">
                          <option value="">—</option>
                          <option *ngFor="let position of positionsList" [value]="position.id">{{ position.name }}</option>
                        </select>
                      </td>
                      <td class="cell-center">
                        <input type="checkbox" [(ngModel)]="row.position_required" [name]="'ars_pr_' + i">
                      </td>
                      <td>
                        <select [(ngModel)]="row.responsible_user_id" [name]="'ars_resp_' + i" class="form-control compact-select">
                          <option value="">— общий ответственный материала —</option>
                          <option *ngFor="let user of usersList" [value]="user.id">{{ user.fio }}</option>
                        </select>
                      </td>
                      <td>
                        <button type="button" class="btn-remove-rule" (click)="removeAccessRuleSet(i)">×</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Поля отдела и должности — обязательны для документации с грифом -->
              <div *ngIf="currentMaterial.material_type === 'documentation' && currentMaterial.access_level_code !== 'PUBLIC'" class="form-row classified-fields">
                <div class="form-group">
                  <label>Отдел (обязательно для документации с грифом) *</label>
                  <input type="text" [(ngModel)]="deptInput" name="required_department"
                         placeholder="Например: Бухгалтерия" required>
                  <small class="hint-text">Введите отдел и нажмите +</small>
                  <div class="tags-row">
                    <span *ngFor="let d of currentMaterial.required_departments" class="tag">
                      {{ d }} <button type="button" (click)="removeDept(d)">×</button>
                    </span>
                    <button type="button" class="btn-add-tag" (click)="addDept()">+ Добавить</button>
                  </div>
                </div>
                <div class="form-group">
                  <label>Должность (обязательно для документации с грифом) *</label>
                  <select class="form-control" (change)="onPositionSelect($event)">
                    <option [value]="null">— Выберите должность —</option>
                    <option *ngFor="let position of positionsList" [value]="position.id">
                      {{ position.name }} (важность: {{ position.importance }})
                    </option>
                  </select>
                  <div class="tags-row">
                    <span *ngFor="let p of currentMaterial.required_positions" class="tag">
                      {{ getPositionNameById(p) || p }} 
                      <button type="button" (click)="removePos(p)">×</button>
                    </span>
                  </div>
                  <small class="hint-text">Выберите должность из списка и нажмите +</small>
                </div>
                <div class="form-group" *ngIf="currentMaterial.material_type === 'documentation'">
                  <label>Ответственный за материал (общий) *</label>
                  <select [(ngModel)]="currentMaterial.responsible_user_id" name="responsible_user_id" class="form-control" required>
                    <option [value]="null">— Выберите ответственного —</option>
                    <option *ngFor="let user of usersList" [value]="user.id">
                      {{ user.fio }} ({{ user.position || 'без должности' }})
                    </option>
                  </select>
                  <small class="hint-text">Используется для наборов правил без своего ответственного и для напоминаний.</small>
                </div>
                <div class="form-group" *ngIf="currentMaterial.material_type === 'documentation'">
                  <label>Срок ознакомления (дедлайн)</label>
                  <input type="datetime-local" [(ngModel)]="passwordExpiresInput" name="password_expires_at" class="form-control">
                  <small class="hint-text">До этой даты сотрудники должны открыть документ; по графику ответственному приходят напоминания.</small>
                </div>
</div>
              <!-- Пароль доступа — если задан, пользователь может разблокировать материал паролем -->
              <div class="form-group" *ngIf="currentMaterial.access_level_code !== 'PUBLIC'">
                <label>🔑 Пароль доступа <span class="hint">(необязательно — позволяет пройти ABAC по паролю)</span></label>
                <input type="password" [(ngModel)]="currentMaterial.access_password" name="access_password"
                       placeholder="Оставьте пустым, чтобы не менять / убрать пароль">
                <small class="hint-text">Если заполнено — пароль будет сохранён (перезапишет прежний). Пустое поле при редактировании — пароль не меняется.</small>
              </div>

              <div class="form-group">
                <label>Описание</label>
                <textarea [(ngModel)]="currentMaterial.description" name="description" rows="3"></textarea>
              </div>



              <!-- Поле содержимого с Rich Text Editor (Quill) -->
              <div class="form-group">
                <label>Содержимое (форматированный текст)</label>
                <div class="editor-toolbar">
                  <button type="button" class="tb-btn" (click)="execFormat('bold')" title="Жирный"><b>Ж</b></button>
                  <button type="button" class="tb-btn" (click)="execFormat('italic')" title="Курсив"><i>К</i></button>
                  <button type="button" class="tb-btn" (click)="execFormat('underline')" title="Подчёркнутый"><u>П</u></button>
                  <select class="tb-select" (change)="execFontSize($event)" title="Размер шрифта">
                    <option value="">Размер</option>
                    <option value="1">Маленький</option>
                    <option value="3">Обычный</option>
                    <option value="5">Большой</option>
                    <option value="7">Очень большой</option>
                  </select>
                  <input type="color" class="tb-color" (change)="execColor($event)" title="Цвет текста">
                  <button type="button" class="tb-btn" (click)="insertImage()" title="Вставить картинку">🖼️</button>
                  <input #imageFileInput type="file" accept="image/*" style="display:none" (change)="onImageFileSelected($event)">
                </div>
                <div #quillEditor
                     class="rich-editor"
                     contenteditable="true"
                     (input)="onEditorInput()"
                     [innerHTML]="editorHtml"></div>
              </div>

              <!-- Прикрепление файлов -->
              <div class="form-group">
                <label>Прикрепить файлы</label>
                <div class="file-upload-area">
                  <input type="file" multiple (change)="onFilesSelected($event)" class="file-input" id="fileInput">
                  <label for="fileInput" class="file-label">📎 Выберите файлы для прикрепления</label>
                </div>

                <!-- Очередь на загрузку -->
                <div *ngIf="pendingFiles.length > 0" class="pending-files">
                  <p class="files-title">Будут загружены после сохранения:</p>
                  <div *ngFor="let f of pendingFiles; let i = index" class="file-item pending">
                    📄 {{ f.name }} ({{ formatFileSize(f.size) }})
                    <button type="button" class="btn-remove-file" (click)="removePendingFile(i)">×</button>
                  </div>
                </div>

                <!-- Уже прикреплённые файлы -->
                <div *ngIf="attachedFiles.length > 0" class="attached-files">
                  <p class="files-title">Прикреплённые файлы:</p>
                  <div *ngFor="let f of attachedFiles" class="file-item">
                    📄 <a href="{{ f.file_path }}" target="_blank">{{ f.filename }}</a>
                    ({{ formatFileSize(f.file_size) }})
                    <button type="button" class="btn-remove-file" (click)="deleteAttachedFile(f.id)">🗑️</button>
                  </div>
                </div>
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary">
                  {{ editingMaterial ? '💾 Сохранить' : '✨ Создать' }}
                </button>
                <button type="button" class="btn btn-secondary" *ngIf="editingMaterial" (click)="cancelEdit()">
                  ❌ Отмена
                </button>
              </div>
            </form>
          </div>

          <!-- Список материалов -->
          <div class="materials-list">
            <h2>Существующие материалы</h2>
            
            <div class="filter-tabs">
              <button [class.active]="filterType === 'all'" (click)="filterType = 'all'; loadMaterials()">
                Все ({{ allMaterials.length }})
              </button>
              <button [class.active]="filterType === 'learning'" (click)="filterType = 'learning'; loadMaterials()">
                📚 Обучающие ({{ learningCount }})
              </button>
              <button [class.active]="filterType === 'documentation'" (click)="filterType = 'documentation'; loadMaterials()">
                📄 Документация ({{ documentationCount }})
              </button>
            </div>

            <div class="materials-grid">
              <div *ngFor="let material of filteredMaterials" class="material-card">
                <div class="material-header">
                  <span class="material-type">
                    {{ material.material_type === 'learning' ? '📚' : '📄' }}
                    {{ material.material_type === 'learning' ? 'Обучение' : 'Документация' }}
                  </span>
                  <span class="access-badge" [ngClass]="'level-' + material.access_level_code">
                    {{ getAccessLevelLabel(material.access_level_code) }}
                  </span>
                </div>
                <h3>{{ material.title }}</h3>
                <p class="description">{{ material.description }}</p>
                <div class="material-meta">
                  <span class="status" [ngClass]="material.status">
                    {{ material.status === 'published' ? '✅ Опубликован' : '📝 Черновик' }}
                  </span>
                  <span class="course" *ngIf="material.course_title">
                    📚 {{ material.course_title }}
                  </span>
                  <!-- 🟢 СЮДА ДОБАВЬТЕ СТРОКУ ДЛЯ ОТВЕТСТВЕННОГО -->
<span class="responsible" *ngIf="(material.responsible_user_id || material.responsible_leader) && material.material_type === 'documentation'">
  👤 Ответственный: {{ getResponsibleName(material.responsible_user_id || material.responsible_leader) }}
</span>
                </div>
                <div class="material-actions">
                  <button class="btn-edit" (click)="editMaterial(material)">✏️ Редактировать</button>
                  <button class="btn-delete" (click)="deleteMaterial(material.id)">🗑️ Удалить</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./admin-materials.component.css']
})
export class AdminMaterialsComponent implements OnInit, AfterViewInit {
  @ViewChild('quillEditor') quillEditorRef!: ElementRef;
  @ViewChild('imageFileInput') imageFileInputRef!: ElementRef;

  allMaterials: any[] = [];
  filteredMaterials: any[] = [];
  positionsList: any[] = [];  // 🟢 ДОБАВИТЬ: список должностей
  usersList: any[] = [];        // 🟢 ДОБАВИТЬ ЗДЕСЬ (список пользователей-руководителей)
  courses: any[] = [];
  roles: any[] = [];
  accessRuleSets: Array<{
    role: string;
    classification: string;
    position: string;
    role_required: boolean;
    classification_required: boolean;
    position_required: boolean;
    responsible_user_id: string;
  }> = [];
  passwordExpiresInput = '';
  filterType: string = 'all';
  pendingFiles: File[] = [];
  attachedFiles: any[] = [];
  editorHtml: string = '';
  deptInput: string = '';
  posInput: string = '';

  currentMaterial: any = {
    title: '',
    description: '',
    content: '',
    material_type: 'learning',
    course_id: '',
    access_level_code: 'PUBLIC',
    status: 'draft',
    required_departments: [],
    required_positions: [],
     responsible_user_id: null as string | null,
     responsible_leader: null as string | null
  };

  editingMaterial: boolean = false;

  constructor(
    private materialService: MaterialService,
    private courseService: CourseService,
    private authService: AuthService,
    private adminService: AdminService,
    private http: HttpClient,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCourses();
    this.loadMaterials();
    this.loadRoles();
    this.loadPositions();  // 🟢 ДОБАВИТЬ
    this.loadResponsibleUsers(); 
  }

  ngAfterViewInit(): void {
    // Редактор инициализируется при наличии DOM-элемента
  }

  get learningCount(): number {
    return this.allMaterials.filter(m => m.material_type === 'learning').length;
  }

  get documentationCount(): number {
    return this.allMaterials.filter(m => m.material_type === 'documentation').length;
  }

  getAccessLevelLabel(code: string): string {
    const labels: Record<string, string> = {
      PUBLIC: 'Публичный',
      INTERNAL: 'Внутренний',
      CONFIDENTIAL: 'Конфиденциально',
      SECRET: 'Секретно',
      TOP_SECRET: 'Совершенно секретно'
    };
    return labels[code || ''] || code || 'Публичный';
  }

  
  onTypeChange(): void {
    if (this.currentMaterial.material_type === 'documentation') {
      this.currentMaterial.course_id = '';
    }
  }

  onAccessLevelChange(): void {
    if (this.currentMaterial.access_level_code === 'PUBLIC') {
      this.currentMaterial.required_departments = [];
      this.currentMaterial.required_positions = [];
    }
  }

  addAccessRuleSet(): void {
    this.accessRuleSets.push({
      role: '',
      classification: this.currentMaterial.access_level_code && this.currentMaterial.access_level_code !== 'PUBLIC'
        ? this.currentMaterial.access_level_code
        : '',
      position: '',
      role_required: false,
      classification_required: false,
      position_required: false,
      responsible_user_id: ''
    });
  }

  removeAccessRuleSet(index: number): void {
    this.accessRuleSets.splice(index, 1);
  }

  addDept(): void {
    const v = this.deptInput.trim();
    if (v && !this.currentMaterial.required_departments.includes(v)) {
      this.currentMaterial.required_departments = [...this.currentMaterial.required_departments, v];
    }
    this.deptInput = '';
  }

  removeDept(d: string): void {
    this.currentMaterial.required_departments = this.currentMaterial.required_departments.filter((x: string) => x !== d);
  }

  addPos(): void {
    const v = this.posInput.trim();
    if (v && !this.currentMaterial.required_positions.includes(v)) {
      this.currentMaterial.required_positions = [...this.currentMaterial.required_positions, v];
    }
    this.posInput = '';
  }
getPositionNameById(positionId: string): string {
  const position = this.positionsList.find(p => p.id === positionId);
  return position ? `${position.name} (важность: ${position.importance})` : positionId;
}

// Обработчик выбора должности из выпадающего списка
onPositionSelect(event: any): void {
  const positionId = event.target.value;
  if (positionId && !this.currentMaterial.required_positions.includes(positionId)) {
    this.currentMaterial.required_positions = [...this.currentMaterial.required_positions, positionId];
  }
  // Сбросить select
  event.target.value = null;
}
removePos(p: string): void {
  this.currentMaterial.required_positions = this.currentMaterial.required_positions.filter((x: string) => x !== p);
}


getResponsibleName(userId: string): string {
  const user = this.usersList.find(u => u.id === userId);
  return user ? `${user.fio} (${user.position || 'сотрудник'})` : userId;
}

  // ---- Toolbar actions (execCommand) ----
  execFormat(cmd: string): void {
    this.quillEditorRef?.nativeElement.focus();
    document.execCommand(cmd, false);
  }

  execFontSize(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (val) {
      this.quillEditorRef?.nativeElement.focus();
      document.execCommand('fontSize', false, val);
    }
    (event.target as HTMLSelectElement).value = '';
  }

  execColor(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.quillEditorRef?.nativeElement.focus();
    document.execCommand('foreColor', false, color);
  }

  onEditorInput(): void {
    // Синхронизируем HTML из contenteditable
  }

  // ---- Image insertion ----
  insertImage(): void {
    this.imageFileInputRef?.nativeElement.click();
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('image', file);
    this.http.post<{ url: string }>('/api/materials/upload-image', formData).subscribe({
      next: (res) => {
        const el = this.quillEditorRef?.nativeElement;
        if (el) {
          el.focus();
          document.execCommand('insertImage', false, res.url);
        }
        input.value = '';
      },
      error: (err) => {
        alert('Ошибка загрузки изображения');
        console.error(err);
        input.value = '';
      }
    });
  }

  // ---- File attachment ----
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.pendingFiles = [...this.pendingFiles, ...Array.from(input.files)];
      input.value = '';
    }
  }

  removePendingFile(index: number): void {
    this.pendingFiles.splice(index, 1);
  }

  deleteAttachedFile(fileId: string): void {
    if (confirm('Удалить файл?')) {
      this.materialService.deleteFile(fileId).subscribe({
        next: () => {
          this.attachedFiles = this.attachedFiles.filter((f: any) => f.id !== fileId);
        },
        error: (err) => console.error('Ошибка удаления файла:', err)
      });
    }
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' байт';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  private uploadPendingFiles(materialId: string): void {
    for (const file of this.pendingFiles) {
      this.materialService.uploadFile(materialId, file).subscribe({
        next: (f) => {
          this.attachedFiles.push(f);
        },
        error: (err) => console.error('Ошибка загрузки файла:', err)
      });
    }
    this.pendingFiles = [];
  }

  loadRoles(): void {
    this.adminService.getRoles().subscribe({
      next: (roles) => { this.roles = roles; },
      error: (err) => console.error('Ошибка загрузки ролей:', err)
    });
  }

  loadCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (courses) => { this.courses = courses; },
      error: (error) => console.error('Ошибка загрузки курсов:', error)
    });
  }

  loadMaterials(): void {
    this.materialService.getMaterials().subscribe({
      next: (materials) => {
        this.allMaterials = materials;
        this.applyFilter();
      },
      error: (error) => console.error('Ошибка загрузки материалов:', error)
    });
  }

loadPositions(): void {
  this.adminService.getPositions().subscribe({
    next: (res: any) => {
      this.positionsList = res.data || [];
    },
    error: (err) => {
      console.error('Ошибка загрузки должностей:', err);
      this.positionsList = [];
    }
  });
}
loadResponsibleUsers(): void {
  this.adminService.getUsers().subscribe({
    next: (users: any[]) => {
      // Показываем всех активных пользователей
      this.usersList = users.filter(user => user.is_active === true);
      console.log('Всего пользователей для выбора:', this.usersList.length);
    },
    error: (err) => {
      console.error('Ошибка загрузки пользователей:', err);
      this.usersList = [];
    }
  });
}
  applyFilter(): void {
    if (this.filterType === 'all') {
      this.filteredMaterials = this.allMaterials;
    } else {
      this.filteredMaterials = this.allMaterials.filter(m => m.material_type === this.filterType);
    }
  }

  saveMaterial(): void {
    if (this.currentMaterial.material_type === 'documentation') {
      if (!this.currentMaterial.responsible_user_id && !this.currentMaterial.responsible_leader) {
        alert('Для документации необходимо выбрать ответственного за материал!');
        return;
      }
    }
    // Получаем HTML из редактора
    const editorEl = this.quillEditorRef?.nativeElement;
    if (editorEl) {
      this.currentMaterial.content = editorEl.innerHTML;
    }

    if (this.currentMaterial.material_type === 'documentation') {
      this.currentMaterial.course_id = this.currentMaterial.course_id || null;
    }

    const access_rule_sets = this.accessRuleSets.map((row) => ({
      role: row.role?.trim() || null,
      classification: row.classification?.trim() || null,
      position: row.position?.trim() || null,
      role_required: !!row.role_required,
      classification_required: !!row.classification_required,
      position_required: !!row.position_required,
      responsible_user_id: row.responsible_user_id?.trim() || null
    }));
    const rid = this.currentMaterial.responsible_user_id || null;
    const payload: any = {
      ...this.currentMaterial,
      access_rule_sets,
      responsible_user_id: rid,
      responsible_leader: rid || this.currentMaterial.responsible_leader || null,
      password_expires_at: this.passwordExpiresInput
        ? new Date(this.passwordExpiresInput).toISOString()
        : null
    };

    const save$ = this.editingMaterial
      ? this.materialService.updateMaterial(this.currentMaterial.id, payload)
      : this.materialService.createMaterial(payload);

    save$.subscribe({
      next: (saved: any) => {
        const materialId = saved?.id || this.currentMaterial.id;

        // Загружаем файлы
        if (this.pendingFiles.length > 0) {
          this.uploadPendingFiles(materialId);
        }

        alert(this.editingMaterial ? 'Материал успешно обновлён!' : 'Материал успешно создан!');
        this.resetForm();
        this.loadMaterials();
      },
      error: (error) => {
        console.error('Ошибка сохранения материала:', error);
        alert('Ошибка при сохранении материала');
      }
    });
  }

  editMaterial(material: any): void {
    this.currentMaterial = {
      ...material,
      required_departments: Array.isArray(material.required_departments) ? material.required_departments : [],
      required_positions: Array.isArray(material.required_positions) ? material.required_positions : []
    };
    let ars = material.access_rule_sets;
    if (typeof ars === 'string') {
      try {
        ars = JSON.parse(ars);
      } catch {
        ars = [];
      }
    }
    this.accessRuleSets = Array.isArray(ars)
      ? ars.map((r: any) => ({
          role: r.role || '',
          classification: r.classification || '',
          position: r.position || '',
          role_required: !!r.role_required,
          classification_required: !!r.classification_required,
          position_required: !!r.position_required,
          responsible_user_id: r.responsible_user_id || ''
        }))
      : [];
    this.currentMaterial.responsible_user_id =
      material.responsible_user_id || material.responsible_leader || null;
    this.passwordExpiresInput = material.password_expires_at
      ? this.toDatetimeLocalValue(String(material.password_expires_at))
      : '';
    this.editingMaterial = true;
    this.attachedFiles = material.files || [];
    this.pendingFiles = [];

    // Вставляем HTML в редактор
    setTimeout(() => {
      if (this.quillEditorRef?.nativeElement) {
        this.quillEditorRef.nativeElement.innerHTML = material.content || '';
      }
    }, 50);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteMaterial(id: string): void {
    if (confirm('Вы уверены, что хотите удалить этот материал?')) {
      this.materialService.deleteMaterial(id).subscribe({
        next: () => { alert('Материал удалён!'); this.loadMaterials(); },
        error: (error) => { console.error('Ошибка удаления материала:', error); alert('Ошибка при удалении материала'); }
      });
    }
  }

  cancelEdit(): void { this.resetForm(); }

  private toDatetimeLocalValue(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  resetForm(): void {
    this.currentMaterial = {
      title: '',
      description: '',
      content: '',
      material_type: 'learning',
      course_id: '',
      access_level_code: 'PUBLIC',
      status: 'draft',
      required_departments: [],
      required_positions: [],
      access_password: '',
      responsible_user_id: null,
      responsible_leader: null
    };
    this.passwordExpiresInput = '';
    this.editingMaterial = false;
    this.accessRuleSets = [];
    this.pendingFiles = [];
    this.attachedFiles = [];
    this.deptInput = '';
    this.posInput = '';
    if (this.quillEditorRef?.nativeElement) {
      this.quillEditorRef.nativeElement.innerHTML = '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
