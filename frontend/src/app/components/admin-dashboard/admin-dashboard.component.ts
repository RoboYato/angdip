import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { CourseService } from '../../services/course.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="admin-container">
      <nav class="admin-sidebar">
        <div class="logo">Админ LMS</div>
        <ul class="menu">
          <li><a routerLink="/admin" routerLinkActive="active">Панель управления</a></li>
          <li><a routerLink="/admin/courses" routerLinkActive="active">Курсы</a></li>
          <li><a routerLink="/admin/materials" routerLinkActive="active">Материалы и документация</a></li>
          <li><a routerLink="/admin/users" routerLinkActive="active">Пользователи</a></li>
          <li><a routerLink="/admin/roles" routerLinkActive="active">Роли</a></li>
          <li><a routerLink="/admin/access-levels" routerLinkActive="active">Уровни доступа</a></li>
          <li><a routerLink="/admin/progress" routerLinkActive="active">📊 Прогресс пользователей</a></li>
          <li><a routerLink="/admin/audit" routerLinkActive="active">Журнал аудита</a></li>
          <li class="logout"><a (click)="logout()">Выход</a></li>
        </ul>
      </nav>

      <div class="admin-content">
        <header class="admin-header">
          <h1>Панель управления</h1>
          <p>Добро пожаловать, Администратор</p>
        </header>

        <div class="dashboard-stats">
          <div class="stat-card">
            <h3>Всего курсов</h3>
            <p class="stat-number">{{ stats.courses }}</p>
          </div>
          <div class="stat-card">
            <h3>Всего пользователей</h3>
            <p class="stat-number">{{ stats.users }}</p>
          </div>
          <div class="stat-card">
            <h3>Всего ролей</h3>
            <p class="stat-number">{{ stats.roles }}</p>
          </div>
        </div>

        <div class="quick-actions">
          <button class="btn btn-primary" (click)="navigateTo('/admin/courses')">Управление курсами</button>
          <button class="btn btn-primary" (click)="navigateTo('/admin/materials')">Материалы и документация</button>
          <button class="btn btn-primary" (click)="navigateTo('/admin/users')">Управление пользователями</button>
          <button class="btn btn-primary" (click)="navigateTo('/admin/roles')">Управление ролями</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-container {
      display: flex;
      height: 100vh;
      background: #f5f5f5;
    }

    .admin-sidebar {
      width: 250px;
      background: #1a1a2e;
      color: white;
      padding: 20px;
      box-shadow: 2px 0 5px rgba(0,0,0,0.1);
    }

    .logo {
      font-size: 20px;
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

    .admin-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .admin-header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .admin-header h1 {
      margin: 0 0 10px 0;
      color: #333;
    }

    .dashboard-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .stat-card h3 {
      margin: 0 0 10px 0;
      color: #666;
    }

    .stat-number {
      margin: 0;
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
    }

    .quick-actions {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover {
      background: #5568d3;
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  stats = {
    courses: 0,
    users: 0,
    roles: 0
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private adminService: AdminService,
    private courseService: CourseService
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.adminService.getCourses().subscribe({
      next: (courses) => { this.stats.courses = courses.length; },
      error: () => {}
    });
    this.adminService.getUsers().subscribe({
      next: (users) => { this.stats.users = users.length; },
      error: () => {}
    });
    this.adminService.getRoles().subscribe({
      next: (roles) => { this.stats.roles = roles.length; },
      error: () => {}
    });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
