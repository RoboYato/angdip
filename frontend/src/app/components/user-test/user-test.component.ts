import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { TestService } from '../../services/test.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-test',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="test-page" *ngIf="test">
      <button class="btn-back" (click)="goBack()">← Назад к курсу</button>

      <!-- Результат (если только что сдал или уже сдавал) -->
      <div class="result-card" *ngIf="result" [class.passed]="result.passed" [class.failed]="!result.passed">
        <div class="result-icon">{{ result.passed ? '🎉' : '😔' }}</div>
        <h2>{{ result.passed ? 'Тест пройден!' : 'Тест не пройден' }}</h2>
        <div class="result-score">{{ result.score }}%</div>
        <p>Правильных ответов: {{ result.correct_count || '—' }} из {{ result.total_questions || test.questions?.length }}</p>
        <p class="pass-info">Для прохождения необходимо набрать 70% и выше</p>
        <div class="result-actions">
          <button class="btn btn-primary" (click)="retryTest()" *ngIf="!result.passed">🔄 Попробовать снова</button>
          <button class="btn btn-secondary" (click)="goBack()">← К курсу</button>
        </div>
      </div>

      <!-- Форма теста -->
      <div *ngIf="!result && !submitted">
        <div class="test-header">
          <h1>📝 {{ test.title }}</h1>
          <p *ngIf="test.description">{{ test.description }}</p>
          <div class="test-info">
            <span class="badge">{{ getTestTypeLabel(test.test_type) }}</span>
            <span class="badge">{{ test.questions?.length || 0 }} вопросов</span>
            <span class="badge">Проходной балл: 70%</span>
          </div>
        </div>

        <!-- Уже сдавал ранее -->
        <div class="prev-result" *ngIf="test.last_result">
          <p>
            Предыдущий результат:
            <strong [class.pass]="test.last_result.passed" [class.fail]="!test.last_result.passed">
              {{ test.last_result.score }}% — {{ test.last_result.passed ? 'Пройден ✅' : 'Не пройден ❌' }}
            </strong>
            ({{ test.last_result.completed_at | date:'dd.MM.yyyy HH:mm' }})
          </p>
        </div>

        <div class="questions">
          <div class="question" *ngFor="let q of test.questions; let i = index">
            <div class="q-header">
              <span class="q-number">{{ i + 1 }}</span>
              <span class="q-text">{{ q.question_text }}</span>
            </div>

            <!-- single_choice -->
            <div class="answers" *ngIf="q.question_type === 'single_choice'">
              <label class="answer-option" *ngFor="let a of q.answers"
                     [class.selected]="userAnswers[q.id] === a.id">
                <input type="radio" [name]="'q_' + q.id" [value]="a.id"
                       [(ngModel)]="userAnswers[q.id]">
                <span class="radio-mark"></span>
                <span class="answer-text">{{ a.answer_text }}</span>
              </label>
            </div>

            <!-- multiple_choice -->
            <div class="answers" *ngIf="q.question_type === 'multiple_choice'">
              <label class="answer-option" *ngFor="let a of q.answers"
                     [class.selected]="isChecked(q.id, a.id)">
                <input type="checkbox" [checked]="isChecked(q.id, a.id)"
                       (change)="toggleCheck(q.id, a.id)">
                <span class="check-mark"></span>
                <span class="answer-text">{{ a.answer_text }}</span>
              </label>
            </div>

            <!-- text_input -->
            <div class="answers" *ngIf="q.question_type === 'text_input'">
              <input type="text" class="text-answer" [(ngModel)]="userAnswers[q.id]"
                     placeholder="Введите ваш ответ">
            </div>
          </div>
        </div>

        <div class="submit-area">
          <p class="answered-count">
            Отвечено: {{ answeredCount }} из {{ test.questions?.length || 0 }}
          </p>
          <button class="btn btn-primary btn-large" (click)="submitTest()"
                  [disabled]="answeredCount === 0">
            ✅ Отправить ответы
          </button>
        </div>
      </div>

      <!-- Загрузка -->
      <div *ngIf="submitted && !result" class="loading">
        ⏳ Проверяем ваши ответы...
      </div>
    </div>

    <!-- Нет теста -->
    <div class="test-page" *ngIf="!test && !loading">
      <p class="empty">Тест не найден.</p>
      <button class="btn btn-secondary" (click)="goBack()">← Назад</button>
    </div>
    <div class="test-page" *ngIf="loading">
      <p class="loading">⏳ Загрузка теста...</p>
    </div>
  `,
  styles: [`
    .test-page { max-width: 800px; margin: 30px auto; padding: 0 20px; }
    .btn-back { background: none; border: none; color: #3498db; font-size: 15px; cursor: pointer; margin-bottom: 20px; padding: 0; }
    .btn-back:hover { text-decoration: underline; }

    .test-header { margin-bottom: 24px; }
    .test-header h1 { margin: 0 0 8px; color: #2c3e50; }
    .test-header p { color: #666; margin: 0 0 12px; }
    .test-info { display: flex; gap: 8px; flex-wrap: wrap; }
    .badge { padding: 4px 12px; border-radius: 12px; font-size: 13px; background: #ecf0f1; }

    .prev-result { background: #fef9e7; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #f39c12; }
    .prev-result .pass { color: #27ae60; }
    .prev-result .fail { color: #e74c3c; }

    .questions { }
    .question { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .q-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .q-number { background: #3498db; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .q-text { font-size: 16px; color: #2c3e50; line-height: 1.5; padding-top: 4px; }

    .answers { margin-left: 44px; }
    .answer-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 2px solid #eee; border-radius: 6px; margin-bottom: 8px; cursor: pointer; transition: all .15s; }
    .answer-option:hover { border-color: #3498db; background: #f0f7ff; }
    .answer-option.selected { border-color: #3498db; background: #ebf5fb; }
    .answer-option input { display: none; }
    .radio-mark, .check-mark { width: 20px; height: 20px; border: 2px solid #bbb; border-radius: 50%; flex-shrink: 0; position: relative; }
    .check-mark { border-radius: 4px; }
    .answer-option.selected .radio-mark::after { content: ''; position: absolute; top: 4px; left: 4px; width: 8px; height: 8px; border-radius: 50%; background: #3498db; }
    .answer-option.selected .check-mark::after { content: '✓'; position: absolute; top: -2px; left: 2px; color: #3498db; font-weight: 700; font-size: 14px; }
    .answer-text { font-size: 14px; color: #333; }

    .text-answer { width: 100%; padding: 10px 14px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
    .text-answer:focus { border-color: #3498db; outline: none; }

    .submit-area { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .answered-count { color: #666; margin: 0; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #3498db; color: white; }
    .btn-primary:hover { background: #2980b9; }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-secondary { background: #95a5a6; color: white; }
    .btn-large { padding: 14px 30px; font-size: 16px; }

    .result-card { text-align: center; padding: 40px 30px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,.1); margin-top: 20px; }
    .result-card.passed { border-top: 5px solid #27ae60; }
    .result-card.failed { border-top: 5px solid #e74c3c; }
    .result-icon { font-size: 48px; margin-bottom: 12px; }
    .result-card h2 { margin: 0 0 10px; color: #2c3e50; }
    .result-score { font-size: 60px; font-weight: 700; margin: 10px 0; }
    .result-card.passed .result-score { color: #27ae60; }
    .result-card.failed .result-score { color: #e74c3c; }
    .pass-info { color: #888; font-size: 13px; margin-top: 8px; }
    .result-actions { display: flex; gap: 12px; justify-content: center; margin-top: 24px; }

    .loading { text-align: center; padding: 60px; font-size: 18px; color: #666; }
    .empty { text-align: center; color: #999; padding: 40px; }
  `]
})
export class UserTestComponent implements OnInit {
  test: any = null;
  loading = true;
  submitted = false;
  result: any = null;
  userAnswers: { [questionId: string]: any } = {};

  private testId = '';
  private courseId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private testService: TestService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.testId = this.route.snapshot.paramMap.get('testId') || '';
    this.courseId = this.route.snapshot.queryParamMap.get('courseId') || '';
    if (this.testId) {
      this.loadTest();
    } else {
      this.loading = false;
    }
  }

  loadTest(): void {
    this.loading = true;
    this.testService.getTestWithQuestions(this.testId).subscribe({
      next: (test) => {
        this.test = test;
        this.courseId = test.course_id || this.courseId;
        this.loading = false;
      },
      error: () => {
        this.test = null;
        this.loading = false;
      }
    });
  }

  isChecked(qId: string, answerId: string): boolean {
    const val = this.userAnswers[qId];
    return Array.isArray(val) && val.includes(answerId);
  }

  toggleCheck(qId: string, answerId: string): void {
    if (!Array.isArray(this.userAnswers[qId])) {
      this.userAnswers[qId] = [];
    }
    const idx = this.userAnswers[qId].indexOf(answerId);
    if (idx >= 0) {
      this.userAnswers[qId].splice(idx, 1);
    } else {
      this.userAnswers[qId].push(answerId);
    }
  }

  get answeredCount(): number {
    let count = 0;
    for (const q of (this.test?.questions || [])) {
      const val = this.userAnswers[q.id];
      if (val !== undefined && val !== '' && (!Array.isArray(val) || val.length > 0)) {
        count++;
      }
    }
    return count;
  }

  submitTest(): void {
    if (!confirm('Отправить ответы? Это действие нельзя отменить.')) return;
    this.submitted = true;
    this.testService.submitTest(this.testId, this.userAnswers).subscribe({
      next: (res) => {
        this.result = res;
      },
      error: (err) => {
        alert('Ошибка отправки: ' + (err.error?.message || err.message));
        this.submitted = false;
      }
    });
  }

  retryTest(): void {
    this.result = null;
    this.submitted = false;
    this.userAnswers = {};
    // Перезагрузить тест (обновить last_result)
    this.loadTest();
  }

  goBack(): void {
    if (this.courseId) {
      this.router.navigate(['/user/course', this.courseId]);
    } else {
      this.router.navigate(['/user']);
    }
  }

  getTestTypeLabel(type: string): string {
    switch (type) {
      case 'single_choice': return 'Одиночный выбор';
      case 'multiple_choice': return 'Множественный выбор';
      case 'text_input': return 'Ввод текста';
      default: return type || '';
    }
  }
}
