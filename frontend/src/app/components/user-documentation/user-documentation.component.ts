import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MaterialService } from '../../services/material.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-user-documentation',
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
          <li class="logout"><a (click)="logout()">🚪 Выход</a></li>
        </ul>
      </nav>

      <div class="main-content">
        <header>
          <h1>LMS — Система управления обучением</h1>
          <p>Добро пожаловать, {{ user?.fio }}</p>
        </header>

        <div class="courses-section">
          <h2>Обучающая документация</h2>
          <div *ngIf="!documentations || documentations.length === 0" class="no-courses">
            Пока нет доступной документации
          </div>
          <div *ngIf="documentations && documentations.length > 0" class="courses-grid">
            <div *ngFor="let doc of documentations" class="course-card">
              <div (click)="viewDocument(doc.id)" style="cursor: pointer;">
                <h3>{{ doc.title }}</h3>
                <p>{{ doc.description }}</p>
                <div class="course-status">
                  <span class="status published">
                    {{ doc.access_level_name || 'Общий доступ' }}
                  </span>
                  <span *ngIf="doc.access_level_code && doc.access_level_code !== 'PUBLIC'" class="lock-badge">
                    🔒 Ограниченный доступ
                  </span>
                </div>
              </div>
              <button class="continue-btn" (click)="viewDocument(doc.id); $event.stopPropagation()">
                {{ doc.access_level_code && doc.access_level_code !== 'PUBLIC' ? '🔐 Открыть' : '📖 Открыть' }}
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

    .course-status {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 10px;
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

    .lock-badge {
      display: inline-block;
      padding: 3px 8px;
      background: rgba(255,193,7,0.35);
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-top: 6px;
    }
  `]
})
export class UserDocumentationComponent implements OnInit {
  documentations: any[] = [];
  user: any = null;
  canSeeDocumentation = false;

  constructor(
    private materialService: MaterialService,
    private authService: AuthService,
    private router: Router
  ) {
    this.canSeeDocumentation = this.authService.canSeeDocumentation();
  }

  ngOnInit() {
    this.user = this.authService.getUser();
    this.loadDocumentation();
  }

  loadDocumentation() {
    this.materialService.getDocumentation().subscribe({
      next: (data) => {
        this.documentations = data;
      },
      error: (error) => {
        console.error('Ошибка загрузки документации:', error);
      }
    });
  }

  viewDocument(documentId: string) {
    this.router.navigate(['/user/document', documentId]);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
