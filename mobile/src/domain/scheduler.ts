/**
 * Интервалы повторов. Сроками владеет алгоритм, не модель и не пользователь (DESIGN.md §4.10).
 * Первый шаг — заглушка прототипа: ошибка → 1 день, успех → 4 дня.
 * Замена на FSRS (ts-fsrs) — на шаге хранилища, когда появятся карточки с историей.
 */
export interface Scheduler {
  /** Интервал в днях до первого повтора новой записи. */
  firstIntervalDays(ok: boolean): number;
}

export const stubScheduler: Scheduler = {
  firstIntervalDays: (ok) => (ok ? 4 : 1),
};

export const scheduler: Scheduler = stubScheduler;

export function dueDate(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}
