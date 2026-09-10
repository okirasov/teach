import { reminderSchedule, SLOT_HOUR } from '../schedule';

describe('расписание напоминаний', () => {
  it('каждый день в час выбранного слота', () => {
    const evening = reminderSchedule('evening', false);
    expect(evening).toHaveLength(7);
    expect(new Set(evening.map((t) => t.weekday))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    expect(evening.every((t) => t.hour === SLOT_HOUR.evening && t.minute === 0)).toBe(true);
    expect(reminderSchedule('morning', false).every((t) => t.hour === SLOT_HOUR.morning)).toBe(true);
    expect(SLOT_HOUR.morning).toBeLessThan(SLOT_HOUR.evening);
  });

  it('тихие выходные убирают субботу и воскресенье', () => {
    const week = reminderSchedule('morning', true);
    expect(week).toHaveLength(5);
    // 1 — воскресенье, 7 — суббота (нумерация expo-notifications).
    expect(week.map((t) => t.weekday)).toEqual([2, 3, 4, 5, 6]);
  });
});
