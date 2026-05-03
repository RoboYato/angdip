import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: `<router-outlet></router-outlet>`,
  styles: [`
    :host {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'LMS Frontend';
  private tokenSub?: Subscription;

  constructor(
    private auth: AuthService,
    private notifications: NotificationService
  ) {}

  ngOnInit(): void {
    this.tokenSub = this.auth.token$.subscribe((token) => {
      if (token) {
        this.notifications.startToastPolling();
      } else {
        this.notifications.stopToastPolling();
      }
    });
  }

  ngOnDestroy(): void {
    this.notifications.stopToastPolling();
    this.tokenSub?.unsubscribe();
  }
}
