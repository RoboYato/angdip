import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { tokenInterceptor } from './app/interceptors/token.interceptor';

/** После деплоя кэш index.html может ссылаться на удалённые chunk-файлы — F5 даёт белый экран. */
function reloadOnStaleChunkError(): void {
  const chunkRe = /ChunkLoadError|Loading chunk \d+ failed|dynamically imported module/i;
  window.addEventListener('error', (event: ErrorEvent) => {
    const msg = event.message || '';
    if (chunkRe.test(msg)) {
      event.preventDefault();
      window.location.reload();
    }
  });
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const r = event.reason;
    const msg = r && typeof r === 'object' && 'message' in r ? String((r as Error).message) : String(r);
    if (chunkRe.test(msg)) {
      event.preventDefault();
      window.location.reload();
    }
  });
}

reloadOnStaleChunkError();

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([tokenInterceptor])
    )
  ]
}).catch(err => console.error(err));
