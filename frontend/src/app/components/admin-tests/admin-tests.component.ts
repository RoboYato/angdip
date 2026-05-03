import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TestService } from '../../services/test.service';
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-tests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="admin-container">
      <nav class="sidebar">
        <div class="logo">LMS Admin</div>
        <ul class="menu">
          <li><a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">📊 Панель управления</a></li>
          <li><a routerLink="/admin/courses" routerLinkActive="active">📚 Курсы</a></li>
          <li><a routerLink="/admin/materials" routerLinkActive="active">📄 Материалы</a></li>
          <li><a routerLink="/admin/tests" routerLinkActive="active">📝 Тестирование</a></li>
          <li><a routerLink="/admin/users" routerLinkActive="active">👥 Пользователи</a></li>
          <li><a routerLink="/admin/progress" routerLinkActive="active">📈 Прогресс</a></li>
          <li><a routerLink="/admin/audit" routerLinkActive="active">🧾 Аудит</a></li>
          <li class="logout"><a (click)="logout()">🚪 Выход</a></li>
        </ul>
      </nav>

      <div class="main-content">
        <header>
          <h1>Управление тестами</h1>
        </header>

        <!-- Создать тест -->
        <div class="card" *ngIf="!editingTest">
          <h2>Создать новый тест</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Курс *</label>
              <select [(ngModel)]="newTest.courseId">
                <option value="">Выберите курс</option>
                <option *ngFor="let c of courses" [value]="c.id">{{ c.title }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Тип теста *</label>
              <select [(ngModel)]="newTest.testType">
                <option value="single_choice">Одиночный выбор</option>
                <option value="multiple_choice">Множественный выбор</option>
                <option value="text_input">Ввод текста</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Название теста *</label>
            <input type="text" [(ngModel)]="newTest.title" placeholder="Введите название теста">
          </div>
          <div class="form-group">
            <label>Описание</label>
            <textarea [(ngModel)]="newTest.description" rows="2" placeholder="Описание теста"></textarea>
          </div>
          <button class="btn btn-primary" (click)="createTest()" [disabled]="!newTest.courseId || !newTest.title">
            ✨ Создать тест
          </button>
        </div>

        <!-- Редактирование теста (добавление вопросов) -->
        <div class="card" *ngIf="editingTest">
          <div class="card-header">
            <h2>📝 {{ editingTest.title }}</h2>
            <button class="btn btn-secondary" (click)="closeEditor()">✕ Закрыть</button>
          </div>
          <p class="test-meta">
            Курс: <strong>{{ editingTest.course_title }}</strong> |
            Тип: <strong>{{ getTestTypeLabel(editingTest.test_type) }}</strong> |
            Вопросов: <strong>{{ editingTest.questions?.length || 0 }}</strong>
          </p>

          <!-- Список вопросов -->
          <div class="questions-list">
            <div class="question-card" *ngFor="let q of editingTest.questions; let qi = index">
              <div class="question-header">
                <span class="q-num">Вопрос {{ qi + 1 }}</span>
                <span class="q-type badge">{{ getTestTypeLabel(q.question_type) }}</span>
                <button class="btn-icon danger" (click)="deleteQuestion(q.id)" title="Удалить вопрос">🗑️</button>
              </div>
              <p class="q-text">{{ q.question_text }}</p>

              <!-- Варианты ответов -->
              <div class="answers-list">
                <div class="answer-item" *ngFor="let a of q.answers"
                     [class.correct]="a.is_correct">
                  <span class="answer-marker">{{ a.is_correct ? '✅' : '◻️' }}</span>
                  <span>{{ a.answer_text }}</span>
                </div>
                <div class="answer-item empty" *ngIf="!q.answers || q.answers.length === 0">
                  Нет вариантов ответов
                </div>
              </div>

              <!-- Добавить ответ -->
              <div class="add-answer">
                <input type="text" [(ngModel)]="newAnswerText[q.id]" placeholder="Текст ответа">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="newAnswerCorrect[q.id]"> Правильный
                </label>
                <button class="btn btn-small" (click)="addAnswer(q.id)"
                        [disabled]="!newAnswerText[q.id]">+ Ответ</button>
              </div>
            </div>
          </div>

          <!-- Добавить вопрос -->
          <div class="add-question">
            <h3>Добавить вопрос</h3>
            <div class="form-row">
              <div class="form-group flex-grow">
                <input type="text" [(ngModel)]="newQuestionText" placeholder="Текст вопроса">
              </div>
              <div class="form-group">
                <select [(ngModel)]="newQuestionType">
                  <option value="single_choice">Одиночный выбор</option>
                  <option value="multiple_choice">Множественный выбор</option>
                  <option value="text_input">Ввод текста</option>
                </select>
              </div>
              <button class="btn btn-primary" (click)="addQuestion()"
                      [disabled]="!newQuestionText">+ Добавить</button>
            </div>
          </div>
        </div>

        <!-- Список тестов -->
        <div class="card">
          <h2>Существующие тесты ({{ tests.length }})</h2>
          <div class="tests-list">
            <div class="test-item" *ngFor="let t of tests">
              <div class="test-info">
                <h3>{{ t.title }}</h3>
                <p>{{ t.description || 'Без описания' }}</p>
                <div class="test-meta">
                  <span class="badge course">📚 {{ t.course_title || 'Без курса' }}</span>
                  <span class="badge type">{{ getTestTypeLabel(t.test_type) }}</span>
                  <span class="badge">❓ {{ t.questions_count }} вопросов</span>
                  <span class="badge">📊 {{ t.attempts_count || 0 }} попыток</span>
                </div>
              </div>
              <div class="test-actions">
                <button class="btn btn-small btn-primary" (click)="openEditor(t)">✏️ Редактировать</button>
                <button class="btn btn-small btn-danger" (click)="deleteTest(t.id)">🗑️ Удалить</button>
              </div>
            </div>
            <div class="empty" *ngIf="tests.length === 0">
              Тестов пока нет. Создайте первый тест выше.
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-container { display: flex; height: 100vh; background: #f5f5f5; }
    .sidebar { width: 250px; background: #2c3e50; color: white; padding: 20px; flex-shrink: 0; }
    .logo { font-size: 20px; font-weight: bold; margin-bottom: 30px; text-align: center; }
    .menu { list-style: none; padding: 0; margin: 0; }
    .menu li { margin-bottom: 8px; }
    .menu a { display: block; padding: 10px 12px; color: white; text-decoration: none; border-radius: 4px; cursor: pointer; }
    .menu a:hover, .menu a.active { background: #34495e; }
    .menu .logout a { background: #e74c3c; margin-top: 20px; }
    .main-content { flex: 1; padding: 30px; overflow-y: auto; }
    header { margin-bottom: 20px; }
    h1 { margin: 0; color: #2c3e50; }
    .card { background: white; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,.08); }
    .card h2 { margin: 0 0 16px; color: #2c3e50; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .card-header h2 { margin: 0; }
    .form-row { display: flex; gap: 16px; }
    .form-group { margin-bottom: 14px; flex: 1; }
    .form-group.flex-grow { flex: 3; }
    .form-group label { display: block; margin-bottom: 6px; font-weight: 600; color: #555; font-size: 13px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 9px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
    .form-group textarea { resize: vertical; }
    .btn { padding: 10px 18px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #3498db; color: white; }
    .btn-primary:hover { background: #2980b9; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-secondary { background: #95a5a6; color: white; }
    .btn-danger { background: #e74c3c; color: white; }
    .btn-small { padding: 6px 12px; font-size: 13px; }
    .btn-icon { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px; }
    .btn-icon.danger:hover { background: #ffe0e0; border-radius: 4px; }

    .test-meta { color: #666; font-size: 13px; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; background: #ecf0f1; margin-right: 6px; }
    .badge.course { background: #ebf5fb; color: #2980b9; }
    .badge.type { background: #fef9e7; color: #f39c12; }

    .tests-list { }
    .test-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 10px; }
    .test-info h3 { margin: 0 0 4px; color: #2c3e50; }
    .test-info p { margin: 0 0 8px; color: #777; font-size: 13px; }
    .test-actions { display: flex; gap: 8px; flex-shrink: 0; }

    .questions-list { margin-bottom: 20px; }
    .question-card { border: 1px solid #ddd; border-radius: 6px; padding: 16px; margin-bottom: 12px; background: #fafafa; }
    .question-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .q-num { font-weight: 700; color: #2c3e50; }
    .q-text { margin: 0 0 12px; font-size: 15px; }
    .answers-list { margin-left: 16px; margin-bottom: 12px; }
    .answer-item { padding: 6px 10px; margin-bottom: 4px; border-radius: 4px; display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .answer-item.correct { background: #e8f8f5; color: #27ae60; font-weight: 500; }
    .answer-item.empty { color: #aaa; font-style: italic; }
    .answer-marker { font-size: 14px; }

    .add-answer { display: flex; gap: 8px; align-items: center; padding-top: 8px; border-top: 1px solid #eee; }
    .add-answer input[type="text"] { flex: 1; padding: 7px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
    .checkbox-label { display: flex; align-items: center; gap: 4px; font-size: 13px; white-space: nowrap; cursor: pointer; }
    .checkbox-label input { margin: 0; }

    .add-question { border-top: 2px solid #3498db; padding-top: 16px; margin-top: 8px; }
    .add-question h3 { margin: 0 0 12px; color: #2c3e50; }
    .add-question .form-row { align-items: end; }

    .empty { text-align: center; color: #999; padding: 30px; }
  `]
})
export class AdminTestsComponent implements OnInit {
  tests: any[] = [];
  courses: any[] = [];
  editingTest: any = null;

  newTest = { courseId: '', title: '', description: '', testType: 'single_choice' };
  newQuestionText = '';
  newQuestionType = 'single_choice';
  newAnswerText: { [qId: string]: string } = {};
  newAnswerCorrect: { [qId: string]: boolean } = {};

  constructor(
    private testService: TestService,
    private courseService: CourseService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTests();
    this.loadCourses();
  }

  loadTests(): void {
    this.testService.getAllTests().subscribe({
      next: (tests) => this.tests = tests || [],
      error: (err) => console.error('Ошибка загрузки тестов:', err)
    });
  }

  loadCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (courses) => this.courses = courses || [],
      error: (err) => console.error('Ошибка загрузки курсов:', err)
    });
  }

  createTest(): void {
    this.testService.createTest({
      courseId: this.newTest.courseId,
      title: this.newTest.title,
      description: this.newTest.description,
      testType: this.newTest.testType
    }).subscribe({
      next: (created) => {
        this.newTest = { courseId: '', title: '', description: '', testType: 'single_choice' };
        this.loadTests();
        // Сразу открыть редактор
        this.openEditor(created);
      },
      error: (err) => alert('Ошибка создания: ' + (err.error?.message || err.message))
    });
  }

  deleteTest(id: string): void {
    if (!confirm('Удалить тест? Все вопросы и результаты будут потеряны.')) return;
    this.testService.deleteTest(id).subscribe({
      next: () => {
        this.tests = this.tests.filter(t => t.id !== id);
        if (this.editingTest?.id === id) this.editingTest = null;
      },
      error: (err) => alert('Ошибка удаления: ' + (err.error?.message || err.message))
    });
  }

  openEditor(test: any): void {
    this.testService.getTestWithQuestions(test.id).subscribe({
      next: (full) => {
        this.editingTest = full;
        this.newQuestionType = full.test_type || 'single_choice';
      },
      error: (err) => alert('Ошибка загрузки теста: ' + (err.error?.message || err.message))
    });
  }

  closeEditor(): void {
    this.editingTest = null;
    this.loadTests();
  }

  addQuestion(): void {
    if (!this.newQuestionText || !this.editingTest) return;
    this.testService.addQuestion({
      testId: this.editingTest.id,
      questionText: this.newQuestionText,
      questionType: this.newQuestionType
    }).subscribe({
      next: () => {
        this.newQuestionText = '';
        this.openEditor(this.editingTest);
      },
      error: (err) => alert('Ошибка: ' + (err.error?.message || err.message))
    });
  }

  deleteQuestion(qId: string): void {
    if (!confirm('Удалить вопрос?')) return;
    this.testService.deleteQuestion(qId).subscribe({
      next: () => this.openEditor(this.editingTest),
      error: (err) => alert('Ошибка: ' + (err.error?.message || err.message))
    });
  }

  addAnswer(qId: string): void {
    const text = this.newAnswerText[qId];
    if (!text) return;
    this.testService.addAnswer({
      questionId: qId,
      answerText: text,
      isCorrect: !!this.newAnswerCorrect[qId]
    }).subscribe({
      next: () => {
        this.newAnswerText[qId] = '';
        this.newAnswerCorrect[qId] = false;
        this.openEditor(this.editingTest);
      },
      error: (err) => alert('Ошибка: ' + (err.error?.message || err.message))
    });
  }

  getTestTypeLabel(type: string): string {
    switch (type) {
      case 'single_choice': return 'Одиночный выбор';
      case 'multiple_choice': return 'Множественный выбор';
      case 'text_input': return 'Ввод текста';
      default: return type || '—';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
