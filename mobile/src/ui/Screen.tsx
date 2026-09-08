import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Без нижнего отступа — когда внизу таб-бар или закреплённая кнопка со своими полями. */
  noBottom?: boolean;
}

/**
 * Корневой контейнер экрана: фон --bg, боковые поля 20, safe-area сверху,
 * нижний отступ 30 (README «Ключевые размеры»).
 */
export function Screen({ children, style, noBottom }: ScreenProps) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.bg,
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.screenX,
          paddingBottom: noBottom ? 0 : Math.max(insets.bottom, space.screenBottom),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
