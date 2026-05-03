import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, interval } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private pollSub?: Subscription;
  private readonly toastSeenKey = 'lms_toast_notification_ids';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  getNotifications(unreadOnly = false, limit = 50): Observable<any[]> {
    const q = unreadOnly ? `?unread_only=true&limit=${limit}` : `?limit=${limit}`;
    return this.http.get<any[]>(`/api/notifications${q}`);
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>('/api/notifications/unread-count');
  }

  markAsRead(id: string): Observable<any> {
    return this.http.patch(`/api/notifications/${id}/read`, {});
  }

  startToastPolling(): void {
    this.stopToastPolling();
    const tick = () => {
      if (!this.auth.isLoggedIn()) {
        return;
      }
      this.getNotifications(true, 25).subscribe({
        next: (rows) => {
          const seen = this.readSeenIds();
          for (const n of rows) {
            if (!n?.id || seen.has(n.id)) {
              continue;
            }
            const text = `${n.title}${n.message ? '\n' + String(n.message).slice(0, 280) : ''}`;
            this.toast.show(text);
            seen.add(n.id);
          }
          this.writeSeenIds(seen);
        },
        error: () => {}
      });
    };
    tick();
    this.pollSub = interval(5 * 60 * 1000).subscribe(() => tick());
  }

  stopToastPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  private readSeenIds(): Set<string> {
    try {
      const raw = sessionStorage.getItem(this.toastSeenKey);
      if (!raw) {
        return new Set();
      }
      const arr = JSON.parse(raw) as string[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  private writeSeenIds(ids: Set<string>): void {
    try {
      sessionStorage.setItem(this.toastSeenKey, JSON.stringify([...ids].slice(-200)));
    } catch {
      /* ignore */
    }
  }
}
