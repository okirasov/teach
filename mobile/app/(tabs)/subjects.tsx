import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { activeSubjectIds, isUserSubject, subjectName, useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { AppHeader, Button, Card, Chip, Screen, TabTitle, Txt } from '@/ui';

function Gear({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx={12} cy={12} r={3.2} />
      <Path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" />
    </Svg>
  );
}

/** Карточка предмета (DESIGN.md §4.9): имя, vN, шестерёнка, миссия, зачёркнутая история, «Изменить →». */
function MissionCard({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const { c, radius, border, fonts } = useTheme();
  const name = useProgress((s) => subjectName(s, id));
  const demo = useProgress((s) => !isUserSubject(s, id));
  const mission = useProgress((s) => s.missions[id]);
  const setMission = useProgress((s) => s.setMission);
  const [draft, setDraft] = useState<string | null>(null);
  const m = mission ?? { cur: '—', hist: [] };

  return (
    <Card large>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Txt t="body" style={{ fontFamily: fonts.sans600, lineHeight: 20, flexShrink: 1 }}>{name}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {demo ? <Chip label={t.demo} tone="sand" small /> : null}
          <View style={{ backgroundColor: c.sand, paddingVertical: 6, paddingHorizontal: 9, borderRadius: radius.chip }}>
            <Txt t="chipSm" color="sandInk">{`v${m.hist.length + 1}`}</Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="settings"
            hitSlop={8}
            onPress={() => router.push({ pathname: '/subject/[id]', params: { id } })}
            style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.mint, alignItems: 'center', justifyContent: 'center' }}
          >
            <Gear color={c.mintInk} />
          </Pressable>
        </View>
      </View>
      {draft !== null ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            maxLength={100}
            autoFocus
            style={{
              backgroundColor: c.bg, borderWidth: border.input, borderColor: c.mintInk, borderRadius: radius.input,
              paddingVertical: 12, paddingHorizontal: 14, marginTop: 10, fontFamily: fonts.sans400, fontSize: 14, lineHeight: 21, color: c.ink,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button
              variant="primary"
              label={t.save}
              disabled={!draft.trim()}
              onPress={() => {
                if (draft.trim() && draft.trim() !== m.cur) setMission(id, draft.trim());
                setDraft(null);
              }}
              style={{ height: 38, borderRadius: radius.pill, paddingHorizontal: 16 }}
            />
            <Button variant="mint" label={t.cancel} onPress={() => setDraft(null)} style={{ height: 38, borderRadius: radius.pill, paddingHorizontal: 16 }} />
          </View>
        </>
      ) : (
        <>
          <Txt t="body" numberOfLines={2} style={{ fontFamily: fonts.sans500, marginTop: 8, lineHeight: 22 }}>{m.cur}</Txt>
          {m.hist.map((h) => (
            <Txt key={h} t="small" color="mut2" style={{ marginTop: 6, textDecorationLine: 'line-through', lineHeight: 19 }}>{h}</Txt>
          ))}
          <Pressable accessibilityRole="button" onPress={() => setDraft(m.cur)} hitSlop={6} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            <Txt t="metaMed" color="mintInk">{t.edit} →</Txt>
          </Pressable>
        </>
      )}
    </Card>
  );
}

/** DESIGN.md §4.9 «Предметы»: карточки миссий, внизу закреплена «+ Новый предмет». */
export default function SubjectsScreen() {
  const t = useT();
  const router = useRouter();
  const { c, radius, space } = useTheme();
  const name = useAuth((s) => s.account?.name ?? '');
  const removed = useProgress((s) => s.removed);
  const subjects = useProgress((s) => s.subjects);
  const ids = activeSubjectIds({ removed, subjects });

  return (
    <Screen noBottom>
      <AppHeader userName={name} onAvatar={() => router.push('/profile')} />
      <TabTitle title={t.mission} note={t.missionNote} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 8 }}>
        <View style={{ gap: 10, marginTop: 18 }}>
          {ids.length === 0 ? <Txt t="row" color="mut" style={{ fontSize: 14, lineHeight: 21 }}>{t.emptySubjectsText}</Txt> : null}
          {ids.map((id) => <MissionCard key={id} id={id} />)}
        </View>
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/setup')}
        style={{
          borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line2, borderRadius: radius.cardLg, padding: 15,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 + space.sm,
        }}
      >
        <Txt t="body" color="mintInk" style={{ fontSize: 18, lineHeight: 20 }}>+</Txt>
        <Txt t="rowMed" color="mintInk" style={{ fontSize: 14, lineHeight: 16 }}>{t.newSubj}</Txt>
      </Pressable>
    </Screen>
  );
}
