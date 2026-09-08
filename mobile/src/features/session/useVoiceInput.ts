import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '@/store/session';
import { recognizer, type SpeechSession } from '@/voice';

/**
 * Голосовой ввод на шаге ответа: транскрипт кладётся в поле, текст можно править.
 * Остановка — повторный тап (или отпускание в режиме «Удерживать»), уход со шага, размонтирование.
 */
export function useVoiceInput(lang: string, hint: string | undefined, continuous: boolean) {
  const rec = useSession((s) => s.rec);
  /** null — ещё проверяем; false — STT недоступен, кнопку не показываем. */
  const [available, setAvailable] = useState<boolean | null>(null);
  const setRec = useSession((s) => s.setRec);
  const setInput = useSession((s) => s.setInput);
  const active = useRef<SpeechSession | null>(null);

  useEffect(() => {
    let alive = true;
    recognizer
      .isAvailable()
      .then((ok) => {
        if (__DEV__) console.log(`[voice] recognizer available: ${ok}`);
        if (alive) setAvailable(ok);
      })
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, []);

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
      { lang, hint, continuous },
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
  }, [lang, hint, continuous, setInput, setRec]);

  const toggle = useCallback(() => (active.current ? stop() : start()), [start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { rec, available, start, stop, toggle };
}
