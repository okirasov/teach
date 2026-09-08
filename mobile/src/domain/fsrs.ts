import { createEmptyCard, fsrs, Rating, type Card as FsrsCard, type Grade, type ReviewLog } from 'ts-fsrs';

/**
 * FSRS без краткосрочных шагов: карточка сразу уходит на дни, как в прототипе
 * (ошибка → 1 день, успех → 3 дня на новой карточке). Fuzz выключен для детерминизма.
 */
export const scheduler = fsrs({ enable_short_term: false, enable_fuzz: false, learning_steps: [], relearning_steps: [] });

/** Двоичный результат практики → оценка FSRS. */
export function ratingFor(ok: boolean): Grade {
  return ok ? Rating.Good : Rating.Again;
}

export function emptyCard(now: Date): FsrsCard {
  return createEmptyCard(now);
}

export interface Scheduled {
  card: FsrsCard;
  log: ReviewLog;
}

/** Применить результат к карточке (новой или существующей). */
export function schedule(card: FsrsCard, ok: boolean, now: Date): Scheduled {
  const r = scheduler.next(card, now, ratingFor(ok));
  return { card: r.card, log: r.log };
}

/** Через сколько дней вернётся карточка при таком результате — для разбора. */
export function previewDays(card: FsrsCard | null, ok: boolean, now: Date): number {
  const r = scheduler.next(card ?? createEmptyCard(now), now, ratingFor(ok));
  return Math.max(1, r.card.scheduled_days);
}
