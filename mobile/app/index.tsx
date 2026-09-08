import { Pressable, ScrollView, View } from 'react-native';

import { useSettings } from '@/store/settings';
import { palette, useTheme } from '@/theme';
import { Logo, Screen, Txt } from '@/ui';

/**
 * Временный экран проверки токенов и шрифтов.
 * Заменяется на редирект auth → main на следующем шаге.
 */
export default function TokensPreview() {
  const th = useTheme();
  const setTheme = useSettings((s) => s.setTheme);
  const keys = Object.keys(palette.light) as (keyof typeof palette.light)[];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo />
        <Pressable
          onPress={() => setTheme(th.isDark ? 'light' : 'dark')}
          style={{
            height: 36,
            paddingHorizontal: 14,
            borderRadius: th.radius.pill,
            backgroundColor: th.c.mint,
            justifyContent: 'center',
          }}
        >
          <Txt t="pill" color="mintInk">
            {th.isDark ? 'Светлая' : 'Тёмная'}
          </Txt>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingTop: 22 }}>
        <View style={{ gap: 6 }}>
          <Txt t="kicker" color="mut">Типографика · {th.name}</Txt>
          <Txt t="h1">Повторы</Txt>
          <Txt t="question">If I ___ more time, I would practise every day.</Txt>
          <Txt t="body" color="ink2">
            Формула: If + Past Simple, would + инфинитив. Past здесь не про время, а про нереальность.
          </Txt>
          <Txt t="meta" color="mut">обновлён после урока 48 · 10 строк</Txt>
          <Txt t="kicker" color="amber">Уйдёт в повторы · через 4 дня</Txt>
          <Txt t="monoMeta" color="mut">ВС · 7 СЕН   2/5</Txt>
        </View>

        <View style={{ gap: 8 }}>
          <Txt t="kicker" color="mut">Палитра</Txt>
          {keys.map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: th.radius.pill,
                  backgroundColor: th.c[k],
                  borderWidth: 1,
                  borderColor: th.c.line,
                }}
              />
              <Txt t="rowMed" style={{ width: 96 }}>{k}</Txt>
              <Txt t="monoMeta" color="mut">{th.c[k]}</Txt>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
