import { memoryReviewsRepo } from '@/db/reviewsRepo';
import { useReviews } from '../reviews';

const base = { subjectId: 's1', subjectName: 'SQL', note: 'n', source: 'src' };
const now = new Date('2026-09-11T10:00:00Z');

beforeEach(async () => {
  useReviews.setState(useReviews.getInitialState(), true);
  await useReviews.getState().attach(memoryReviewsRepo([]));
});

describe('карточки повторов по урокам', () => {
  it('шаг другого урока даёт новую карточку, пересдача того же урока — ту же', async () => {
    await useReviews.getState().addRecords([{ ...base, title: 'L1 шаг 1', ref: { subjectId: 's1', step: 1, lessonNumber: 1 }, ok: false }], now);
    await useReviews.getState().addRecords([{ ...base, title: 'L2 шаг 1', ref: { subjectId: 's1', step: 1, lessonNumber: 2 }, ok: true }], now);
    expect(useReviews.getState().cards.map((c) => c.title).sort()).toEqual(['L1 шаг 1', 'L2 шаг 1']);
    await useReviews.getState().addRecords([{ ...base, title: 'L2 шаг 1 снова', ref: { subjectId: 's1', step: 1, lessonNumber: 2 }, ok: true }], now);
    expect(useReviews.getState().cards).toHaveLength(2);
  });

  it('старая карточка без номера урока не переписывается записями нового урока', async () => {
    await useReviews.getState().addRecords([{ ...base, title: 'старая', ref: { subjectId: 's1', step: 1 }, ok: false }], now);
    await useReviews.getState().addRecords([{ ...base, title: 'новая', ref: { subjectId: 's1', step: 1, lessonNumber: 3 }, ok: true }], now);
    const titles = useReviews.getState().cards.map((c) => c.title).sort();
    expect(titles).toEqual(['новая', 'старая']);
  });
});
