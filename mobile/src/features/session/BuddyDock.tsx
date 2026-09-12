import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { BuddyMark, Txt, useReduceMotion } from '@/ui';
import { buddyStateOf, REACTIONS, type BuddyInput, type BuddyState } from './buddyState';
import { buddyHaptic } from './buddyHaptics';
import { useSpeaker } from './speaker';

export interface BuddyDockProps extends Omit<BuddyInput, 'speaking'> {
  /** Индекс активного шага (s.step): реакция играет один раз на шаг. */
  stepIndex: number;
  /** Тестовый override системной настройки. */
  reduceMotion?: boolean;
}

/** Состояния, о которых VoiceOver сообщает вслух: смена хода и реакции. */
const ANNOUNCED: ReadonlySet<BuddyState> = new Set<BuddyState>(['listening', 'right', 'partial', 'wrong']);

/**
 * Док бадди над главной кнопкой сессии: знак бренда + слово статуса.
 * Фон меняется на реакциях; реакция проигрывается один раз на шаг и при возврате к шагу
 * показывается уже в конечной позе.
 */
export function BuddyDock({ stepIndex, reduceMotion: reduceOverride, ...input }: BuddyDockProps) {
  const t = useT();
  const { c, radius, border } = useTheme();
  const speaker = useSpeaker();
  const systemReduce = useReduceMotion();
  const reduceMotion = reduceOverride ?? systemReduce;
  const state = buddyStateOf({ ...input, speaking: speaker?.speaking != null });
  const word = t.buddy[state];

  // Ключ уже сыгранной реакции: «шаг:состояние». Повторный показ идёт без анимации.
  const played = useRef<string | null>(null);
  const key = `${stepIndex}:${state}`;
  const isReaction = REACTIONS.has(state);
  const animateReaction = isReaction && played.current !== key;
  useEffect(() => {
    if (!isReaction) return;
    if (played.current !== key) buddyHaptic(state);
    played.current = key;
  }, [isReaction, key, state]);

  // iOS не читает live-region у обычного View — объявляем переходы сами.
  useEffect(() => {
    if (Platform.OS === 'ios' && ANNOUNCED.has(state)) AccessibilityInfo.announceForAccessibility(word);
  }, [state, word]);

  const bg = state === 'right' ? c.mint : state === 'partial' ? c.amberBg : state === 'wrong' ? c.errBg : c.card;
  return (
    <View
      testID="buddy-dock"
      accessible
      accessibilityRole="text"
      accessibilityLabel={word}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginTop: 10,
        borderRadius: radius.card,
        borderWidth: border.card,
        borderColor: c.line,
        backgroundColor: bg,
      }}
    >
      <View style={{ width: 64, alignItems: 'center' }}>
        <BuddyMark state={state} reduceMotion={reduceMotion} animateReaction={animateReaction} />
      </View>
      <Txt t="body" color="ink" style={{ flex: 1 }} numberOfLines={1}>
        {word}
      </Txt>
    </View>
  );
}
