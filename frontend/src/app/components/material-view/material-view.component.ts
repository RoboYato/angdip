import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialService } from '../../services/material.service';

@Component({
  selector: 'app-material-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="material-container">
      <button class="back-btn" (click)="goBack()">{{ isDocument ? '← Назад к документации' : '← Назад к курсу' }}</button>

      <div *ngIf="!material && !accessDenied" class="loading">
        🔄 Загрузка...
      </div>

      <div *ngIf="accessDenied" class="access-denied">
        <div class="denied-icon">🔒</div>
        <h2>Доступ запрещён</h2>
        <p class="denied-level">Гриф: <strong>{{ accessDeniedInfo?.accessLevel }}</strong></p>
        <div *ngIf="accessDeniedInfo?.requiredRoles?.length" class="denied-detail">
          <span>Требуемые роли:</span> {{ accessDeniedInfo.requiredRoles.join(', ') }}
        </div>
        <div *ngIf="accessDeniedInfo?.requiredDepts?.length" class="denied-detail">
          <span>Требуемый отдел:</span> {{ accessDeniedInfo.requiredDepts.join(', ') }}
        </div>
        <div *ngIf="accessDeniedInfo?.requiredPositions?.length" class="denied-detail">
          <span>Требуемая должность:</span> {{ accessDeniedInfo.requiredPositions.join(', ') }}
        </div>
        <p class="denied-hint">Обратитесь к администратору для получения доступа к данному материалу.</p>

        <div class="unlock-form">
          <p class="unlock-label">🔑 Введите пароль доступа, если он был выдан вам администратором:</p>
          <div class="unlock-row">
            <input type="password" [(ngModel)]="accessPassword" placeholder="Пароль доступа"
                   class="unlock-input" (keyup.enter)="unlockWithPassword()">
            <button class="unlock-btn" (click)="unlockWithPassword()" [disabled]="unlocking || !accessPassword">
              {{ unlocking ? '...' : '🔓 Открыть' }}
            </button>
          </div>
          <p *ngIf="passwordError" class="unlock-error">{{ passwordError }}</p>
        </div>
      </div>

      <div *ngIf="material" class="material-content">
        <h1>{{ material.title }}</h1>
        <p class="description">{{ material.description }}</p>
        
        <div class="content" [innerHTML]="material.content || 'Содержание модуля будет добавлено позже...'">
        </div>

        <div *ngIf="material.files && material.files.length > 0" class="files-section">
          <h3>📁 Приложенные файлы</h3>
          <div class="files-list">
            <a *ngFor="let file of material.files" [href]="file.file_path" class="file-item" target="_blank">
              📎 {{ file.filename }}
            </a>
          </div>
        </div>

        <div class="completion-section" *ngIf="!isDocument && material?.course_id">
          <button class="complete-btn" (click)="markAsCompleted()">
            ✓ Отметить как пройденный
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .material-container {
      max-width: 800px;
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

    .material-content {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    h1 {
      margin-top: 0;
    }

    .description {
      color: #666;
      font-size: 16px;
      margin: 10px 0 20px 0;
    }

    .content {
      color: #333;
      line-height: 1.6;
      margin: 20px 0;
    }

    .files-section {
      margin-top: 30px;
      border-top: 1px solid #e0e0e0;
      padding-top: 20px;
    }

    .files-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .file-item {
      color: #667eea;
      text-decoration: none;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 4px;
      transition: all 0.3s;
    }

    .file-item:hover {
      background: #e8e8ff;
    }

    .loading {
      text-align: center;
      padding: 40px;
      font-size: 18px;
      color: #666;
    }

    .access-denied {
      text-align: center;
      padding: 60px 40px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .denied-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    .access-denied h2 {
      color: #c62828;
      margin: 0 0 16px 0;
      font-size: 24px;
    }

    .denied-level {
      font-size: 16px;
      color: #555;
      margin-bottom: 16px;
    }

    .denied-detail {
      font-size: 14px;
      color: #666;
      margin: 8px 0;
      background: #fff3e0;
      padding: 6px 16px;
      border-radius: 4px;
      display: inline-block;
    }

    .denied-hint {
      margin-top: 24px;
      font-size: 14px;
      color: #888;
      font-style: italic;
    }

    .unlock-form {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
    }

    .unlock-label {
      font-size: 14px;
      color: #555;
      margin-bottom: 12px;
    }

    .unlock-row {
      display: flex;
      gap: 8px;
      justify-content: center;
    }

    .unlock-input {
      padding: 10px 14px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 15px;
      width: 220px;
      outline: none;
    }

    .unlock-input:focus {
      border-color: #667eea;
    }

    .unlock-btn {
      padding: 10px 20px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 15px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .unlock-btn:hover:not(:disabled) {
      background: #5a6fd6;
    }

    .unlock-btn:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .unlock-error {
      color: #c62828;
      font-size: 14px;
      margin-top: 10px;
    }

    .completion-section {
      margin-top: 30px;
      border-top: 1px solid #e0e0e0;
      padding-top: 20px;
      text-align: center;
    }

    .complete-btn {
      background: #4caf50;
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s;
    }

    .complete-btn:hover {
      background: #45a049;
      transform: scale(1.05);
    }
  `]
})
export class MaterialViewComponent implements OnInit {
  material: any;
  isDocument = false;
  accessDenied = false;
  accessDeniedInfo: any = null;
  accessPassword = '';
  passwordError = '';
  unlocking = false;
  materialId = '';

  constructor(
    private route: ActivatedRoute,
    private materialService: MaterialService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isDocument = this.router.url.includes('/user/document/');
    this.route.params.subscribe(params => {
      this.materialId = params['id'];
      this.loadMaterial(this.materialId);
    });
  }

  loadMaterial(materialId: string): void {
    this.materialService.getMaterialById(materialId).subscribe({
      next: (data) => {
        this.material = data;
        this.accessDenied = false;
        this.passwordError = '';
        console.log('Материал загружен:', this.material);
      },
      error: (error) => {
        console.error('Ошибка загрузки материала:', error);
        if (error.status === 403) {
          this.accessDenied = true;
          const details = error.error?.details;
          this.accessDeniedInfo = {
            accessLevel: error.error?.details?.access_level || 'Ограниченный доступ',
            requiredRoles: details?.required_attributes?.roles || [],
            requiredDepts: details?.required_attributes?.departments || [],
            requiredPositions: details?.required_attributes?.positions || []
          };
        }
      }
    });
  }

  unlockWithPassword(): void {
    if (!this.accessPassword || this.unlocking) return;
    this.unlocking = true;
    this.passwordError = '';
    this.materialService.unlockMaterial(this.materialId, this.accessPassword).subscribe({
      next: (data) => {
        this.material = data;
        this.accessDenied = false;
        this.accessPassword = '';
        this.unlocking = false;
      },
      error: (error) => {
        this.unlocking = false;
        if (error.status === 403) {
          this.passwordError = error.error?.message || 'Неверный пароль';
        } else {
          this.passwordError = 'Ошибка при попытке доступа';
        }
      }
    });
  }

  markAsCompleted(): void {
    if (!this.material) return;
    
    this.materialService.markAsCompleted(this.material.id).subscribe({
      next: () => {
        alert('Модуль отмечен как пройденный!');
        this.router.navigate(['/user/course', this.material.course_id]);
      },
      error: (error) => {
        console.error('Ошибка при отметке как пройденный:', error);
        alert('Ошибка при сохранении прогресса');
      }
    });
  }

  goBack(): void {
    if (this.isDocument) {
      this.router.navigate(['/user/documentation']);
    } else if (this.material?.course_id) {
      this.router.navigate(['/user/course', this.material.course_id]);
    } else {
      this.router.navigate(['/user']);
    }
  }
}
