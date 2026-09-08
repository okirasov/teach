import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Txt';

export interface PillOption<V extends string | number> {
  value: V;
  label: string;
}

/** Пилл-выбор (DESIGN.md §3): r10, h42, active --mintInk/--btnInk, inactive --mint/--mintInk, без рамки. */
export function PillGroup<V extends string | number>({ options, value, onChange }: { options: PillOption<V>[]; value: V; onChange: (v: V) => void }) {
  const { c, radius, size } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{ height: size.pill, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: active ? c.mintInk : c.mint, justifyContent: 'center' }}
          >
            <Txt t="pill" style={{ color: active ? c.btnInk : c.mintInk }}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
