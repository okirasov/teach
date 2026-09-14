import React from 'react';
import { View, type ViewProps } from 'react-native';

import type { BuddyState } from '@/features/session/buddyState';
import { useTheme, type Palette } from '@/theme';
import { BuddyMark } from './BuddyMark';
import { Txt } from './Txt';

export interface BuddyDockViewProps extends Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityLiveRegion'> {
  state: BuddyState;
  word: string;
  /** Фон карточки: card по умолчанию, mint/amberBg/errBg/sand на реакциях. */
  bg?: keyof Palette;
  reduceMotion: boolean;
  animateReaction?: boolean;
  testID?: string;
}

/** Карточка бадди: знак 64×24 слева, слово статуса справа. Без логики — состояние и слово даёт вызывающий. */
export function BuddyDockView({ state, word, bg = 'card', reduceMotion, animateReaction = false, testID = 'buddy-dock', ...a11y }: BuddyDockViewProps) {
  const { c, radius, border } = useTheme();
  return (
    <View
      testID={testID}
      {...a11y}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 10, borderRadius: radius.card, borderWidth: border.card, borderColor: c.line, backgroundColor: c[bg] }}
    >
      <View style={{ width: 64, alignItems: 'center' }}>
        <BuddyMark state={state} reduceMotion={reduceMotion} animateReaction={animateReaction} />
      </View>
      {/* Одна строка намеренно: высота дока не должна прыгать между состояниями. */}
      <Txt t="body" color="ink" style={{ flex: 1 }} numberOfLines={1}>
        {word}
      </Txt>
    </View>
  );
}
