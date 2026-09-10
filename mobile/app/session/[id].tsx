import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from "react-native-gesture-handler";

import { isBaselineCheck } from "@/features/session/baseline";
import { SpeakerProvider, useStopSpeechOn } from "@/features/session/speaker";
import { stepSubjectId } from "@/features/session/stepSubject";
import { uiLanguageTag } from "@/domain/languages";
import { ttsLangFor } from "@/voice/tts";
import {
  answerAt,
  canProceed,
  critHits,
  evaluateStep,
  isViewingPast,
  primaryAction,
  snapshot,
  viewedStep,
} from "@/features/session/engine";
import {
  ChoiceView,
  ExplainView,
  FeedbackCard,
  InputView,
  OrderView,
} from "@/features/session/StepViews";
import { useVoiceInput } from "@/features/session/useVoiceInput";
import { voiceLangFor } from "@/features/session/voiceLang";
import { useT } from "@/i18n";
import { useReviewPlan } from "@/features/reviews/useReviewPlan";
import { content } from "@/content";
import { prefetchNextLesson } from "@/features/subjects/prepare";
import {
  isUserSubject,
  getLesson,
  REVIEW_ID,
  subjectConfig,
  subjectLanguage,
  useProgress,
} from "@/store/progress";
import { useReviews } from "@/store/reviews";
import { useSession } from "@/store/session";
import { useSettings } from "@/store/settings";
import { Button, MicButton, Screen, SessionHeader, Txt } from "@/ui";
import { useShallow } from "zustand/react/shallow";

/** DESIGN.md §4.3 «Сессия урока» + §4.7 «Голосовой ввод». */
export default function SessionScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const subjects = useProgress((s) => s.subjects);
  const lessons = useProgress((s) => s.lessons);
  const plan = useReviewPlan();
  const lesson = useMemo(
    () =>
      id === REVIEW_ID
        ? plan.lesson
        : getLesson({ subjects, lessons }, id, t.reviewName),
    [subjects, lessons, id, t, plan],
  );
  const cardIds = id === REVIEW_ID ? plan.cardIds : undefined;
  const saved = useProgress((st) => st.sessions[id]);
  const saveSession = useProgress((st) => st.saveSession);
  const uiLang = useSettings((s) => s.lang);
  const mode = useSettings((s) => s.mode);

  const s = useSession((st) => st.s);
  // В повторах язык и настройки голоса — от предмета карточки текущего шага, а не от «Повторов».
  const reviewCards = useReviews((st) => st.cards);
  const subjId = stepSubjectId(s, reviewCards, id);
  const cfg = useProgress(useShallow((st) => subjectConfig(st, subjId)));
  const start = useSession((st) => st.start);
  const select = useSession((st) => st.select);
  const toggleOrder = useSession((st) => st.toggleOrder);
  const setInput = useSession((st) => st.setInput);
  const primary = useSession((st) => st.primary);
  const end = useSession((st) => st.end);
  const back = useSession((st) => st.back);
  const forward = useSession((st) => st.forward);

  useEffect(() => {
    if (lesson && lesson.steps.length > 0 && (!s || s.subjectId !== id))
      start(id, lesson, cardIds, saved);
  }, [id, lesson, cardIds, s, start, saved]);
  // Пока идёт урок N, сервер заготавливает N+1 — после разбора он отдаётся без ожидания.
  useEffect(() => {
    if (isUserSubject({ subjects }, id)) prefetchNextLesson(content, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Показанный шаг может быть пройденным: ответ заморожен, ввод и микрофон выключены.
  const step = s ? viewedStep(s) : null;
  const past = !!s && isViewingPast(s);
  const a = s ? answerAt(s, s.view) : null;
  const hint =
    step && !past && step.type !== "explain" ? step.voice : undefined;
  const voice = useVoiceInput(
    voiceLangFor(subjectLanguage({ subjects }, subjId), cfg, uiLang),
    hint,
    mode === "hands",
  );
  const ttsLang = ttsLangFor(subjectLanguage({ subjects }, subjId), cfg);
  useStopSpeechOn(s?.view);
  // Свайп вправо — к пройденным шагам, влево — вперёд до активного; вертикальная прокрутка не мешает.
  const pan = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-16, 16],
    runOnJS: true,
    onDeactivate: (e) => {
      if (e.translationX < -60) forward();
      else if (e.translationX > 60) back();
    },
  });

  if (!s || !step || !lesson || !a) return <Screen />;

  const n = lesson.steps.length;
  const ok = a.checked ? evaluateStep(step, a) : false;
  const action = primaryAction(s);
  const label = {
    toPractice: t.toPractice,
    answer: t.answer,
    next: t.next,
    toRecap: t.toRecap,
    toCurrent: t.toCurrent,
  }[action];
  const isText = step.type === "input" || step.type === "free";
  const showMic =
    cfg.voice && isText && !a.checked && !past && voice.available === true;

  const onPrimary = () => {
    voice.stop();
    if (primary()) router.replace("/recap");
  };
  const onExit = () => {
    voice.stop();
    // Крестик не теряет прогресс: снимок сессии лежит в предмете до разбора или до нового урока.
    saveSession(id, snapshot(s));
    end();
    router.back();
  };

  let feedback: React.ReactNode = null;
  if (a.checked && step.type !== "explain") {
    const hits = step.type === "free" ? critHits(step, a.input) : [];
    const accepted =
      (step.type === "choice" && step.correct === -1) ||
      (step.type === "input" && step.tokens.length === 0);
    const title = accepted
      ? t.accepted2
      : step.type === "free"
        ? t.critScore(hits.filter(Boolean).length, step.criteria.length)
        : ok
          ? t.right
          : t.notQuite;
    const tone = ok
      ? "mint"
      : step.type === "free" && hits.some(Boolean)
        ? "amber"
        : "err";
    feedback = (
      <FeedbackCard
        title={title}
        text={step.explain}
        tone={tone}
        answer={step.type === "input" && !ok ? step.answer : undefined}
        criteria={
          step.type === "free"
            ? step.criteria.map((c, i) => ({ t: c.t, hit: !!hits[i] }))
            : undefined
        }
      />
    );
  }

  return (
    <SpeakerProvider lang={ttsLang} uiLang={uiLanguageTag[uiLang]}>
      <Screen>
        <SessionHeader
          chip={lesson.name}
          counter={`${s.view + 1}/${n}`}
          onClose={onExit}
          total={n}
          current={s.view}
        />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={8}
          >
            <GestureDetector gesture={pan}>
              <View style={{ flex: 1 }}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={{ flex: 1, marginHorizontal: -4 }}
                  contentContainerStyle={{
                    paddingHorizontal: 4,
                    paddingBottom: 8,
                  }}
                >
                  {past ? (
                    <Txt t="tiny" color="mut" style={{ marginTop: 16 }}>
                      {t.viewingPast}
                    </Txt>
                  ) : null}
                  {isBaselineCheck(lesson, step) ? (
                    <View style={{ marginTop: 20 }}>
                      <Txt
                        t="kicker"
                        color="amber"
                        style={{ letterSpacing: 0.84 }}
                      >
                        {t.baselineKicker}
                      </Txt>
                      <Txt t="meta" color="mut" style={{ marginTop: 4 }}>
                        {t.baselineNote}
                      </Txt>
                    </View>
                  ) : null}
                  {step.type === "explain" ? <ExplainView step={step} /> : null}
                  {step.type === "choice" ? (
                    <ChoiceView
                      step={step}
                      sel={a.sel}
                      checked={a.checked}
                      onSelect={select}
                    />
                  ) : null}
                  {step.type === "order" ? (
                    <OrderView
                      step={step}
                      ordSel={a.ordSel}
                      checked={a.checked}
                      onToggle={toggleOrder}
                    />
                  ) : null}
                  {isText ? (
                    <InputView
                      step={step}
                      value={a.input}
                      checked={a.checked || past}
                      onChange={setInput}
                    />
                  ) : null}
                  {isText && !a.checked && !past ? (
                    <>
                      {showMic ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 8,
                            marginLeft: -8,
                          }}
                        >
                          <MicButton
                            recording={voice.rec}
                            onPress={mode === "hands" ? voice.toggle : () => {}}
                            onPressIn={mode === "ptt" ? voice.start : undefined}
                            onPressOut={mode === "ptt" ? voice.stop : undefined}
                          />
                          <Txt
                            t="meta"
                            color="mut"
                            style={{ flex: 1, lineHeight: 19 }}
                          >
                            {voice.rec ? t.micRec : t.micIdle}
                          </Txt>
                        </View>
                      ) : null}
                      <Txt t="tiny" color="mut" style={{ marginTop: 12 }}>
                        {t.noHints}
                      </Txt>
                    </>
                  ) : null}
                  {feedback}
                </ScrollView>
              </View>
            </GestureDetector>
            <Button
              label={label}
              onPress={onPrimary}
              disabled={!canProceed(s)}
              style={{ marginTop: 10 }}
            />
          </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Screen>
    </SpeakerProvider>
  );
}
