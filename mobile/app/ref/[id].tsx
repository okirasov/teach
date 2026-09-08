import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { sectionRows } from '@/features/refs/filter';
import { useT } from '@/i18n';
import { useRefs } from '@/store/refs';
import { useTheme } from '@/theme';
import { Screen, Txt } from '@/ui';

/** DESIGN.md §4.8, детальный экран: поиск внутри, таблица «термин 126px | описание», подразделы, бейдж ОШИБКА. */
export default function RefDetailScreen() {
  const t = useT();
  const router = useRouter();
  const { c, radius, size, fonts } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ref = useRefs((s) => s.refs.find((x) => x.id === id));
  const [query, setQuery] = useState('');
  const secs = useMemo(() => (ref ? sectionRows(ref, query) : []), [ref, query]);
  if (!ref) return <Screen />;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="back"
          onPress={() => router.back()}
          hitSlop={8}
          style={{ width: size.closeCircle, height: size.closeCircle, borderRadius: size.closeCircle / 2, backgroundColor: c.mint, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt t="body" color="mintInk" style={{ fontSize: 16, lineHeight: 18 }}>←</Txt>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ backgroundColor: c.mint, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.chip }}>
            <Txt t="chip" color="mintInk" style={{ letterSpacing: 0.9 }}>{t.refChip}</Txt>
          </View>
        </View>
        <View style={{ width: size.closeCircle }} />
      </View>
      <Txt t="h2" style={{ marginTop: 20, lineHeight: 29 }}>{ref.title}</Txt>
      <Txt t="small" color="mut" style={{ marginTop: 4, lineHeight: 19 }}>{`${t.updL} ${ref.updatedAfter} · ${ref.rows.length} ${t.rowsL}`}</Txt>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t.searchInPh}
        placeholderTextColor={c.mut2}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          backgroundColor: c.card, borderWidth: 1, borderColor: c.line2, borderRadius: radius.input, paddingVertical: 11, paddingHorizontal: 14,
          marginTop: 12, fontFamily: fonts.sans400, fontSize: 13.5, lineHeight: 19, color: c.ink,
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -4, marginTop: 6 }} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 8 }}>
        {secs.map((sec, i) => (
          <View key={sec.sec || `_${i}`}>
            {sec.sec ? <Txt t="kicker" color="mut" style={{ marginTop: 16, marginBottom: 4 }}>{sec.sec}</Txt> : null}
            {sec.rows.map((row, j) => (
              <View key={`${row.k}-${j}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.lineSoft }}>
                <Txt t="meta" color="mintInk" style={{ width: size.refTermCol, fontFamily: fonts.sans600, lineHeight: 19 }}>{row.k}</Txt>
                <Txt t="meta" color="ink2" style={{ flex: 1, minWidth: 0, lineHeight: 20 }}>{row.v}</Txt>
                {row.weak ? (
                  <View style={{ backgroundColor: c.amberBg, paddingVertical: 4, paddingHorizontal: 7, borderRadius: radius.chip }}>
                    <Txt t="chipSm" color="amber" style={{ fontSize: 9, lineHeight: 11, letterSpacing: 0.45 }}>{t.weakBadge}</Txt>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
