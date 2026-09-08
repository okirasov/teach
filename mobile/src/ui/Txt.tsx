import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type Palette, type TypeName } from '@/theme';

export interface TxtProps extends TextProps {
  /** Именованный стиль из theme.type. */
  t?: TypeName;
  /** Цвет из палитры (ключ токена). */
  color?: keyof Palette;
  style?: TextStyle | TextStyle[];
}

/** Текст с токенами: <Txt t="h1" color="ink">…</Txt>. */
export function Txt({ t = 'body', color = 'ink', style, ...rest }: TxtProps) {
  const th = useTheme();
  return <Text {...rest} style={[th.type[t], { color: th.c[color] }, style]} />;
}
