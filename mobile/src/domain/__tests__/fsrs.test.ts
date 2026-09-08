import { State } from 'ts-fsrs';

import { emptyCard, previewDays, schedule } from '../fsrs';

const now = new Date(2026, 8, 8, 12);

describe('fsrs wrapper', () => {
  it('new card: mistake comes back in 1 day, success in 3', () => {
    expect(previewDays(null, false, now)).toBe(1);
    expect(previewDays(null, true, now)).toBe(3);
  });

  it('schedule moves due into the future and grows the interval on repeated success', () => {
    const first = schedule(emptyCard(now), true, now);
    expect(first.card.state).toBe(State.Review);
    expect(first.card.due.getTime()).toBeGreaterThan(now.getTime());
    const later = new Date(first.card.due.getTime() + 3600_000);
    const second = schedule(first.card, true, later);
    expect(second.card.scheduled_days).toBeGreaterThan(first.card.scheduled_days);
    expect(second.log.rating).toBe(3);
  });

  it('a lapse resets the interval to a day', () => {
    const first = schedule(emptyCard(now), true, now);
    const later = new Date(first.card.due.getTime() + 3600_000);
    const lapse = schedule(first.card, false, later);
    expect(lapse.card.scheduled_days).toBe(1);
    expect(lapse.card.lapses).toBe(1);
  });
});
