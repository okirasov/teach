import React from 'react';
import { Pressable, View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { Txt } from '@/ui';

/** Hero-карта повторов (DESIGN.md §4.2): кикер, «N карточек · ~6 мин», подпись, стрелка. */
export function HeroCard({ count, minutes, onPress }: { count: number; minutes: number; onPress: () => void }) {
  const t = useT();
  const { c, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: c.heroBg,
        borderRadius: radius.cardLg,
        padding: 18,
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ flexShrink: 1 }}>
        <Txt t="kickerSm" color="heroKicker">{t.queueKicker}</Txt>
        <Txt t="hero" color="heroInk" style={{ marginTop: 8 }}>{t.queueLine(count, minutes)}</Txt>
        <Txt t="small" color="heroSub" style={{ marginTop: 4 }} numberOfLines={1}>{t.queueNote}</Txt>
      </View>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.mint, alignItems: 'center', justifyContent: 'center' }}>
        <Txt t="body" color="mintInk" style={{ fontSize: 18, lineHeight: 22 }}>→</Txt>
      </View>
    </Pressable>
  );
}
