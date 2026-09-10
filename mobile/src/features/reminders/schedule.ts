import type { ReminderSlot } from '@/store/settings';

/** Во сколько напоминаем: утро — 9:00, вечер — 19:00. */
export const SLOT_HOUR: Record<ReminderSlot, number> = { morning: 9, evening: 19 };

/** Один повторяющийся ежедневный триггер: день недели 1..7 (1 — воскресенье, как в expo-notifications). */
export interface ReminderTrigger {
  weekday: number;
  hour: number;
  minute: number;
}

/**
 * Расписание напоминаний из настроек. «Тихие выходные» убирают субботу и воскресенье,
 * поэтому вместо одного ежедневного триггера получается пять недельных.
 */
export function reminderSchedule(slot: ReminderSlot, weekendOff: boolean): ReminderTrigger[] {
  const hour = SLOT_HOUR[slot];
  const days = weekendOff ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
  return days.map((weekday) => ({ weekday, hour, minute: 0 }));
}
