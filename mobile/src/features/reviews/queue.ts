import type { ReviewCard } from '@/domain/reviewCard';
import type { Dict } from '@/i18n';

export function endOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Карточки, срок которых наступил (включая просроченные). */
export function dueToday(cards: ReviewCard[], now: Date): ReviewCard[] {
  const eod = endOfDay(now).getTime();
  return cards.filter((c) => c.fsrs.due.getTime() <= eod).sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());
}

export function dueLater(cards: ReviewCard[], now: Date): ReviewCard[] {
  const eod = endOfDay(now).getTime();
  return cards.filter((c) => c.fsrs.due.getTime() > eod).sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());
}

/** Календарных дней от сегодня до срока (0 — сегодня или раньше). */
export function daysUntil(due: Date, now: Date): number {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(due); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/** Подпись чипа: «сегодня» / «завтра» / «через N дней». */
export function dueLabel(t: Dict, due: Date, now: Date): string {
  const n = daysUntil(due, now);
  if (n === 0) return t.dToday;
  if (n === 1) return t.dTomorrow;
  return t.dInDays(n);
}

/** Примерная длительность: ~30 с на карточку; 0 карточек → 0 мин. */
export function estimateMinutes(count: number): number {
  return count === 0 ? 0 : Math.max(1, Math.round(count * 0.5));
}

/** Карточки одного предмета; без id — все. */
export function forSubject<T extends { subjectId: string }>(cards: T[], subjectId?: string): T[] {
  return subjectId ? cards.filter((c) => c.subjectId === subjectId) : cards;
}
