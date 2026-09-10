import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';

interface SpeakButtonProps {
  speaking: boolean;
  onPress: () => void;
  size?: number;
}

/** Кнопка «озвучить»: круг --mint с динамиком; пока звучит — --mintInk с квадратом-стоп. Хит-таргет 44px. */
export function SpeakButton({ speaking, onPress, size = 28 }: SpeakButtonProps) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={speaking ? 'stop' : 'speak'}
      onPress={onPress}
      hitSlop={8}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: speaking ? c.mintInk : c.mint, alignItems: 'center', justifyContent: 'center' }}
    >
      {speaking ? (
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.onAccent }} />
      ) : (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M4 9v6h4l5 4V5L8 9H4z" fill={c.mintInk} />
          <Path d="M16 8.5a5 5 0 0 1 0 7" stroke={c.mintInk} strokeWidth={2} strokeLinecap="round" />
          <Path d="M18.5 5.5a9 9 0 0 1 0 13" stroke={c.mintInk} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      )}
    </Pressable>
  );
}
