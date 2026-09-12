import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import type { Reference } from '@/domain/reference';
import { filterRefs, refSubjects, weakCount } from '@/features/refs/filter';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { activeSubjectIds, useProgress } from '@/store/progress';
import { useRefs } from '@/store/refs';
import { useTheme } from '@/theme';
import { AppHeader, Card, Chip, Screen, SubjectTabs, TabTitle, Txt } from '@/ui';

const ALL = 'all';

function RefCard({ r, subject, onPress }: { r: Reference; subject?: string; onPress: () => void }) {
  const t = useT();
  const weak = weakCount(r);
  return (
    <Card large onPress={onPress} style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt t="rowMed" style={{ flex: 1, fontFamily: 'GolosText_600SemiBold', lineHeight: 20 }}>{r.title}</Txt>
        {weak > 0 ? <Chip label={t.weakN(weak)} tone="amber" small /> : null}
      </View>
      <Txt t="tiny" color="mut" style={{ marginTop: 5 }}>{`${subject ? `${subject} · ` : ''}${t.updL} ${r.updatedAfter} · ${r.rows.length} ${t.rowsL}`}</Txt>
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
  const removed = useProgress((st) => st.removed);
  const userSubjects = useProgress((st) => st.subjects);
  // Вкладки в том же порядке, что предметы на «Сегодня».
  const order = useMemo(() => activeSubjectIds({ removed, subjects: userSubjects }), [removed, userSubjects]);
  const subjects = useMemo(() => refSubjects(refs, order), [refs, order]);
  // «Все» открыты по умолчанию, как в «Повторах»: справочники сразу видны все.
  const tabs = useMemo(() => [{ id: ALL, name: t.allSubjects }, ...subjects], [subjects, t]);
  const [subjectId, setSubjectId] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [weakOnly, setWeakOnly] = useState(false);

  useEffect(() => {
    if (!tabs.some((x) => x.id === subjectId)) setSubjectId(ALL);
  }, [tabs, subjectId]);

  const scoped = subjectId === ALL ? undefined : subjectId;
  const groups = useMemo(() => filterRefs(refs, scoped, query, weakOnly), [refs, scoped, query, weakOnly]);

  return (
    <Screen noBottom>
      <AppHeader userName={name} onAvatar={() => router.push('/profile')} />
      <TabTitle title={t.refs} note={t.refsNote} />
      {subjects.length === 0 ? <Txt t="row" color="mut" style={{ marginTop: 18, fontSize: 14, lineHeight: 21 }}>{t.emptyRefsText}</Txt> : null}
      {tabs.length > 2 ? <SubjectTabs items={tabs} value={subjectId} onChange={setSubjectId} /> : null}
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
                <RefCard key={r.id} r={r} subject={scoped ? undefined : r.subjectName} onPress={() => router.push({ pathname: '/ref/[id]', params: { id: r.id } })} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
