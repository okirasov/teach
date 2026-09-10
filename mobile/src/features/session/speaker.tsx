import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { hasVoiceFor, speak, stopSpeaking } from '@/voice/tts';

export interface Speaker {
  /** Ключ реплики, которая звучит сейчас, или null. */
  speaking: string | null;
  /** Озвучить текст; повторное нажатие на ту же реплику останавливает. */
  toggle: (key: string, text: string) => void;
}

const SpeakerContext = createContext<Speaker | null>(null);

/** Озвучка доступна, если у предмета есть язык, она включена в настройках и на устройстве есть голос. */
export function SpeakerProvider({ lang, children }: { lang: string | null; children: React.ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    setAvailable(false);
    if (lang) hasVoiceFor(lang).then((ok) => alive.current && setAvailable(ok));
    return () => {
      alive.current = false;
      stopSpeaking();
    };
  }, [lang]);

  const toggle = useCallback(
    (key: string, text: string) => {
      if (!lang) return;
      if (speaking === key) {
        stopSpeaking();
        setSpeaking(null);
        return;
      }
      setSpeaking(key);
      speak(text, lang, () => alive.current && setSpeaking((cur) => (cur === key ? null : cur)));
    },
    [lang, speaking],
  );

  const value = useMemo<Speaker | null>(() => (available && lang ? { speaking, toggle } : null), [available, lang, speaking, toggle]);
  return <SpeakerContext.Provider value={value}>{children}</SpeakerContext.Provider>;
}

/** null — озвучки нет (неязыковой предмет, выключена, нет голоса): кнопки не рисуются. */
export function useSpeaker(): Speaker | null {
  return useContext(SpeakerContext);
}

/** Остановить озвучку при смене шага. */
export function useStopSpeechOn(dep: unknown): void {
  useEffect(() => {
    stopSpeaking();
  }, [dep]);
}
