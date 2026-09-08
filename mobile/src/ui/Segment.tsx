import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import type { PillOption } from './Pill';
import { Txt } from './Txt';

/**
 * Сегмент-контрол (DESIGN.md §3): подложка --mint r9 padding 3; сегмент 12.5px padding 8×11 r7;
 * активный — --card + тень + --ink 600; неактивный — прозрачный, --mintInk 500.
 */
export function Segment<V extends string | number>({ options, value, onChange }: { options: PillOption<V>[]; value: V; onChange: (v: V) => void }) {
  const { c, radius, shadow } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.mint, borderRadius: radius.segBox, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[
              { paddingVertical: 8, paddingHorizontal: 11, borderRadius: radius.chip, backgroundColor: active ? c.card : 'transparent' },
              active ? shadow.segActive : null,
            ]}
          >
            <Txt t={active ? 'segActive' : 'seg'} style={{ color: active ? c.ink : c.mintInk }} numberOfLines={1}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
