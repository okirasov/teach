import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import type { Reference } from '@/domain/reference';
import { filterRefs, refSubjects, weakCount } from '@/features/refs/filter';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useRefs } from '@/store/refs';
import { useTheme } from '@/theme';
import { AppHeader, Card, Chip, Screen, TabTitle, Txt } from '@/ui';

function RefCard({ r, onPress }: { r: Reference; onPress: () => void }) {
  const t = useT();
  const weak = weakCount(r);
  return (
    <Card large onPress={onPress} style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt t="rowMed" style={{ flex: 1, fontFamily: 'GolosText_600SemiBold', lineHeight: 20 }}>{r.title}</Txt>
        {weak > 0 ? <Chip label={t.weakN(weak)} tone="amber" small /> : null}
      </View>
      <Txt t="tiny" color="mut" style={{ marginTop: 5 }}>{`${t.updL} ${r.updatedAfter} · ${r.rows.length} ${t.rowsL}`}</Txt>
    </Card>
  );
}

/** DESIGN.md §4.8 «Справочники»: сегменты предметов, поиск, фильтр «Слабые места», группы карточек. */
export default function RefsScreen() {
  const t = useT();
  const router = useRouter();
  const { c, radius, size, space, fonts } = useTheme();
  const name = useAuth((s) => s.account?.name ?? '');
  const refs = useRefs((s) => s.refs);
  const subjects = useMemo(() => refSubjects(refs), [refs]);
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [weakOnly, setWeakOnly] = useState(false);

  useEffect(() => {
    if (!subjects.some((s) => s.id === subjectId) && subjects[0]) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);

  const groups = useMemo(() => filterRefs(refs, subjectId, query, weakOnly), [refs, subjectId, query, weakOnly]);

  return (
    <Screen noBottom>
      <AppHeader userName={name} onAvatar={() => router.push('/profile')} />
      <TabTitle title={t.refs} note={t.refsNote} />
      {subjects.length === 0 ? <Txt t="row" color="mut" style={{ marginTop: 18, fontSize: 14, lineHeight: 21 }}>{t.emptyRefsText}</Txt> : null}
      <View style={{ marginTop: 14, marginHorizontal: -space.screenX }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.screenX, gap: 8 }}>
          {subjects.map((s) => {
            const active = s.id === subjectId;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSubjectId(s.id)}
                style={{ height: size.pill, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: active ? c.mintInk : c.mint, justifyContent: 'center' }}
              >
                <Txt t="pill" style={{ color: active ? c.btnInk : c.mintInk }} numberOfLines={1}>{s.name}</Txt>
              </Pressable>
            );
          })}
        </ScrollView>
        <LinearGradient colors={['transparent', c.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 1, width: 36 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.searchPh}
          placeholderTextColor={c.mut2}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1, minWidth: 0, height: size.pill, backgroundColor: c.card, borderWidth: 1, borderColor: c.line2, borderRadius: radius.pill,
            paddingHorizontal: 14, paddingVertical: 0, fontFamily: fonts.sans400, fontSize: 13.5, color: c.ink,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: weakOnly }}
          onPress={() => setWeakOnly((v) => !v)}
          style={{ height: size.pill, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: c.amber, backgroundColor: weakOnly ? c.amber : 'transparent', justifyContent: 'center' }}
        >
          <Txt t="smallMed" style={{ color: weakOnly ? '#FAF6EE' : c.amber }} numberOfLines={1}>{t.weakF}</Txt>
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 16 }}>
        {groups.map((g) => (
          <View key={g.group}>
            <Txt t="kicker" color="mut" style={{ marginTop: 18 }}>{g.group}</Txt>
            <View style={{ gap: 9, marginTop: 10 }}>
              {g.items.map((r) => (
                <RefCard key={r.id} r={r} onPress={() => router.push({ pathname: '/ref/[id]', params: { id: r.id } })} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
