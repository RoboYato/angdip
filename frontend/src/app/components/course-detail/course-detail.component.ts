import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CourseService } from '../../services/course.service';
import { TestService } from '../../services/test.service';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="course-detail-container">
      <button class="back-btn" (click)="goBack()">← Назад к курсам</button>
      
      <div *ngIf="course" class="course-info">
        <h1>{{ course.title }}</h1>
        <p class="description">{{ course.description }}</p>
      </div>

      <div class="materials-section">
        <h2>📖 Материалы курса</h2>
        <div *ngIf="!modules || modules.length === 0" class="no-materials">
          Материалы пока не добавлены
        </div>
        <div *ngIf="modules && modules.length > 0" class="materials-list">
          <div *ngFor="let module of modules" class="material-item" (click)="selectModule(module.id)">
            <div class="module-header">
              <h3>{{ module.title }}</h3>
              <span class="completion-status" [ngClass]="module.is_completed ? 'completed' : 'not-completed'">
                {{ module.is_completed ? '✓ Пройден' : '○ Не пройден' }}
              </span>
            </div>
            <p>{{ module.description }}</p>
            <div class="module-info">
              <span class="duration">⏱ {{ module.duration || 'Не указано' }}</span>
              <span class="order-num">№ {{ module.order_num }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="tests-section" *ngIf="tests && tests.length > 0">
        <h2>📝 Тесты по курсу</h2>
        <div class="tests-list">
          <div *ngFor="let test of tests" class="test-item">
            <div class="test-header">
              <h3>{{ test.title }}</h3>
              <span class="test-type">{{ getTestTypeLabel(test.test_type) }}</span>
            </div>
            <p *ngIf="test.description">{{ test.description }}</p>
            <div class="test-info">
              <span class="questions-count">❓ Вопросов: {{ test.questions_count || '?' }}</span>
              <button class="take-test-btn" (click)="goToTest(test.id)">Пройти тест →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .course-detail-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }

    .back-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 20px;
    }

    .back-btn:hover {
      background: #5568d3;
    }

    .course-info {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .course-info h1 {
      margin: 0 0 10px 0;
    }

    .description {
      color: #666;
      margin: 0;
    }

    .materials-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .materials-section h2 {
      margin-top: 0;
    }

    .no-materials {
      text-align: center;
      color: #999;
      padding: 40px;
    }

    .materials-list {
      display: grid;
      gap: 15px;
    }

    .material-item {
      border: 1px solid #e0e0e0;
      padding: 15px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s;
    }

    .material-item:hover {
      background: #f5f5f5;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }

    .material-item h3 {
      margin: 0 0 8px 0;
    }

    .material-item p {
      margin: 0 0 10px 0;
      color: #666;
      font-size: 14px;
    }

    .status {
      display: inline-block;
      padding: 4px 8px;
      background: #e0e0e0;
      border-radius: 3px;
      font-size: 12px;
    }

    .duration {
      display: inline-block;
      padding: 4px 8px;
      background: #e3f2fd;
      color: #1976d2;
      border-radius: 3px;
      font-size: 12px;
    }

    .module-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
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

    .module-info {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-top: 8px;
    }

    .order-num {
      display: inline-block;
      padding: 2px 6px;
      background: #f5f5f5;
      color: #666;
      border-radius: 3px;
      font-size: 11px;
    }

    .tests-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      margin-top: 20px;
    }

    .tests-section h2 {
      margin-top: 0;
    }

    .tests-list {
      display: grid;
      gap: 15px;
    }

    .test-item {
      border: 1px solid #e0e0e0;
      padding: 15px;
      border-radius: 4px;
      transition: all 0.3s;
    }

    .test-item:hover {
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }

    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .test-header h3 {
      margin: 0;
    }

    .test-type {
      font-size: 11px;
      padding: 3px 8px;
      background: #ede7f6;
      color: #5e35b1;
      border-radius: 12px;
    }

    .test-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
    }

    .questions-count {
      font-size: 13px;
      color: #666;
    }

    .take-test-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .take-test-btn:hover {
      background: #5568d3;
    }
  `]
})
export class CourseDetailComponent implements OnInit {
  course: any;
  modules: any[] = [];
  tests: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private courseService: CourseService,
    private testService: TestService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const courseId = params['id'];
      this.loadCourse(courseId);
      this.loadModules(courseId);
      this.loadTests(courseId);
    });
  }

  loadCourse(courseId: string): void {
    this.courseService.getCourseById(courseId).subscribe({
      next: (data) => {
        this.course = data;
      },
      error: (error) => {
        console.error('Ошибка загрузки курса:', error);
      }
    });
  }

  loadModules(courseId: string): void {
    this.courseService.getCourseModules(courseId).subscribe({
      next: (data) => {
        this.modules = data;
        console.log('Модули загружены:', this.modules);
      },
      error: (error) => {
        console.error('Ошибка загрузки модулей:', error);
      }
    });
  }

  selectModule(moduleId: string): void {
    this.router.navigate(['/user/material', moduleId]);
  }

  loadTests(courseId: string): void {
    this.testService.getTestsByCourse(courseId).subscribe({
      next: (data) => {
        this.tests = data;
      },
      error: (error) => {
        console.error('Ошибка загрузки тестов:', error);
      }
    });
  }

  goToTest(testId: string): void {
    this.router.navigate(['/user/test', testId]);
  }

  getTestTypeLabel(type: string): string {
    switch (type) {
      case 'single_choice': return 'Один ответ';
      case 'multiple_choice': return 'Несколько ответов';
      case 'text_input': return 'Текстовый ввод';
      default: return type;
    }
  }

  goBack(): void {
    this.router.navigate(['/user']);
  }
}
