/**
 * Дни до дедлайна (password_expires_at), в которые создаётся напоминание.
 * I = importance / 100; без должности / важности — importance по умолчанию 50 → I = 0.5.
 */
export function getNotificationSchedule(importance: number | null | undefined): number[] {
  const imp = importance != null && !Number.isNaN(Number(importance)) ? Number(importance) : 50;
  const I = Math.min(1, Math.max(0.1, imp / 100));

  if (I >= 0.9) {
    return [1, 0].sort((a, b) => b - a);
  }
  if (I >= 0.6) {
    const out: number[] = [];
    for (let d = 7; d >= 1; d -= 3) {
      out.push(d);
    }
    out.push(0);
    return [...new Set(out)].sort((a, b) => b - a);
  }
  const out: number[] = [];
  for (let d = 14; d >= 2; d -= 2) {
    out.push(d);
  }
  out.push(0);
  return [...new Set(out)].sort((a, b) => b - a);
}
