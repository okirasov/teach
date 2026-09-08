import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme, type Palette } from '@/theme';
import { Txt } from './Txt';

export type ChipTone = 'dark' | 'mint' | 'amber' | 'err' | 'sand';

const tones: Record<ChipTone, { bg: keyof Palette; fg: keyof Palette }> = {
  dark: { bg: 'chipDk', fg: 'btnInk' },
  mint: { bg: 'mint', fg: 'mintInk' },
  amber: { bg: 'amberBg', fg: 'amber' },
  err: { bg: 'errBg', fg: 'errInk' },
  sand: { bg: 'sand', fg: 'sandInk' },
};

/** Чип-статус: mono 10–11px UPPERCASE, radius 7 (DESIGN.md §3). */
export function Chip({ label, tone = 'mint', small, style }: { label: string; tone?: ChipTone; small?: boolean; style?: ViewStyle }) {
  const { c, radius } = useTheme();
  const t = tones[tone];
  return (
    <View
      style={[
        { backgroundColor: c[t.bg], borderRadius: radius.chip, paddingVertical: 6, paddingHorizontal: small ? 9 : 10, alignSelf: 'flex-start' },
        style,
      ]}
    >
      <Txt t={small ? 'chipSm' : 'chip'} color={t.fg} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}
