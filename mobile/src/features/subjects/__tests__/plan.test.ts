import { planProgress, planStageIndex } from '../plan';

const plan = [{ n: '01', t: 'Каркас', d: '' }, { n: '02', t: 'Приёмы', d: '' }, { n: '03', t: 'Применение', d: '' }];

describe('plan progress', () => {
  it('maps lesson numbers to plan stages like the server', () => {
    expect([1, 2, 3, 4, 6, 7, 20].map((n) => planStageIndex(n))).toEqual([0, 0, 0, 1, 1, 2, 2]);
  });
  it('builds the card model and hides it without a plan or lesson', () => {
    expect(planProgress(plan, 2)).toEqual({ index: 0, total: 3, title: 'Каркас', lessonNumber: 2 });
    expect(planProgress(plan, 5)?.title).toBe('Приёмы');
    expect(planProgress(undefined, 2)).toBeUndefined();
    expect(planProgress(plan, 0)).toBeUndefined();
  });
});
