import { Injectable, NgZone } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(private zone: NgZone) {}

  show(message: string, durationMs = 9000): void {
    this.zone.runOutsideAngular(() => {
      const el = document.createElement('div');
      el.className = 'app-toast';
      el.setAttribute('role', 'status');
      el.textContent = message;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('app-toast--visible'));
      window.setTimeout(() => {
        el.classList.remove('app-toast--visible');
        window.setTimeout(() => el.remove(), 300);
      }, durationMs);
    });
  }
}
