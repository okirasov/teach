import React from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Txt';

/** Кружок с инициалом: 34px в шапке, 44px в карточке аккаунта. */
export function Avatar({ name, size = 34, onPress }: { name: string; size?: number; onPress?: () => void }) {
  const { c } = useTheme();
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const box = (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.mintInk, alignItems: 'center', justifyContent: 'center' }}
    >
      <Txt t="metaMed" color="btnInk" style={{ fontSize: size > 40 ? 17 : 13, lineHeight: size > 40 ? 20 : 15 }}>
        {initial}
      </Txt>
    </View>
  );
  if (!onPress) return box;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
      {box}
    </Pressable>
  );
}
