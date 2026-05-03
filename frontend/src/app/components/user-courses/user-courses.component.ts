import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-courses',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="user-container">
      <nav class="sidebar">
        <div class="logo">LMS</div>
        <ul class="menu">
          <li><a routerLink="/user" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">📚 Обучающие материалы</a></li>
          <li *ngIf="canSeeDocumentation"><a routerLink="/user/documentation" routerLinkActive="active">📄 Документация</a></li>
          <li><a routerLink="/user/progress" routerLinkActive="active">📊 Мой прогресс</a></li>
          <!-- Временно без условия - для всех -->
          <li><a routerLink="/responsible/dashboard" routerLinkActive="active">📈 Дашборд ответственного</a></li>
          <li class="logout"><a (click)="logout()">🚪 Выход</a></li>
        </ul>
      </nav>
      
      <div class="main-content">
        <header>
          <h1>LMS — Система управления обучением</h1>
          <p>Добро пожаловать, {{ user?.fio }}</p>
        </header>

        <div class="courses-section">
          <h2>Доступные курсы</h2>
          <div *ngIf="courses.length === 0" class="no-courses">
            Пока нет доступных курсов
          </div>
          <div *ngIf="courses.length > 0" class="courses-grid">
            <div *ngFor="let course of courses" class="course-card">
              <div (click)="selectCourse(course.id)" style="cursor: pointer;">
                <h3>{{ course.title }}</h3>
                <p>{{ course.description }}</p>
                <div class="course-status">
                  <span class="status" [ngClass]="course.status">
                    {{ course.status === 'published' ? 'Опубликован' : course.status === 'draft' ? 'Черновик' : course.status }}
                  </span>
                  <span *ngIf="course.is_enrolled" class="enrolled-badge">
                    ✓ Вы записаны
                  </span>
                </div>
                <div *ngIf="course.is_enrolled && course.progress_percent >= 0" class="progress-section">
                  <div class="progress-info">
                    <span class="progress-text">📈 Прогресс: {{ course.progress_percent }}%</span>
                    <span class="progress-status" [ngClass]="getProgressStatusClass(course.progress_percent)">
                      {{ getProgressStatusText(course.progress_percent) }}
                    </span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" [style.width.%]="course.progress_percent"></div>
                  </div>
                </div>
              </div>
              <button 
                *ngIf="!course.is_enrolled" 
                class="enroll-btn" 
                (click)="enrollCourse(course.id); $event.stopPropagation()">
                ✓ Записаться на курс
              </button>
              <button 
                *ngIf="course.is_enrolled" 
                class="continue-btn" 
                (click)="selectCourse(course.id); $event.stopPropagation()">
                📚 Продолжить обучение
              </button>
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

    .courses-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .courses-section h2 {
      margin-top: 0;
      color: #333;
    }

    .no-courses {
      text-align: center;
      color: #999;
      padding: 40px;
    }

    .courses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .course-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }

    .course-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }

    .course-card h3 {
      margin: 0 0 10px 0;
    }

    .course-card p {
      margin: 0 0 15px 0;
      opacity: 0.9;
      font-size: 14px;
    }

    .status {
      display: inline-block;
      padding: 5px 10px;
      background: rgba(255,255,255,0.3);
      border-radius: 4px;
      font-size: 12px;
    }

    .status.published {
      background: rgba(76, 175, 80, 0.3);
    }

    .enroll-btn {
      width: 100%;
      margin-top: 10px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.9);
      color: #667eea;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s;
    }

    .enroll-btn:hover {
      background: white;
      transform: scale(1.05);
    }

    .continue-btn {
      width: 100%;
      margin-top: 10px;
      padding: 10px;
      background: #4caf50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s;
    }

    .continue-btn:hover {
      background: #45a049;
      transform: scale(1.05);
    }

    .course-status {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 10px;
    }

    .enrolled-badge {
      background: rgba(76, 175, 80, 0.3);
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
    }

    .progress {
      background: rgba(255, 193, 7, 0.3);
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
    }

    .progress-section {
      margin-top: 15px;
      width: 100%;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 12px;
    }

    .progress-text {
      color: white;
      font-weight: bold;
    }

    .progress-status {
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: bold;
    }

    .progress-status.not-started {
      background: #9e9e9e;
      color: white;
    }

    .progress-status.in-progress {
      background: #2196f3;
      color: white;
    }

    .progress-status.completed {
      background: #4caf50;
      color: white;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50, #8bc34a);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
  `]
})
export class UserCoursesComponent implements OnInit {
  courses: any[] = [];
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
    this.loadCourses();
  }

  enrollCourse(courseId: string): void {
    console.log('Запись на курс:', courseId);
    this.courseService.enrollInCourse(courseId).subscribe({
      next: () => {
        alert('Вы успешно записались на курс!');
        this.loadCourses();
      },
      error: (error) => {
        console.error('Ошибка записи на курс:', error);
        if (error.status === 409) {
          alert('Вы уже записаны на этот курс');
        } else {
          alert('Ошибка при записи на курс');
        }
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

  loadCourses(): void {
    this.courseService.getCourses().subscribe({
      next: (data) => {
        this.courses = data;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
      }
    });
  }

  selectCourse(courseId: string): void {
    this.router.navigate(['/user/course', courseId]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}