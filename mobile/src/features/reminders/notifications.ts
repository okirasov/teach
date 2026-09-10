import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ReminderSlot } from '@/store/settings';
import { reminderSchedule } from './schedule';

/** Все напоминания приложения помечаются, чтобы снимать только свои. */
const TAG = 'teach.reminder';

/**
 * Ежедневное напоминание позаниматься. Локальное: сервер не участвует, работает офлайн.
 * Разрешение спрашиваем только когда напоминания реально нужны, а не при первом запуске.
 */
export async function applyReminders(slot: ReminderSlot, weekendOff: boolean, title: string, body: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const granted = await ensurePermission();
    await cancelReminders();
    if (!granted) return false;
    for (const t of reminderSchedule(slot, weekendOff)) {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { [TAG]: true } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: t.weekday, hour: t.hour, minute: t.minute },
      });
    }
    return true;
  } catch {
    // Напоминания — удобство, а не часть обучения: сбой не должен ломать экран настроек.
    return false;
  }
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const planned = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      planned.filter((n) => (n.content.data as Record<string, unknown> | null)?.[TAG]).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    /* нечего отменять */
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}
