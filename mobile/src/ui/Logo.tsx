import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { brand, useTheme } from '@/theme';
import { Txt } from './Txt';

/** Знак «t» с точками растущего шага; последняя — контурная янтарная (DESIGN.md §1). */
export function Mark({ size = 26 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Rect x={16} y={14} width={9} height={64} rx={4.5} fill={c.mintInk} />
      <Circle cx={20.5} cy={30} r={5} fill={c.mintInk} />
      <Circle cx={37} cy={30} r={5} fill={c.mintInk} />
      <Circle cx={56} cy={30} r={5} fill={c.mintInk} />
      <Circle cx={79} cy={30} r={5.5} stroke={brand.markAmber} strokeWidth={3} fill="none" />
    </Svg>
  );
}

/** Знак + словотип «teach» (шапка приложения). */
export function Logo({ markSize = 26 }: { markSize?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Mark size={markSize} />
      <Txt t="logo">teach</Txt>
    </View>
  );
}
