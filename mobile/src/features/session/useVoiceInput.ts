import { useCallback, useEffect, useRef } from 'react';

import { useSession } from '@/store/session';
import { recognizer, type SpeechSession } from '@/voice';

/**
 * Голосовой ввод на шаге ответа: транскрипт кладётся в поле, текст можно править.
 * Остановка — повторный тап (или отпускание в режиме «Удерживать»), уход со шага, размонтирование.
 */
export function useVoiceInput(lang: string, hint?: string) {
  const rec = useSession((s) => s.rec);
  const setRec = useSession((s) => s.setRec);
  const setInput = useSession((s) => s.setInput);
  const active = useRef<SpeechSession | null>(null);

  const stop = useCallback(() => {
    active.current?.stop();
    active.current = null;
    setRec(false);
  }, [setRec]);

  const start = useCallback(() => {
    if (active.current) return;
    setInput('');
    setRec(true);
    active.current = recognizer.start(
      { lang, hint },
      {
        onResult: (text) => setInput(text),
        onEnd: () => {
          active.current = null;
          setRec(false);
        },
        onError: () => {
          active.current = null;
          setRec(false);
        },
      },
    );
  }, [lang, hint, setInput, setRec]);

  const toggle = useCallback(() => (active.current ? stop() : start()), [start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { rec, start, stop, toggle };
}
