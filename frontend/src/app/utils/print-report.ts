/** Экранирование текста для вставки в HTML. */
export function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) {
    return '';
  }
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const printStyles = `
  body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 24px; color: #222; font-size: 11pt; }
  h1 { font-size: 16pt; margin: 0 0 8px 0; }
  h2 { font-size: 12pt; margin: 20px 0 8px 0; border-bottom: 1px solid #ccc; }
  .meta { color: #555; font-size: 10pt; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eee; font-weight: 600; }
  .summary { margin-top: 16px; padding: 12px; background: #f7f7f7; border-radius: 4px; }
  .summary p { margin: 4px 0; }
  @media print {
    body { margin: 12mm; }
    .no-print { display: none !important; }
    a { color: inherit; text-decoration: none; }
  }
`;

/** Открывает новое окно с HTML и вызывает диалог печати. */
export function openPrintableReport(pageTitle: string, documentTitle: string, innerBodyHtml: string): void {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Не удалось открыть окно печати. Разрешите всплывающие окна для этого сайта.');
    return;
  }
  const meta = `Сформировано: ${new Date().toLocaleString('ru-RU')}`;
  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(pageTitle)}</title>`);
  w.document.write(`<style>${printStyles}</style></head><body>`);
  w.document.write(`<h1>${escapeHtml(documentTitle)}</h1>`);
  w.document.write(`<div class="meta">${escapeHtml(meta)}</div>`);
  w.document.write(innerBodyHtml);
  w.document.write(
    `<p class="no-print" style="margin-top:20px"><button type="button" onclick="window.print()">Печать / PDF</button></p>`
  );
  w.document.write(
    `<script>setTimeout(function(){ window.print(); }, 400);<\/script></body></html>`
  );
  w.document.close();
}

export function statusLabelRu(status: string): string {
  switch (status) {
    case 'completed':
      return 'Завершён';
    case 'in_progress':
      return 'В процессе';
    case 'not_started':
      return 'Не начат';
    default:
      return status || '—';
  }
}

export function materialTypeLabel(type: string): string {
  if (type === 'documentation') {
    return 'Документация';
  }
  if (type === 'learning') {
    return 'Обучение';
  }
  return type || '—';
}

export function buildResponsibleReportBody(data: {
  user: { fio?: string; position?: string; department?: string; email?: string };
  materials: Array<{
    title?: string;
    type?: string;
    access_level?: string;
    progress_percent?: number;
    status?: string;
    first_opened_at?: string | null;
    updated_at?: string | null;
    completed_at?: string | null;
    course_title?: string | null;
    view_actions?: number;
  }>;
  summary: {
    total?: number;
    completed?: number;
    in_progress?: number;
    not_started?: number;
    average_progress?: number;
  };
}): string {
  const u = data.user || {};
  let html = '<h2>Сотрудник</h2>';
  html += '<table><tbody>';
  html += `<tr><th>ФИО</th><td>${escapeHtml(u.fio)}</td></tr>`;
  html += `<tr><th>Должность</th><td>${escapeHtml(u.position)}</td></tr>`;
  html += `<tr><th>Отдел</th><td>${escapeHtml(u.department)}</td></tr>`;
  html += `<tr><th>Email</th><td>${escapeHtml(u.email)}</td></tr>`;
  html += '</tbody></table>';

  html += '<h2>Материалы (зона вашей ответственности)</h2>';
  html +=
    '<table><thead><tr><th>Название</th><th>Тип</th><th>Гриф</th><th>Курс</th><th>Прогресс %</th><th>Статус</th><th>Первое открытие</th><th>Обновлено</th><th>Завершено</th><th>Просмотры</th></tr></thead><tbody>';
  for (const m of data.materials || []) {
    html += '<tr>';
    html += `<td>${escapeHtml(m.title)}</td>`;
    html += `<td>${escapeHtml(materialTypeLabel(m.type || ''))}</td>`;
    html += `<td>${escapeHtml(m.access_level)}</td>`;
    html += `<td>${escapeHtml(m.course_title || '—')}</td>`;
    html += `<td>${escapeHtml(m.progress_percent)}</td>`;
    html += `<td>${escapeHtml(statusLabelRu(m.status || ''))}</td>`;
    html += `<td>${m.first_opened_at ? escapeHtml(new Date(m.first_opened_at).toLocaleString('ru-RU')) : '—'}</td>`;
    html += `<td>${m.updated_at ? escapeHtml(new Date(m.updated_at).toLocaleString('ru-RU')) : '—'}</td>`;
    html += `<td>${m.completed_at ? escapeHtml(new Date(m.completed_at).toLocaleString('ru-RU')) : '—'}</td>`;
    html += `<td>${escapeHtml(m.view_actions ?? 0)}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table>';

  const s = data.summary || {};
  html += '<div class="summary"><h2>Итого</h2>';
  html += `<p>Всего материалов: <strong>${escapeHtml(s.total)}</strong></p>`;
  html += `<p>Завершено: <strong>${escapeHtml(s.completed)}</strong>, в процессе: <strong>${escapeHtml(s.in_progress)}</strong>, не начато: <strong>${escapeHtml(s.not_started)}</strong></p>`;
  html += `<p>Средний прогресс: <strong>${escapeHtml(s.average_progress)}%</strong></p></div>`;
  return html;
}

export function buildOverallAdminReportBody(data: {
  generated_at?: string;
  global_stats?: {
    total_users?: number;
    average_progress_all?: number;
    total_completed_courses?: number;
  };
  users?: Array<{
    user: { fio?: string; position?: string; department?: string; roles?: string };
    courses?: Array<{
      course_title?: string;
      progress_percent?: number;
      status?: string;
      materials?: Array<{ title?: string; progress_percent?: number; status?: string; completed_at?: string | null }>;
    }>;
    summary_per_user?: { courses_count?: number; average_progress?: number };
  }>;
}): string {
  const g = data.global_stats || {};
  let html = '<div class="summary"><h2>Общая статистика</h2>';
  html += `<p>Пользователей в отчёте: <strong>${escapeHtml(g.total_users)}</strong></p>`;
  html += `<p>Средний прогресс по курсам (все записи user_progress): <strong>${escapeHtml(g.average_progress_all)}%</strong></p>`;
  html += `<p>Завершённых курсов (status = completed): <strong>${escapeHtml(g.total_completed_courses)}</strong></p>`;
  html += `<p>Дата формирования данных: <strong>${escapeHtml(data.generated_at ? new Date(data.generated_at).toLocaleString('ru-RU') : '')}</strong></p></div>`;

  for (const block of data.users || []) {
    const u = block.user || {};
    html += `<h2>${escapeHtml(u.fio)}</h2>`;
    html += '<table><tbody>';
    html += `<tr><th>Должность</th><td>${escapeHtml(u.position)}</td></tr>`;
    html += `<tr><th>Отдел</th><td>${escapeHtml(u.department)}</td></tr>`;
    html += `<tr><th>Роли</th><td>${escapeHtml(u.roles)}</td></tr>`;
    const sp = block.summary_per_user || {};
    html += `<tr><th>Курсов в прогрессе</th><td>${escapeHtml(sp.courses_count)}</td></tr>`;
    html += `<tr><th>Средний прогресс по курсам</th><td>${escapeHtml(sp.average_progress)}%</td></tr>`;
    html += '</tbody></table>';

    for (const c of block.courses || []) {
      html += `<h3 style="font-size:11pt;margin:16px 0 6px 0">${escapeHtml(c.course_title)} — ${escapeHtml(c.progress_percent)}% (${escapeHtml(c.status)})</h3>`;
      html +=
        '<table><thead><tr><th>Материал</th><th>Прогресс %</th><th>Статус</th><th>Завершено</th></tr></thead><tbody>';
      for (const m of c.materials || []) {
        html += '<tr>';
        html += `<td>${escapeHtml(m.title)}</td>`;
        html += `<td>${escapeHtml(m.progress_percent)}</td>`;
        html += `<td>${escapeHtml(m.status)}</td>`;
        html += `<td>${m.completed_at ? escapeHtml(new Date(m.completed_at).toLocaleString('ru-RU')) : '—'}</td>`;
        html += '</tr>';
      }
      html += '</tbody></table>';
    }
  }
  return html;
}
