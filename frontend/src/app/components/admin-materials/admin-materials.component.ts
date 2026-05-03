import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MaterialService } from '../../services/material.service';
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { DepartmentStoreService } from '../../services/department-store.service';

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
          <li><a routerLink="/admin/progress" routerLinkActive="active">📊 Прогресс пользователей</a></li>
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
                  <label>Курс{{ currentMaterial.material_type === 'learning' ? ' *' : '' }}</label>
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
                    <option *ngFor="let lv of accessLevelsList" [value]="lv.code">{{ lv.name }}</option>
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
                  Для документации с грифом выше «Публичный» задайте хотя бы один набор (отдел, должность, ответственный, срок, пароль — по необходимости).
                  Если наборов нет — для фильтра списка документации используются поля материала «требуемые отделы/должности» (legacy).
                </p>
                <button type="button" class="btn-add-rule" (click)="addAccessRuleSet()">+ Добавить набор</button>
                <table class="rule-sets-table" *ngIf="accessRuleSets.length > 0">
                  <thead>
                    <tr>
                      <th>Роль</th>
                      <th>Проверять роль</th>
                      <th>Отдел</th>
                      <th>Проверять отдел</th>
                      <th>Гриф</th>
                      <th>Проверять гриф</th>
                      <th>Должность</th>
                      <th>Проверять должность</th>
                      <th>Ответственный</th>
                      <th>Срок ознакомления</th>
                      <th>Пароль доступа</th>
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
                        <select [(ngModel)]="row.department" [name]="'ars_dept_' + i" class="form-control compact-select">
                          <option value="">—</option>
                          <option *ngFor="let d of departmentsList" [value]="d">{{ d }}</option>
                        </select>
                      </td>
                      <td class="cell-center">
                        <input type="checkbox" [(ngModel)]="row.department_required" [name]="'ars_dr_' + i">
                      </td>
                      <td>
                        <select [(ngModel)]="row.classification" [name]="'ars_cl_' + i" class="form-control compact-select">
                          <option value="">—</option>
                          <option *ngFor="let lv of accessLevelsList" [value]="lv.code">{{ lv.name }}</option>
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
                          <option value="">— не задан —</option>
                          <option *ngFor="let user of usersList" [value]="user.id">{{ user.fio }}</option>
                        </select>
                      </td>
                      <td>
                        <input type="datetime-local" class="form-control compact-dt"
                               [(ngModel)]="row.deadline" [name]="'ars_dl_' + i">
                      </td>
                      <td>
                        <input type="password" class="form-control compact-pw" autocomplete="new-password"
                               [(ngModel)]="row.access_password" [name]="'ars_pwd_' + i"
                               [placeholder]="row._passwordSet ? 'Задан — введите новый для смены' : 'Необязательно'">
                      </td>
                      <td>
                        <button type="button" class="btn-remove-rule" (click)="removeAccessRuleSet(i)">×</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
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
                  <button type="button" class="tb-btn" (click)="resizeImageFromToolbar()" title="Размер выделенной картинки">📐</button>
                  <input #imageFileInput type="file" accept="image/*" style="display:none" (change)="onImageFileSelected($event)">
                </div>
                <div #quillEditor
                     class="rich-editor"
                     contenteditable="true"
                     (input)="onEditorInput()"
                     (dblclick)="onEditorDblClick($event)"
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
                    📄 <a href="#" class="file-link" role="button" (click)="openAttachedFile(f, $event)">{{ f.filename }}</a>
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
<span class="responsible" *ngIf="material.material_type === 'documentation' && firstRuleResponsibleLabel(material)">
  👤 Ответственный (ABAC): {{ firstRuleResponsibleLabel(material) }}
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
  accessLevelsList: any[] = [];
  accessRuleSets: Array<{
    id?: string;
    role: string;
    classification: string;
    position: string;
    department: string;
    role_required: boolean;
    classification_required: boolean;
    position_required: boolean;
    department_required: boolean;
    responsible_user_id: string;
    deadline: string;
    access_password: string;
    _passwordSet?: boolean;
  }> = [];
  filterType: string = 'all';
  pendingFiles: File[] = [];
  attachedFiles: any[] = [];
  editorHtml: string = '';
  /** Подсказки отделов с сервера (GET /api/admin/departments) */
  departmentsList: string[] = [];

  currentMaterial: any = {
    title: '',
    description: '',
    content: '',
    material_type: 'learning',
    course_id: '',
    access_level_code: 'PUBLIC',
    status: 'draft',
    required_departments: [] as string[],
    required_positions: [] as string[]
  };

  editingMaterial: boolean = false;

  constructor(
    private materialService: MaterialService,
    private courseService: CourseService,
    private authService: AuthService,
    private adminService: AdminService,
    private departmentStore: DepartmentStoreService,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.departmentStore.departments$.subscribe((d) => {
      this.departmentsList = d;
    });
    this.loadCourses();
    this.loadMaterials();
    this.loadRoles();
    this.loadAccessLevels();
    this.loadPositions();
    this.loadDepartments();
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
    const row = this.accessLevelsList?.find((a: any) => a.code === code);
    if (row?.name) {
      return row.name;
    }
    return code || 'Публичный';
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
    const cls = this.currentMaterial.access_level_code;
    const classification = cls && cls !== 'PUBLIC' ? String(cls) : '';
    this.accessRuleSets.push({
      role: '',
      classification,
      position: '',
      department: '',
      role_required: false,
      classification_required: !!classification,
      position_required: false,
      department_required: false,
      responsible_user_id: '',
      deadline: '',
      access_password: '',
      _passwordSet: false
    });
  }

  firstRuleResponsibleLabel(material: any): string {
    let ars = material?.access_rule_sets;
    if (typeof ars === 'string') {
      try {
        ars = JSON.parse(ars);
      } catch {
        return '';
      }
    }
    if (!Array.isArray(ars)) {
      return '';
    }
    const row = ars.find((x: any) => this.normalizeUserIdString(x?.responsible_user_id));
    return row ? this.getResponsibleName(String(row.responsible_user_id)) : '';
  }

  removeAccessRuleSet(index: number): void {
    this.accessRuleSets.splice(index, 1);
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
    const el = this.quillEditorRef?.nativeElement;
    if (el) {
      this.currentMaterial.content = el.innerHTML;
    }
  }

  // ---- Image insertion ----
  insertImage(): void {
    this.imageFileInputRef?.nativeElement.click();
  }

  private normalizeUserIdString(v: unknown): string | null {
    const s = v == null ? '' : String(v).trim();
    if (!s || s.toLowerCase() === 'null') {
      return null;
    }
    return s;
  }

  /** Двойной клик по картинке в редакторе — задать ширину/высоту. */
  onEditorDblClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    if (t?.tagName !== 'IMG') {
      return;
    }
    ev.preventDefault();
    this.openImageSizeDialog(t as HTMLImageElement);
  }

  resizeImageFromToolbar(): void {
    const el = this.quillEditorRef?.nativeElement as HTMLElement | undefined;
    if (!el) {
      return;
    }
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    if (node?.nodeType === Node.TEXT_NODE) {
      node = (node as Text).parentElement;
    }
    let cur: HTMLElement | null = node as HTMLElement | null;
    while (cur && cur !== el) {
      if (cur.tagName === 'IMG') {
        this.openImageSizeDialog(cur as HTMLImageElement);
        return;
      }
      cur = cur.parentElement;
    }
    alert('Выделите изображение в тексте или дважды щёлкните по нему.');
  }

  private openImageSizeDialog(img: HTMLImageElement): void {
    const defW = img.style.width || img.getAttribute('width') || '';
    const defH = img.style.height || img.getAttribute('height') || '';
    const w = window.prompt('Ширина (например 400px, 50% или пусто для авто):', defW);
    if (w === null) {
      return;
    }
    const h = window.prompt('Высота (пусто для авто):', defH);
    if (h === null) {
      return;
    }
    if (w.trim()) {
      img.style.width = w.trim();
      img.removeAttribute('width');
    } else {
      img.style.width = '';
      img.removeAttribute('width');
    }
    if (h.trim()) {
      img.style.height = h.trim();
      img.removeAttribute('height');
    } else {
      img.style.height = '';
      img.removeAttribute('height');
    }
    this.onEditorInput();
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.materialService.uploadImage(file).subscribe({
      next: (res) => {
        const el = this.quillEditorRef?.nativeElement;
        if (el) {
          el.focus();
          const url = this.materialService.resolveEditorImageUrl(res.url);
          document.execCommand('insertImage', false, url);
          this.onEditorInput();
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

  /** Открытие вложения: через API + JWT (blob), иначе прямой URL для старых записей без id. */
  openAttachedFile(f: { id?: string; filename?: string; file_path?: string }, event: Event): void {
    event.preventDefault();
    if (!f?.id) {
      window.open(this.resolveMediaUrl(f?.file_path || ''), '_blank', 'noopener,noreferrer');
      return;
    }
    this.materialService.downloadMaterialFile(f.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      },
      error: (err) => {
        console.error('openAttachedFile', err);
        alert('Не удалось открыть файл. Проверьте авторизацию и права доступа.');
      }
    });
  }

  resolveMediaUrl(u: string): string {
    if (!u) {
      return '#';
    }
    if (u.startsWith('http://') || u.startsWith('https://')) {
      return u;
    }
    const p = u.startsWith('/') ? u : `/${u}`;
    return `${window.location.origin}${p}`;
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

  loadAccessLevels(): void {
    const fallback = [
      { code: 'PUBLIC', name: 'Публичный' },
      { code: 'INTERNAL', name: 'Внутренний' },
      { code: 'CONFIDENTIAL', name: 'Конфиденциально' },
      { code: 'SECRET', name: 'Секретно' },
      { code: 'TOP_SECRET', name: 'Совершенно секретно' }
    ];
    this.adminService.getAccessLevels().subscribe({
      next: (rows: any[]) => {
        this.accessLevelsList = Array.isArray(rows) && rows.length > 0 ? rows : fallback;
      },
      error: (err) => {
        console.error('Ошибка загрузки грифов:', err);
        this.accessLevelsList = fallback;
      }
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

  loadDepartments(): void {
    this.departmentStore.refreshFromApi(this.adminService);
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
    if (
      this.currentMaterial.material_type === 'documentation' &&
      this.currentMaterial.access_level_code &&
      this.currentMaterial.access_level_code !== 'PUBLIC' &&
      this.accessRuleSets.length === 0
    ) {
      alert('Для документации с грифом добавьте хотя бы один набор правил ABAC (отдел, должность, ответственный и т.д.).');
      return;
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
      id: row.id || null,
      role: row.role?.trim() || null,
      classification: row.classification?.trim() || null,
      position: row.position?.trim() || null,
      department: row.department?.trim() || null,
      role_required: !!row.role_required,
      classification_required: !!row.classification_required,
      position_required: !!row.position_required,
      department_required: !!row.department_required,
      responsible_user_id: this.normalizeUserIdString(row.responsible_user_id),
      deadline:
        row.deadline && String(row.deadline).trim()
          ? new Date(row.deadline).toISOString()
          : null,
      access_password: row.access_password != null ? String(row.access_password) : ''
    }));

    const payload: any = {
      ...this.currentMaterial,
      access_rule_sets,
      responsible_user_id: null,
      responsible_leader: null,
      password_expires_at: null,
      access_password: null
    };

    if (this.currentMaterial.material_type === 'documentation') {
      payload.required_departments = [];
      payload.required_positions = [];
    }

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
          id: r.id || undefined,
          role: r.role || '',
          classification: r.classification || '',
          position: r.position || '',
          department: r.department || '',
          role_required: !!r.role_required,
          classification_required: !!r.classification_required,
          position_required: !!r.position_required,
          department_required: !!r.department_required,
          responsible_user_id: this.normalizeUserIdString(r.responsible_user_id) || '',
          deadline: r.deadline ? this.toDatetimeLocalValue(String(r.deadline)) : '',
          access_password: '',
          _passwordSet: !!r.password_is_set
        }))
      : [];
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
      required_positions: []
    };
    this.editingMaterial = false;
    this.accessRuleSets = [];
    this.pendingFiles = [];
    this.attachedFiles = [];
    if (this.quillEditorRef?.nativeElement) {
      this.quillEditorRef.nativeElement.innerHTML = '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
