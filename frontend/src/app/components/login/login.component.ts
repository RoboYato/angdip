import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>Система LMS</h1>
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>Логин</label>
            <input 
              type="text" 
              formControlName="login"
              placeholder="Введите ваш логин"
              class="form-control">
          </div>
          <div class="form-group">
            <label>Пароль</label>
            <input 
              type="password" 
              formControlName="password"
              placeholder="Введите ваш пароль"
              class="form-control">
          </div>
          <button type="submit" [disabled]="!loginForm.valid" class="btn btn-primary">
            Войти
          </button>
          <p *ngIf="error" class="error">{{ error }}</p>
        </form>
        <p class="register-link">
          Нет аккаунта? <a routerLink="/register">Зарегистрироваться</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .login-card {
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
    .form-control:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 5px rgba(102, 126, 234, 0.5);
    }
    .btn {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .btn-primary:hover:not(:disabled) {
      background: #5568d3;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error {
      color: #dc3545;
      margin-top: 10px;
      font-size: 14px;
    }
    .register-link {
      text-align: center;
      margin-top: 20px;
    }
    .register-link a {
      color: #667eea;
      text-decoration: none;
    }
  `]
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  error: string = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.loginForm = this.formBuilder.group({
      login: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    const { login, password } = this.loginForm.value;
    this.authService.login(login, password).subscribe({
      next: (response) => {
        const user = response;
        if (user.isAdmin) {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/user']);
        }
      },
      error: (error) => {
        this.error = error.error?.message || 'Ошибка входа. Проверьте логин и пароль.';
      }
    });
  }
}
