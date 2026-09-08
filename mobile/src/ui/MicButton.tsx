import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

interface MicButtonProps {
  recording: boolean;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  size?: number;
}

/** Кнопка записи (DESIGN.md §3): круг --mintInk → в записи --err + ореол 8px; микрофон → квадрат-стоп. */
export function MicButton({ recording, onPress, onPressIn, onPressOut, size }: MicButtonProps) {
  const th = useTheme();
  const d = size ?? th.size.mic;
  return (
    <View style={{ width: d + 16, height: d + 16, alignItems: 'center', justifyContent: 'center' }}>
      {recording ? (
        <View style={{ position: 'absolute', width: d + 16, height: d + 16, borderRadius: (d + 16) / 2, backgroundColor: th.c.errHalo }} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'stop' : 'mic'}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: recording ? th.c.err : th.c.mintInk, alignItems: 'center', justifyContent: 'center' }}
      >
        {recording ? (
          <View style={{ width: 17, height: 17, borderRadius: 7, backgroundColor: th.c.onAccent }} />
        ) : (
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Rect x={9} y={3} width={6} height={11} rx={3} fill={th.c.btnInk} />
            <Path d="M5 11 a7 7 0 0 0 14 0" stroke={th.c.btnInk} strokeWidth={2} strokeLinecap="round" />
            <Path d="M12 18 v3" stroke={th.c.btnInk} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        )}
      </Pressable>
    </View>
  );
}
