import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { useT } from '@/i18n';
import type { Palette } from '@/theme';
import { BuddyDockView, useReduceMotion } from '@/ui';
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
const ANNOUNCED: ReadonlySet<BuddyState> = new Set<BuddyState>(['listening', 'right', 'partial', 'wrong', 'accepted']);

/**
 * Док бадди над главной кнопкой сессии: знак бренда + слово статуса.
 * Фон меняется на реакциях; реакция проигрывается один раз на шаг и при возврате к шагу
 * показывается уже в конечной позе.
 */
export function BuddyDock({ stepIndex, reduceMotion: reduceOverride, ...input }: BuddyDockProps) {
  const t = useT();
  const speaker = useSpeaker();
  const systemReduce = useReduceMotion();
  const reduceMotion = reduceOverride ?? systemReduce;
  const state = buddyStateOf({ ...input, speaking: speaker?.speaking != null });
  const word = t.buddy[state];

  // Ключ уже сыгранной реакции: «шаг:состояние». Повторный показ идёт без анимации.
  // Сид при монтировании: реакция, уже застигнутая на первом рендере (восстановленная
  // сессия), считается уже сыгранной и не должна анимироваться/хаптить/объявляться заново.
  const key = `${stepIndex}:${state}`;
  const isReaction = REACTIONS.has(state);
  const played = useRef<string | null>(isReaction ? key : null);
  const animateReaction = isReaction && played.current !== key;
  useEffect(() => {
    if (!isReaction) return;
    if (played.current !== key) buddyHaptic(state);
    played.current = key;
  }, [isReaction, key]);

  // iOS не читает live-region у обычного View — объявляем переходы сами.
  // На первом монтировании ничего не объявляем: это не переход, а восстановленное состояние.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (Platform.OS === 'ios' && ANNOUNCED.has(state)) AccessibilityInfo.announceForAccessibility(word);
  }, [state, word]);

  const bg: keyof Palette = state === 'right' ? 'mint' : state === 'partial' ? 'amberBg' : state === 'wrong' ? 'errBg' : state === 'accepted' ? 'sand' : 'card';
  return (
    <BuddyDockView
      state={state}
      word={word}
      bg={bg}
      reduceMotion={reduceMotion}
      animateReaction={animateReaction}
      accessible
      accessibilityRole="text"
      accessibilityLabel={word}
      accessibilityLiveRegion="polite"
    />
  );
}
