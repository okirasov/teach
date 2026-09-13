import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { BuddyState } from './buddyState';

/** Один флаг, чтобы выключить хаптику бадди целиком, не трогая остальное. */
export const BUDDY_HAPTICS = true;

/** Лёгкий отклик на реакцию; на web и при выключенном флаге — тишина. */
export function buddyHaptic(state: BuddyState): void {
  if (!BUDDY_HAPTICS || Platform.OS === 'web') return;
  const run =
    state === 'right'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : state === 'partial'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        : state === 'wrong' || state === 'accepted'
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          : null;
  run?.catch(() => {});
}
