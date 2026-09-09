import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { content, type FocusOption, type PlanStage, type SourceCandidate, type Trust } from '@/content';
import { createSubjectAndPrepare } from '@/features/subjects/prepare';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Card, Screen, SessionHeader, Txt } from '@/ui';

const STEPS = 5;

/** DESIGN.md §4.6 «Новый предмет»: тема → сужение → миссия → источники → план. */
export default function SetupScreen() {
  const t = useT();
  const router = useRouter();
  const { c, radius, border, fonts } = useTheme();

  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState('');
  const [focus, setFocus] = useState('');
  const [mission, setMission] = useState('');
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [focusOpts, setFocusOpts] = useState<FocusOption[]>([]);
  const [sources, setSources] = useState<SourceCandidate[]>([]);
  const [plan, setPlan] = useState<PlanStage[]>([]);
  const [title, setTitle] = useState<string>('');

  const topicT = topic.trim();
  const focusT = focus.trim();
  const missionT = mission.trim();

  /** Сетевые шаги: idle → loading → ok | error; ошибка показывает «Повторить», кнопка «Дальше» ждёт данных. */
  const [net, setNet] = useState<'idle' | 'loading' | 'error'>('idle');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const req =
      step === 1 ? Promise.all([content.suggestFocus(topicT).then(setFocusOpts), content.suggestTitle(topicT).then(setTitle).catch(() => setTitle(''))])
      : step === 3 ? content.findSources(topicT, focusT).then(setSources)
      : step === 4 ? content.buildPlan({ topic: topicT, focus: focusT, mission: missionT }).then(setPlan)
      : null;
    if (!req) return;
    let alive = true;
    setNet('loading');
    req.then(() => alive && setNet('idle')).catch(() => alive && setNet('error'));
    return () => {
      alive = false;
    };
  }, [step, topicT, focusT, missionT, attempt]);
  const netBlock = (loadingText: string) =>
    net === 'idle' ? null : (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <Txt t="meta" color={net === 'error' ? 'err' : 'mut'} style={{ flexShrink: 1 }}>
          {net === 'error' ? t.loadFailed : loadingText}
        </Txt>
        {net === 'error' ? (
          <Pressable accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)} hitSlop={8}>
            <Txt t="metaMed" color="mintInk">{t.retry} →</Txt>
          </Pressable>
        ) : null}
      </View>
    );

  const kept = useMemo(() => sources.filter((s) => !excluded[s.id]), [sources, excluded]);
  const canNext = net === 'idle' && [topicT.length > 0, focusT.length > 0, missionT.length > 0, kept.length > 0, true][step];
  const label = [t.setupNext, t.setupNext, t.setupNext, t.setupBuild, t.done][step];

  const onNext = () => {
    if (!canNext) return;
    if (step < STEPS - 1) {
      setStep(step + 1);
      return;
    }
    // Подготовка идёт в фоне, экран закрывается сразу (без спиннера).
    void createSubjectAndPrepare(content, { topic: topicT, title: title || undefined, focus: focusT, mission: missionT, sourceIds: kept.map((s) => s.id), sources: kept });
    router.dismissTo('/(tabs)/today');
  };

  const inputStyle = (accent: boolean) => ({
    backgroundColor: c.card,
    borderWidth: accent ? border.input : 1,
    borderColor: accent ? c.mintInk : c.line2,
    borderRadius: accent ? radius.card : radius.input,
    paddingVertical: accent ? 15 : 12,
    paddingHorizontal: accent ? 16 : 14,
    fontFamily: fonts.sans400,
    fontSize: accent ? 15 : 14,
    lineHeight: accent ? 22 : 21,
    color: c.ink,
  });

  const trustTone: Record<Trust, { bg: string; fg: string; label: string }> = {
    high: { bg: c.mint, fg: c.mintInk, label: t.trustHigh },
    mid: { bg: c.amberBg, fg: c.amber, label: t.trustMid },
    low: { bg: c.errBg, fg: c.errInk, label: t.trustLow },
  };

  return (
    <Screen>
      <SessionHeader chip={t.newSubjChip} chipDark counter={`${step + 1}/${STEPS}`} onClose={() => router.back()} total={STEPS} current={step} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ marginHorizontal: -4 }}
          contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 8 }}
        >
          {step === 0 ? (
            <>
              <Txt t="h2" style={{ marginTop: 22, lineHeight: 29 }}>{t.setupTopicTitle}</Txt>
              <TextInput value={topic} onChangeText={setTopic} placeholder={t.setupTopicPh} placeholderTextColor={c.mut2} style={[inputStyle(true), { marginTop: 16 }]} autoFocus />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {t.setupTopicChips.map((label) => (
                  <Pressable key={label} accessibilityRole="button" onPress={() => setTopic(label)} style={{ backgroundColor: c.mint, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.chip }}>
                    <Txt t="pill" color="mintInk">{label}</Txt>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Txt t="kicker" color="amber" style={{ marginTop: 22, letterSpacing: 0.84 }}>{t.setupNarrowKicker}</Txt>
              <Txt t="h2" style={{ marginTop: 10, lineHeight: 29 }}>{t.setupNarrowTitle(topicT || t.topicPh)}</Txt>
              <Txt t="row" color="mut" style={{ marginTop: 10, fontSize: 13.5, lineHeight: 21 }}>{t.setupNarrowNote}</Txt>
              {netBlock(t.loadingFocus)}
              <View style={{ gap: 9, marginTop: 14 }}>
                {focusOpts.map((o) => {
                  const active = focusT === o.t;
                  return (
                    <Pressable
                      key={o.t}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setFocus(o.t)}
                      style={{
                        backgroundColor: active ? c.sel : c.card, borderWidth: border.input, borderColor: active ? c.mintInk : c.line2,
                        borderRadius: radius.input, paddingVertical: 13, paddingHorizontal: 14,
                      }}
                    >
                      <Txt t="rowMed">{o.t}</Txt>
                      <Txt t="tiny" color="mut" style={{ marginTop: 3 }}>{o.d}</Txt>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput value={focus} onChangeText={setFocus} placeholder={t.setupNarrowPh} placeholderTextColor={c.mut2} style={[inputStyle(false), { marginTop: 10 }]} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Txt t="kicker" color="amber" style={{ marginTop: 22, letterSpacing: 0.84 }}>{t.setupMissionKicker}</Txt>
              <Txt t="h2" style={{ marginTop: 10, lineHeight: 29 }}>{t.setupMissionTitle(topicT || t.topicPh)}</Txt>
              <TextInput value={mission} onChangeText={setMission} maxLength={100} placeholder={t.setupMissionPh} placeholderTextColor={c.mut2} style={[inputStyle(true), { marginTop: 16 }]} autoFocus />
              <View style={{ backgroundColor: c.mint, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 16, marginTop: 14 }}>
                <Txt t="row" style={{ fontSize: 13.5, lineHeight: 21 }}>{t.setupMissionNote}</Txt>
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Txt t="h2" style={{ marginTop: 22, lineHeight: 29 }}>{t.setupSourcesTitle}</Txt>
              <Txt t="row" color="mut" style={{ marginTop: 10, fontSize: 13.5, lineHeight: 21 }}>{t.setupSourcesNote(focusT || topicT || t.focusPh)}</Txt>
              {netBlock(t.loadingSources)}
              <View style={{ gap: 9, marginTop: 14 }}>
                {sources.map((s) => {
                  const off = !!excluded[s.id];
                  const tone = trustTone[s.trust];
                  return (
                    <Card
                      key={s.id}
                      onPress={() => setExcluded((e) => ({ ...e, [s.id]: !off }))}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, opacity: off ? 0.45 : 1 }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt t="item" style={{ lineHeight: 20 }}>{s.t}</Txt>
                        <Txt t="tiny" color="mut" style={{ marginTop: 3 }}>{s.m}</Txt>
                      </View>
                      <View style={{ backgroundColor: off ? c.sand : tone.bg, paddingVertical: 6, paddingHorizontal: 9, borderRadius: radius.chip }}>
                        <Txt t="chipSm" style={{ color: off ? c.sandInk : tone.fg }}>{off ? t.srcExcluded : tone.label}</Txt>
                      </View>
                    </Card>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Txt t="h2" style={{ marginTop: 22, lineHeight: 29 }}>{t.setupPlanTitle}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
                <Txt t="kicker" color="amber" style={{ letterSpacing: 0.84 }}>{t.why}</Txt>
                <Txt t="meta" color="mut" numberOfLines={2} style={{ flexShrink: 1 }}>{missionT || t.missionPh}</Txt>
              </View>
              {netBlock(t.loadingPlan)}
              <View style={{ gap: 9, marginTop: 16 }}>
                {plan.map((ms) => (
                  <Card key={ms.n} style={{ flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
                    <Txt t="monoMeta" color="amber" style={{ fontSize: 12, lineHeight: 18 }}>{ms.n}</Txt>
                    <View style={{ flex: 1 }}>
                      <Txt t="rowMed">{ms.t}</Txt>
                      <Txt t="small" color="mut" style={{ marginTop: 3, lineHeight: 19 }}>{ms.d}</Txt>
                    </View>
                  </Card>
                ))}
              </View>
              <View style={{ backgroundColor: c.mint, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 16, marginTop: 14 }}>
                <Txt t="row" style={{ fontSize: 13.5, lineHeight: 21 }}>{t.setupPlanNote}</Txt>
              </View>
            </>
          ) : null}
        </ScrollView>
        <Button label={label} onPress={onNext} disabled={!canNext} style={{ marginTop: 10 }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
