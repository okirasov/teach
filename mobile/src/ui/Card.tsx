import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** 14 — обычная карточка, 16 — карточка предмета / hero. */
  large?: boolean;
  padding?: number;
  style?: ViewStyle;
}

/** Карточка: --card, рамка 1px --line, radius 14–16, padding 14–16. */
export function Card({ children, onPress, large, padding, style }: CardProps) {
  const { c, radius, border } = useTheme();
  const base: ViewStyle = {
    backgroundColor: c.card,
    borderWidth: border.card,
    borderColor: c.line,
    borderRadius: large ? radius.cardLg : radius.card,
    padding: padding ?? (large ? 16 : 14),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.9 }, style]}>
      {children}
    </Pressable>
  );
}
