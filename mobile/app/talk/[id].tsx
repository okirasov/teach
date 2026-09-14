import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { subjectLanguage, useProgress, subjectConfig, subjectName } from '@/store/progress';
import { voiceLangFor } from '@/features/session/voiceLang';
import { useTalk } from '@/features/talk/useTalk';
import { useT } from '@/i18n';
import { uiLanguageTag } from '@/domain/languages';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';
import { BuddyDockView, MicButton, Screen, SessionHeader, Txt, useReduceMotion } from '@/ui';
import { ttsLangFor } from '@/voice/tts';

/** Разговор с бадди (FR-66): лента реплик, док, большой микрофон. Ничего не хранит локально. */
export default function TalkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const { c, size } = useTheme();
  const reduceMotion = useReduceMotion();
  const uiLang = useSettings((s) => s.lang);
  const sub = useProgress((s) => s.subjects[id]);
  const subjects = useProgress((s) => s.subjects);
  const cfg = useProgress(useShallow((st) => subjectConfig(st, id)));
  const language = subjectLanguage({ subjects }, id);
  const talk = useTalk({
    remoteId: sub?.remoteId ?? '',
    sttLang: voiceLangFor(language, cfg, uiLang),
    ttsLang: ttsLangFor(language, cfg) ?? uiLanguageTag[uiLang],
    uiLang: uiLanguageTag[uiLang],
  });
  const word = talk.state.phase === 'speaking' ? t.talk.talking : t.buddy[talk.buddyState];
  const hint = talk.state.error ? t.talk.errorNet : talk.state.phase === 'listening' ? t.talk.hintListening : talk.state.phase === 'speaking' ? t.talk.hintSpeaking : talk.state.phase === 'waiting' ? t.talk.hintWaiting : '';
  const mm = String(Math.floor(talk.seconds / 60)).padStart(2, '0');
  const ss = String(talk.seconds % 60).padStart(2, '0');
  const stageN = String((sub?.planStage ?? 0) + 1).padStart(2, '0');

  const onClose = () => {
    talk.close();
    router.back();
  };

  return (
    <Screen>
      <SessionHeader chip={subjectName({ subjects }, id)} counter={`${mm}:${ss}`} onClose={onClose} />
      <View style={{ marginTop: 20 }}>
        <Txt t="kicker" color="mut" style={{ letterSpacing: 0.84 }}>{t.talk.kicker(stageN)}</Txt>
        {sub?.plan?.[sub.planStage ?? 0] ? <Txt t="meta" color="mut" style={{ marginTop: 6, lineHeight: 19 }}>{sub.plan[sub.planStage ?? 0].t}</Txt> : null}
      </View>
      <ScrollView style={{ flex: 1, marginTop: 8 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', gap: 12, paddingBottom: 6 }} showsVerticalScrollIndicator={false}>
        {talk.state.lines.map((l, i) =>
          l.side === 'buddy' ? (
            <Txt key={i} t="body" style={{ maxWidth: 310 }}>{l.text || '…'}</Txt>
          ) : (
            <View key={i} style={{ alignSelf: 'flex-end', maxWidth: 280, backgroundColor: c.card, borderWidth: 1.5, borderColor: l.live ? c.line : c.line2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }}>
              <Txt t="row" color={l.live ? 'mut' : 'ink'}>{l.text || '…'}</Txt>
            </View>
          ),
        )}
      </ScrollView>
      <BuddyDockView state={talk.buddyState} word={word} reduceMotion={reduceMotion} accessible accessibilityRole="text" accessibilityLabel={word} accessibilityLiveRegion="polite" />
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <MicButton recording={talk.state.phase === 'listening'} onPress={talk.onMic} size={size.micLg} />
        <Txt t="tiny" color="mut" style={{ marginTop: 8, textAlign: 'center', minHeight: 17 }}>{hint}</Txt>
      </View>
    </Screen>
  );
}
