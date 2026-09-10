import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { deleteSubject } from '@/features/subjects/deleteSubject';
import { voiceLangOptions } from '@/features/subjects/voiceLangOptions';
import { useT } from '@/i18n';
import { subjectConfig, subjectLanguage, subjectName, useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';
import { Card, PillGroup, Screen, SessionHeader, Toggle, TwoStepConfirm, Txt } from '@/ui';

/** DESIGN.md §4.10 «Настройки предмета». */
export default function SubjectSettingsScreen() {
  const t = useT();
  const router = useRouter();
  const { c, fonts } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uiLang = useSettings((s) => s.lang);
  const name = useProgress((s) => subjectName(s, id));
  const mission = useProgress((s) => s.missions[id]?.cur ?? '');
  const cfg = useProgress(useShallow((s) => subjectConfig(s, id)));
  const rawCfg = useProgress((s) => s.cfg[id]);
  const subjects = useProgress((s) => s.subjects);
  const setCfg = useProgress((s) => s.setCfg);
  const patch = (p: Parameters<typeof setCfg>[1]) => setCfg(id, p);
  const vl = voiceLangOptions(t, subjectLanguage({ subjects }, id), uiLang, rawCfg ?? {});

  const rowTitle = (label: string, desc?: string) => (
    <View style={{ flexShrink: 1 }}>
      <Txt t="rowMed" style={{ lineHeight: 19 }}>{label}</Txt>
      {desc ? <Txt t="tiny" color="mut" style={{ marginTop: 3 }}>{desc}</Txt> : null}
    </View>
  );
  const section = (label: string, children: React.ReactNode, last?: boolean) => (
    <View style={{ paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.lineSoft }}>
      <Txt t="rowMed" style={{ lineHeight: 19 }}>{label}</Txt>
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );

  return (
    <Screen>
      <SessionHeader chip={t.manageChip} chipDark onClose={() => router.back()} />
      <Txt t="h1" numberOfLines={1} style={{ marginTop: 20 }}>{name}</Txt>
      <ScrollView showsVerticalScrollIndicator={false} style={{ marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 8 }}>
        <Txt t="meta" color="mut" numberOfLines={2} style={{ marginTop: 6, lineHeight: 20 }}>{mission}</Txt>

        <Card large padding={0} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 15, paddingHorizontal: 16 }}>
            {rowTitle(t.pause, t.pauseD)}
            <Toggle value={cfg.pause} onChange={(v) => patch({ pause: v })} label={t.pause} />
          </View>
        </Card>

        <Card large padding={0} style={{ marginTop: 10 }}>
          {section(t.dur, <PillGroup options={[3, 5, 10].map((v) => ({ value: v as 3 | 5 | 10, label: `${v} ${t.minU}` }))} value={cfg.dur} onChange={(v) => patch({ dur: v })} />)}
          {section(t.limit, <PillGroup options={[10, 20, 50].map((v) => ({ value: v as 10 | 20 | 50, label: `${v} ${t.perDay}` }))} value={cfg.lim} onChange={(v) => patch({ lim: v })} />)}
          {section(t.diff, <PillGroup options={[{ value: 'comfy' as const, label: t.diffA }, { value: 'edge' as const, label: t.diffB }]} value={cfg.diff} onChange={(v) => patch({ diff: v })} />)}
          <View style={{ paddingVertical: 15, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {rowTitle(t.voiceC, t.voiceD)}
              <Toggle value={cfg.voice} onChange={(v) => patch({ voice: v })} label={t.voiceC} />
            </View>
            {cfg.voice ? (
              <>
                <Txt t="rowMed" style={{ marginTop: 14, lineHeight: 19, fontFamily: fonts.sans500 }}>{t.voiceLang}</Txt>
                <View style={{ marginTop: 8 }}>
                  <PillGroup options={vl.options} value={vl.current} onChange={(v) => patch({ vlang: v })} />
                </View>
              </>
            ) : null}
            {subjectLanguage({ subjects }, id) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.lineSoft }}>
                {rowTitle(t.ttsC, t.ttsD)}
                <Toggle value={cfg.tts !== false} onChange={(v) => patch({ tts: v })} label={t.ttsC} />
              </View>
            ) : null}
          </View>
        </Card>
      </ScrollView>
      <TwoStepConfirm
        label={t.del}
        message={t.delConfirm}
        yes={t.delYes}
        no={t.delNo}
        onConfirm={() => {
          void deleteSubject(id);
          router.dismissTo('/(tabs)/today');
        }}
      />
    </Screen>
  );
}
