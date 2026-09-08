import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

/** Тумблер 46×28: трек --mintInk (on) / --trackOff (off), ползунок белый 22px (DESIGN.md §3). */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  const { c, size } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{
        width: size.toggleW, height: size.toggleH, borderRadius: size.toggleH / 2, padding: 3,
        backgroundColor: value ? c.mintInk : c.trackOff, alignItems: value ? 'flex-end' : 'flex-start', justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size.toggleKnob, height: size.toggleKnob, borderRadius: size.toggleKnob / 2, backgroundColor: '#FDFDFD',
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2,
        }}
      />
    </Pressable>
  );
}
