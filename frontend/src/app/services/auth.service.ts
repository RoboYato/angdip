import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/auth';
  private tokenSubject = new BehaviorSubject<string | null>(localStorage.getItem('token'));
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {}

  getRolesForRegistration(): Observable<{ id: string; name: string; description?: string }[]> {
    return this.http.get<any[]>(`${this.apiUrl}/roles`);
  }

  register(fio: string, login: string, password: string, email?: string, roleId?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, {
      fio,
      login,
      password,
      email,
      roleId
    }).pipe(
      tap((response: any) => {
        localStorage.setItem('token', response.token);
        this.tokenSubject.next(response.token);
      })
    );
  }

  login(login: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, {
      login,
      password
    }).pipe(
      tap((response: any) => {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response));
        this.tokenSubject.next(response.token);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.tokenSubject.next(null);
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile`);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getUser(): any {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  isAdmin(): boolean {
    const user = this.getUser();
    return user?.isAdmin || false;
  }

  getRoles(): { id: string; name: string; description?: string }[] {
    const user = this.getUser();
    return user?.roles || [];
  }

  hasRole(roleName: string): boolean {
    const roles = this.getRoles();
    return roles.some((r: { name: string }) => r.name === roleName);
  }

  /** Раздел «Документация» доступен всем авторизованным пользователям; список материалов фильтруется на бэкенде по ролям и грифам. */
  canSeeDocumentation(): boolean {
    return this.isLoggedIn();
  }
}
