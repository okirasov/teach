import { dueDate, stubScheduler } from '../scheduler';

describe('stub scheduler', () => {
  it('uses the prototype intervals: mistake 1 day, success 4 days', () => {
    expect(stubScheduler.firstIntervalDays(false)).toBe(1);
    expect(stubScheduler.firstIntervalDays(true)).toBe(4);
  });
  it('dueDate adds calendar days', () => {
    expect(dueDate(new Date(2026, 8, 8), 4)).toEqual(new Date(2026, 8, 12));
  });
});
