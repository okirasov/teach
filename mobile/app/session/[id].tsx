import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { canProceed, critHits, currentStep, evaluate, primaryAction } from '@/features/session/engine';
import { ChoiceView, ExplainView, FeedbackCard, InputView, OrderView } from '@/features/session/StepViews';
import { useVoiceInput } from '@/features/session/useVoiceInput';
import { voiceLangFor } from '@/features/session/voiceLang';
import { useT } from '@/i18n';
import { useReviewPlan } from '@/features/reviews/useReviewPlan';
import { getLesson, REVIEW_ID, subjectConfig, useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { Button, MicButton, Screen, SessionHeader, Txt } from '@/ui';
import { useShallow } from 'zustand/react/shallow';

/** DESIGN.md §4.3 «Сессия урока» + §4.7 «Голосовой ввод». */
export default function SessionScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const custom = useProgress((s) => s.custom);
  const customLesson = useProgress((s) => s.customLesson);
  const plan = useReviewPlan();
  const lesson = useMemo(
    () => (id === REVIEW_ID ? plan.lesson : getLesson({ custom, customLesson }, id, t.reviewName)),
    [custom, customLesson, id, t, plan],
  );
  const cardIds = id === REVIEW_ID ? plan.cardIds : undefined;
  const cfg = useProgress(useShallow((s) => subjectConfig(s, id)));
  const uiLang = useSettings((s) => s.lang);
  const mode = useSettings((s) => s.mode);

  const s = useSession((st) => st.s);
  const start = useSession((st) => st.start);
  const select = useSession((st) => st.select);
  const toggleOrder = useSession((st) => st.toggleOrder);
  const setInput = useSession((st) => st.setInput);
  const primary = useSession((st) => st.primary);
  const end = useSession((st) => st.end);

  useEffect(() => {
    if (lesson && lesson.steps.length > 0 && (!s || s.subjectId !== id)) start(id, lesson, cardIds);
  }, [id, lesson, cardIds, s, start]);

  const step = s ? currentStep(s) : null;
  const hint = step && step.type !== 'explain' ? step.voice : undefined;
  const voice = useVoiceInput(voiceLangFor(lesson?.name ?? '', cfg, uiLang), hint, mode === 'hands');

  if (!s || !step || !lesson) return <Screen />;

  const n = lesson.steps.length;
  const ok = s.checked ? evaluate(s) : false;
  const action = primaryAction(s);
  const label = { toPractice: t.toPractice, answer: t.answer, next: t.next, toRecap: t.toRecap }[action];
  const isText = step.type === 'input' || step.type === 'free';
  const showMic = cfg.voice && isText && !s.checked && voice.available === true;

  const onPrimary = () => {
    voice.stop();
    if (primary()) router.replace('/recap');
  };
  const onExit = () => {
    voice.stop();
    end();
    router.back();
  };

  let feedback: React.ReactNode = null;
  if (s.checked && step.type !== 'explain') {
    const hits = step.type === 'free' ? critHits(step, s.input) : [];
    const accepted = (step.type === 'choice' && step.correct === -1) || (step.type === 'input' && step.tokens.length === 0);
    const title = accepted
      ? t.accepted2
      : step.type === 'free'
        ? t.critScore(hits.filter(Boolean).length, step.criteria.length)
        : ok
          ? t.right
          : t.notQuite;
    const tone = ok ? 'mint' : step.type === 'free' && hits.some(Boolean) ? 'amber' : 'err';
    feedback = (
      <FeedbackCard
        title={title}
        text={step.explain}
        tone={tone}
        answer={step.type === 'input' && !ok ? step.answer : undefined}
        criteria={step.type === 'free' ? step.criteria.map((c, i) => ({ t: c.t, hit: !!hits[i] })) : undefined}
      />
    );
  }

  return (
    <Screen>
      <SessionHeader chip={lesson.name} counter={`${s.step + 1}/${n}`} onClose={onExit} total={n} current={s.step} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ marginHorizontal: -4 }}
          contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 8 }}
        >
          {step.type === 'explain' ? <ExplainView step={step} /> : null}
          {step.type === 'choice' ? <ChoiceView step={step} sel={s.sel} checked={s.checked} onSelect={select} /> : null}
          {step.type === 'order' ? <OrderView step={step} ordSel={s.ordSel} checked={s.checked} onToggle={toggleOrder} /> : null}
          {isText ? <InputView step={step} value={s.input} checked={s.checked} onChange={setInput} /> : null}
          {isText && !s.checked ? (
            <>
              {showMic ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: -8 }}>
                  <MicButton
                    recording={voice.rec}
                    onPress={mode === 'hands' ? voice.toggle : () => {}}
                    onPressIn={mode === 'ptt' ? voice.start : undefined}
                    onPressOut={mode === 'ptt' ? voice.stop : undefined}
                  />
                  <Txt t="meta" color="mut" style={{ flex: 1, lineHeight: 19 }}>{voice.rec ? t.micRec : t.micIdle}</Txt>
                </View>
              ) : null}
              <Txt t="tiny" color="mut" style={{ marginTop: 12 }}>{t.noHints}</Txt>
            </>
          ) : null}
          {feedback}
        </ScrollView>
        <Button label={label} onPress={onPrimary} disabled={!canProceed(s)} style={{ marginTop: 10 }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
