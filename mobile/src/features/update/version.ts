/** Сравнение номеров сборок: строка из app.json против числа с сервера. */
export function isNewer(current: string | number | undefined | null, latest: number): boolean {
  if (!Number.isFinite(latest) || latest <= 0) return false;
  const cur = typeof current === 'number' ? current : parseInt(current ?? '', 10);
  if (!Number.isFinite(cur)) return false;
  return latest > cur;
}
