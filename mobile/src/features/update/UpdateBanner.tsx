import React from 'react';
import { Linking, Pressable, View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { Txt } from '@/ui';
import { useUpdate, useUpdateNudge } from './useUpdateNudge';

/** Подсказка «есть сборка N» на «Сегодня»: песочная карточка, «Обновить» ведёт в TestFlight, × прячет до перезапуска. */
export function UpdateBanner() {
  useUpdateNudge();
  const t = useT();
  const { c, radius } = useTheme();
  const latest = useUpdate((s) => s.latest);
  const dismissed = useUpdate((s) => s.dismissed);
  const dismiss = useUpdate((s) => s.dismiss);
  if (!latest || dismissed) return null;
  return (
    <View
      testID="update-banner"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingVertical: 10, paddingLeft: 14, paddingRight: 8, borderRadius: radius.card, backgroundColor: c.sand }}
    >
      <View style={{ flex: 1 }}>
        <Txt t="rowMed" color="sandInk">{t.updateTitle(latest.build)}</Txt>
        <Txt t="note" color="sandInk">{t.updateText}</Txt>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => void Linking.openURL(latest.url).catch(() => {})}
        style={{ height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: c.mintInk, alignItems: 'center', justifyContent: 'center' }}
      >
        <Txt t="buttonSm" color="btnInk">{t.updateBtn}</Txt>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t.updateHide} onPress={dismiss} hitSlop={8} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <Txt t="body" color="sandInk" style={{ fontSize: 18, lineHeight: 20 }}>×</Txt>
      </Pressable>
    </View>
  );
}
