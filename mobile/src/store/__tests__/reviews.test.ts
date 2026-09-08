import { memoryReviewsRepo } from '@/db/reviewsRepo';
import { prototypeQueue } from '@/db/seedCards';
import { dueLater, dueToday } from '@/features/reviews/queue';
import { useReviews } from '../reviews';

const now = new Date(2026, 8, 8, 12);
const initial = useReviews.getInitialState();
beforeEach(() => useReviews.setState(initial, true));

describe('reviews store', () => {
  it('attaches to a repo and splits the prototype queue into today / later', async () => {
    const repo = memoryReviewsRepo(prototypeQueue(now));
    await useReviews.getState().attach(repo);
    const { cards, ready } = useReviews.getState();
    expect(ready).toBe(true);
    expect(cards).toHaveLength(5);
    expect(dueToday(cards, now).map((c) => c.title)).toEqual([
      'После if не бывает would',
      'Граница — это две точки, не одна',
      'Раздел 395 был раньше разграбления 410',
    ]);
    expect(dueLater(cards, now).map((c) => c.title)).toEqual(['Рамка совета If I were you…', 'Пары точек на краях диапазона']);
  });

  it('addRecords creates FSRS-scheduled cards that land in «later» and persists them with logs', async () => {
    const repo = memoryReviewsRepo();
    await useReviews.getState().attach(repo);
    const created = await useReviews.getState().addRecords(
      [
        { subjectId: 'en', subjectName: 'Английский', title: 'a', note: '', source: '', ref: { subjectId: 'en', step: 1 }, ok: false },
        { subjectId: 'en', subjectName: 'Английский', title: 'b', note: '', source: '', ref: null, ok: true },
      ],
      now,
    );
    expect(created.map((c) => c.fsrs.scheduled_days)).toEqual([1, 3]);
    expect(dueToday(useReviews.getState().cards, now)).toHaveLength(0);
    expect(dueLater(useReviews.getState().cards, now)).toHaveLength(2);
    expect(await repo.count()).toBe(2);
    expect(repo.logs).toHaveLength(2);
  });

  it('addRecords reschedules an existing card with the same step ref instead of duplicating it', async () => {
    const repo = memoryReviewsRepo(prototypeQueue(now));
    await useReviews.getState().attach(repo);
    const result = await useReviews.getState().addRecords(
      [{ subjectId: 'en', subjectName: 'Английский', title: 'После if не бывает would', note: 'n', source: '', ref: { subjectId: 'en', step: 1 }, ok: true }],
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('seed-en-1');
    expect(useReviews.getState().cards).toHaveLength(5);
    expect(await repo.count()).toBe(5);
    expect(dueToday(useReviews.getState().cards, now).map((c) => c.id)).not.toContain('seed-en-1');
  });

  it('applyResults reschedules existing cards: success pushes out, mistake keeps it near', async () => {
    const repo = memoryReviewsRepo(prototypeQueue(now));
    await useReviews.getState().attach(repo);
    await useReviews.getState().applyResults([{ cardId: 'seed-en-1', ok: true }, { cardId: 'seed-qa-1', ok: false }], now);
    const cards = useReviews.getState().cards;
    const en = cards.find((c) => c.id === 'seed-en-1')!;
    const qa = cards.find((c) => c.id === 'seed-qa-1')!;
    expect(en.fsrs.due.getTime()).toBeGreaterThan(qa.fsrs.due.getTime());
    expect(dueToday(cards, now).map((c) => c.id)).toEqual(['seed-hist-1']);
    expect((await repo.all()).find((c) => c.id === 'seed-en-1')!.fsrs.reps).toBe(2);
  });

  it('stats count answers this month and today', async () => {
    const repo = memoryReviewsRepo(prototypeQueue(now));
    await useReviews.getState().attach(repo);
    await useReviews.getState().refreshStats(now);
    expect(useReviews.getState().stats).toEqual({ month: 0, today: 0 });
    await useReviews.getState().applyResults([{ cardId: 'seed-en-1', ok: true }, { cardId: 'seed-qa-1', ok: false }], now);
    expect(useReviews.getState().stats).toEqual({ month: 2, today: 2 });
    await useReviews.getState().refreshStats(new Date(2026, 8, 9, 12));
    expect(useReviews.getState().stats).toEqual({ month: 2, today: 0 });
  });

  it('removeSubject drops the subject cards everywhere', async () => {
    const repo = memoryReviewsRepo(prototypeQueue(now));
    await useReviews.getState().attach(repo);
    await useReviews.getState().removeSubject('en');
    expect(useReviews.getState().cards.some((c) => c.subjectId === 'en')).toBe(false);
    expect(await repo.count()).toBe(3);
  });
});
