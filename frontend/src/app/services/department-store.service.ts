import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AdminService } from './admin.service';

/**
 * Общий список отделов для admin-materials и обновления после создания пользователя.
 */
@Injectable({ providedIn: 'root' })
export class DepartmentStoreService {
  private readonly departmentsSubject = new BehaviorSubject<string[]>([]);

  readonly departments$ = this.departmentsSubject.asObservable();

  get snapshot(): string[] {
    return this.departmentsSubject.value;
  }

  setDepartments(list: string[]): void {
    this.departmentsSubject.next(Array.isArray(list) ? [...list] : []);
  }

  /** Загрузить с API и опубликовать подписчикам. */
  refreshFromApi(admin: AdminService): void {
    admin.getDepartments().subscribe({
      next: (list) => {
        this.setDepartments(Array.isArray(list) ? list : []);
      },
      error: () => this.setDepartments([])
    });
  }
}
