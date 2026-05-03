import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-progress',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="user-container">
      <nav class="sidebar">
        <div class="logo">LMS</div>
        <ul class="menu">
          <li><a routerLink="/user" routerLinkActive="active">📚 Обучающие материалы</a></li>
          <li *ngIf="canSeeDocumentation"><a routerLink="/user/documentation" routerLinkActive="active">📄 Документация</a></li>
          <li><a routerLink="/user/progress" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">📊 Мой прогресс</a></li>
          <li class="logout"><a (click)="logout()">🚪 Выход</a></li>
        </ul>
      </nav>
      
      <div class="main-content">
        <header>
          <h1>📊 Мой прогресс обучения</h1>
          <p>{{ user?.fio }}, вот ваша статистика</p>
        </header>

        <div class="stats-section">
          <div class="stat-card">
            <div class="stat-number">{{ enrolledCourses.length }}</div>
            <div class="stat-label">Записан на курсов</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ completedCourses.length }}</div>
            <div class="stat-label">Завершено курсов</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ inProgressCourses.length }}</div>
            <div class="stat-label">В процессе изучения</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ averageProgress }}%</div>
            <div class="stat-label">Средний прогресс</div>
          </div>
        </div>

        <div class="courses-progress-section">
          <h2>Детальный прогресс по курсам</h2>
          <div *ngIf="enrolledCourses.length === 0" class="no-courses">
            Вы пока не записаны ни на один курс
          </div>
          <div *ngIf="enrolledCourses.length > 0" class="progress-list">
            <div *ngFor="let course of enrolledCourses" class="course-progress-card">
              <div class="course-header">
                <h3>{{ course.title }}</h3>
                <span class="progress-percent">{{ course.progress_percent }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="course.progress_percent"></div>
              </div>
              <div class="course-info">
                <span class="status-badge" [ngClass]="getProgressStatusClass(course.progress_percent)">
                  {{ getProgressStatusText(course.progress_percent) }}
                </span>
                <button class="continue-btn" (click)="goToCourse(course.id)">
                  {{ course.progress_percent > 0 ? '📖 Продолжить' : '🚀 Начать изучение' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .user-container {
      display: flex;
      height: 100vh;
      background: #f5f5f5;
    }

    .sidebar {
      width: 250px;
      background: #2c3e50;
      color: white;
      padding: 20px;
      box-shadow: 2px 0 5px rgba(0,0,0,0.1);
    }

    .logo {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 30px;
      text-align: center;
    }

    .menu {
      list-style: none;
      padding: 0;
    }

    .menu li {
      margin-bottom: 10px;
    }

    .menu a {
      display: block;
      padding: 10px 15px;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s;
    }

    .menu a:hover {
      background: rgba(255,255,255,0.1);
    }

    .menu a.active {
      background: #667eea;
    }

    .logout {
      margin-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.2);
      padding-top: 20px;
    }

    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    header h1 {
      margin: 0 0 10px 0;
      color: #333;
    }

    header p {
      margin: 0;
      color: #666;
    }

    .stats-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }

    .stat-number {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .stat-label {
      font-size: 14px;
      opacity: 0.9;
    }

    .courses-progress-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .courses-progress-section h2 {
      margin-top: 0;
      color: #333;
    }

    .no-courses {
      text-align: center;
      color: #999;
      padding: 40px;
    }

    .progress-list {
      display: grid;
      gap: 15px;
    }

    .course-progress-card {
      border: 1px solid #e0e0e0;
      padding: 20px;
      border-radius: 8px;
      transition: all 0.3s;
    }

    .course-progress-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      transform: translateY(-2px);
    }

    .course-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .course-header h3 {
      margin: 0;
      color: #333;
    }

    .progress-percent {
      font-size: 18px;
      font-weight: bold;
      color: #667eea;
    }

    .progress-bar {
      width: 100%;
      height: 12px;
      background: #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 15px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50, #8bc34a);
      border-radius: 6px;
      transition: width 0.3s ease;
    }

    .course-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
    }

    .status-badge.not-started {
      background: #f5f5f5;
      color: #666;
    }

    .status-badge.in-progress {
      background: #e3f2fd;
      color: #1976d2;
    }

    .status-badge.completed {
      background: #e8f5e8;
      color: #2e7d32;
    }

    .continue-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s;
    }

    .continue-btn:hover {
      background: #5568d3;
      transform: scale(1.05);
    }
  `]
})
export class UserProgressComponent implements OnInit {
  enrolledCourses: any[] = [];
  completedCourses: any[] = [];
  inProgressCourses: any[] = [];
  averageProgress = 0;
  user: any;
  canSeeDocumentation = false;

  constructor(
    private courseService: CourseService,
    private authService: AuthService,
    private router: Router
  ) {
    this.user = this.authService.getUser();
    this.canSeeDocumentation = this.authService.canSeeDocumentation();
  }

  ngOnInit(): void {
    this.loadProgress();
  }

  loadProgress(): void {
    this.courseService.getCourses().subscribe({
      next: (courses) => {
        this.enrolledCourses = courses.filter(course => course.is_enrolled);
        this.completedCourses = this.enrolledCourses.filter(course => course.progress_percent >= 100);
        this.inProgressCourses = this.enrolledCourses.filter(course => course.progress_percent > 0 && course.progress_percent < 100);
        
        if (this.enrolledCourses.length > 0) {
          this.averageProgress = Math.round(
            this.enrolledCourses.reduce((sum, course) => sum + course.progress_percent, 0) / this.enrolledCourses.length
          );
        }
      },
      error: (error) => {
        console.error('Ошибка загрузки прогресса:', error);
      }
    });
  }

  getProgressStatusClass(progress: number): string {
    if (progress === 0) return 'not-started';
    if (progress >= 100) return 'completed';
    return 'in-progress';
  }

  getProgressStatusText(progress: number): string {
    if (progress === 0) return 'Не начат';
    if (progress >= 100) return 'Завершен';
    return 'В процессе';
  }

  goToCourse(courseId: string): void {
    this.router.navigate(['/user/course', courseId]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}