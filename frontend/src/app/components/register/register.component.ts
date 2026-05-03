import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h1>Регистрация</h1>
        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>Полное имя</label>
            <input 
              type="text" 
              formControlName="fio"
              placeholder="Введите ваше полное имя"
              class="form-control">
          </div>
          <div class="form-group">
            <label>Логин</label>
            <input 
              type="text" 
              formControlName="login"
              placeholder="Выберите логин"
              class="form-control">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input 
              type="email" 
              formControlName="email"
              placeholder="Введите ваш email"
              class="form-control">
          </div>
          <div class="form-group">
            <label>Пароль</label>
            <input 
              type="password" 
              formControlName="password"
              placeholder="Выберите пароль"
              class="form-control">
          </div>
          <div class="form-group">
            <label>Роль</label>
            <select formControlName="roleId" class="form-control">
              <option value="">Выберите роль</option>
              <option *ngFor="let r of roles" [value]="r.id">{{ r.description || r.name }}</option>
            </select>
          </div>
          <button type="submit" [disabled]="!registerForm.valid" class="btn btn-primary">
            Зарегистрироваться
          </button>
          <p *ngIf="error" class="error">{{ error }}</p>
        </form>
        <p class="login-link">
          Уже есть аккаунт? <a routerLink="/login">Войти</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .register-card {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      text-align: center;
      margin-bottom: 30px;
      color: #333;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      color: #555;
      font-weight: 500;
    }
    .form-control {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    .btn {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 10px;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .error {
      color: #dc3545;
      margin-top: 10px;
      font-size: 14px;
    }
    .login-link {
      text-align: center;
      margin-top: 20px;
    }
    .login-link a {
      color: #667eea;
      text-decoration: none;
    }
  `]
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  roles: { id: string; name: string; description?: string }[] = [];
  error: string = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.authService.getRolesForRegistration().subscribe({
      next: (data) => (this.roles = data),
      error: () => (this.roles = [])
    });
  }

  initForm(): void {
    this.registerForm = this.formBuilder.group({
      fio: ['', [Validators.required]],
      login: ['', [Validators.required]],
      email: ['', [Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      roleId: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    const { fio, login, password, email, roleId } = this.registerForm.value;
    this.authService.register(fio, login, password, email, roleId || undefined).subscribe({
      next: () => {
        this.router.navigate(['/user']);
      },
      error: (error) => {
        this.error = error.error?.message || 'Ошибка регистрации';
      }
    });
  }
}
