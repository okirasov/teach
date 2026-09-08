import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Txt';

interface SessionHeaderProps {
  /** Чип контекста по центру: имя предмета (mint) или «НОВЫЙ ПРЕДМЕТ» (chipDk mono). */
  chip: string;
  chipDark?: boolean;
  /** Счётчик n/N справа, mono. */
  counter: string;
  onClose: () => void;
  /** Сегменты прогресса: количество (0 — без прогресса) и текущий индекс. */
  total: number;
  current: number;
}

/** Шапка сессии (DESIGN.md §3): ×-кружок 36 | чип | счётчик; ниже сегменты h4 r2 gap5. */
export function SessionHeader({ chip, chipDark, counter, onClose, total, current }: SessionHeaderProps) {
  const { c, size, radius } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="close"
          onPress={onClose}
          hitSlop={8}
          style={{ width: size.closeCircle, height: size.closeCircle, borderRadius: size.closeCircle / 2, backgroundColor: c.mint, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt t="body" color="mintInk" style={{ fontSize: 18, lineHeight: 20 }}>×</Txt>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ backgroundColor: chipDark ? c.chipDk : c.mint, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.chip }}>
            <Txt t={chipDark ? 'chip' : 'seg'} color={chipDark ? 'btnInk' : 'mintInk'} style={chipDark ? { letterSpacing: 0.9 } : undefined}>
              {chip}
            </Txt>
          </View>
        </View>
        <Txt t="monoMeta" color="mut" style={{ width: 36, textAlign: 'right', fontSize: 12 }}>{counter}</Txt>
      </View>
      {total > 0 ? (
        <View style={{ flexDirection: 'row', gap: size.progressGap, marginTop: 14 }}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={{ flex: 1, height: size.progressH, borderRadius: 2, backgroundColor: i <= current ? c.mintInk : c.mint }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
