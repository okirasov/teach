import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { content } from '@/content';
import type { BuddyState } from '@/features/session/buddyState';
import { recognizer, type SpeechSession } from '@/voice';
import { speak, stopSpeaking } from '@/voice/tts';
import { createSentenceSplitter } from './sentences';
import { initialTalk, reduceTalk, type TalkEffect, type TalkEvent, type TalkState } from './talkMachine';

export interface UseTalkOptions {
  remoteId: string;
  /** BCP-47 для распознавания (язык предмета или интерфейса — как в сессии). */
  sttLang: string;
  /** Язык озвучки; null — озвучки нет, реплики только текстом. */
  ttsLang: string | null;
  uiLang: string;
}

const PHASE_TO_BUDDY: Record<TalkState['phase'], BuddyState> = { waiting: 'waiting', listening: 'listening', thinking: 'thinking', speaking: 'speaking' };

/**
 * Разговор с бадди: исполняет эффекты стейт-машины. Порядок реплики:
 * STT → send (стрим с сервера) → предложения в очередь озвучки → speakDone, когда очередь пуста и стрим закрыт.
 */
export function useTalk({ remoteId, sttLang, ttsLang, uiLang }: UseTalkOptions) {
  const [state, dispatchRaw] = useReducer((s: TalkState, e: TalkEvent) => reduceTalk(s, e).state, undefined, initialTalk);
  const stateRef = useRef(state);
  stateRef.current = state;
  const talkId = useRef<string | null>(null);
  const stt = useRef<SpeechSession | null>(null);
  const queue = useRef<string[]>([]);
  const speakingNow = useRef(false);
  const streamOpen = useRef(false);
  // Монотонный номер текущего хода: каждый send() захватывает свой номер и в каждом продолжении
  // (onDelta, после await, catch, finally) проверяет его против gen.current — если ход устарел
  // (перебили и начали следующий), продолжение ничего не делает: ни dispatch, ни очередь, ни pump.
  const gen = useRef(0);
  const [seconds, setSeconds] = useState(0);

  const dispatch = useCallback((e: TalkEvent) => {
    const { state: next, effects } = reduceTalk(stateRef.current, e);
    // Обновляем сразу, не дожидаясь ре-рендера: несколько dispatch подряд в одном act()/тике
    // (например финальный onResult + onEnd) иначе считали бы эффекты по устаревшему состоянию.
    stateRef.current = next;
    dispatchRaw(e);
    effects.forEach(run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pump = useCallback(() => {
    if (speakingNow.current) return;
    const next = queue.current.shift();
    if (next === undefined) {
      if (!streamOpen.current) dispatch({ type: 'speakDone' });
      return;
    }
    if (!ttsLang) {
      pump();
      return;
    }
    speakingNow.current = true;
    speak(next, ttsLang, () => {
      speakingNow.current = false;
      pump();
    }, uiLang);
  }, [dispatch, ttsLang, uiLang]);

  const send = useCallback(async (text: string) => {
    // Гарантируем настоящую асинхронную границу: без неё вторая (и следующие) реплика, когда
    // talkId уже кэширован, ушла бы в replyStart синхронно в том же тике, что и sttEnd/dispatch,
    // и «thinking» стал бы недостижим для наблюдателя (тест, экран) — фаза сразу оказалась бы «speaking».
    await Promise.resolve();
    const my = ++gen.current;
    const id = talkId.current ?? (talkId.current = await content.startTalk(remoteId));
    if (my !== gen.current) return; // перебили во время старта талка — этот ход больше не актуален
    const splitter = createSentenceSplitter();
    queue.current = [];
    streamOpen.current = true;
    dispatch({ type: 'replyStart' });
    try {
      const reply = await content.talkTurn(id, text, (delta) => {
        if (my !== gen.current) return; // хвост устаревшего стрима — не трогаем чужой ход
        dispatch({ type: 'replyDelta', text: delta });
        queue.current.push(...splitter.push(delta));
        pump();
      });
      if (my !== gen.current) return;
      queue.current.push(...splitter.flush());
      dispatch({ type: 'replyDone', text: reply });
    } catch (e) {
      if (my !== gen.current) return;
      dispatch({ type: 'error', message: e instanceof Error ? e.message : 'network' });
    } finally {
      if (my === gen.current) {
        streamOpen.current = false;
        pump();
      }
    }
  }, [dispatch, pump, remoteId]);

  function run(effect: TalkEffect) {
    switch (effect) {
      case 'startStt':
        stt.current = recognizer.start(
          {
            lang: sttLang,
            continuous: false,
            playback: true,
            hint: process.env.EXPO_PUBLIC_VOICE_SIM === '1' ? 'La cuenta, por favor' : undefined,
          },
          {
            onResult: (t, f) => dispatch({ type: 'sttResult', text: t, final: f }),
            onEnd: () => { stt.current = null; dispatch({ type: 'sttEnd' }); },
            onError: () => { stt.current = null; dispatch({ type: 'sttEnd' }); },
          },
        );
        break;
      case 'stopStt':
        stt.current?.stop();
        break;
      case 'send': {
        const line = stateRef.current.lines[stateRef.current.lines.length - 1];
        void send(line?.text ?? '');
        break;
      }
      case 'stopSpeech':
        gen.current += 1; // инвалидирует текущий send() до того, как начнётся следующий
        queue.current = [];
        streamOpen.current = false;
        speakingNow.current = false;
        stopSpeaking();
        break;
      case 'end':
        if (talkId.current) void content.endTalk(talkId.current).catch(() => {});
        break;
    }
  }

  // Вступление бадди и таймер.
  useEffect(() => {
    void send('');
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMic = useCallback(() => dispatch({ type: 'micTap' }), [dispatch]);
  const close = useCallback(() => dispatch({ type: 'close' }), [dispatch]);
  useEffect(() => () => { stt.current?.stop(); stopSpeaking(); }, []);

  return { state, buddyState: PHASE_TO_BUDDY[state.phase], onMic, close, seconds };
}
