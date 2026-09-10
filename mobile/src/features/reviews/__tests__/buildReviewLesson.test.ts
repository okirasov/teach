import { prototypeQueue } from '@/domain/__fixtures__/protoQueue';
import { protoLessons as seedLessons } from '@/domain/__fixtures__/protoLessons';
import { buildReviewLesson } from '../buildReviewLesson';
import { daysUntil, dueLabel, estimateMinutes } from '../queue';
import { ru } from '@/i18n/ru';

const now = new Date(2026, 8, 8, 12);
const resolve = (id: string, step: number) => seedLessons[id]?.steps[step] ?? null;

describe('buildReviewLesson', () => {
  it('turns due cards into practice steps and keeps card ids aligned', () => {
    const cards = prototypeQueue(now).slice(0, 3);
    const plan = buildReviewLesson(cards, resolve, 'Повторы', 0);
    expect(plan.lesson.steps.map((s) => s.type)).toEqual(['choice', 'choice', 'order']);
    expect(plan.cardIds).toEqual(['seed-en-1', 'seed-qa-1', 'seed-hist-1']);
  });

  it('respects the daily cap and skips cards without a resolvable step', () => {
    const cards = prototypeQueue(now);
    cards[1] = { ...cards[1], ref: null };
    const plan = buildReviewLesson(cards, resolve, 'Повторы', 2);
    expect(plan.cardIds).toEqual(['seed-en-1', 'seed-hist-1']);
  });
});

describe('due labels', () => {
  it('counts calendar days and picks the right word', () => {
    const d = (days: number) => new Date(2026, 8, 8 + days, 9);
    expect(daysUntil(d(-1), now)).toBe(0);
    expect(dueLabel(ru, d(0), now)).toBe('сегодня');
    expect(dueLabel(ru, d(1), now)).toBe('завтра');
    expect(dueLabel(ru, d(3), now)).toBe('через 3 дня');
  });
  it('estimates minutes', () => {
    expect(estimateMinutes(0)).toBe(0);
    expect(estimateMinutes(1)).toBe(1);
    expect(estimateMinutes(12)).toBe(6);
  });
});
