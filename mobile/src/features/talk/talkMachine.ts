/**
 * Стейт-машина разговора с бадди (FR-66): чистая, без React и без таймеров.
 * Фазы совпадают со словами дока: waiting «Ваш ход», listening «Слушаю», thinking «Думаю», speaking «Говорю».
 * Побочные эффекты (STT, отправка, озвучка) возвращаются списком — их исполняет useTalk.
 */
export type TalkPhase = 'waiting' | 'listening' | 'thinking' | 'speaking';

export interface TalkLine {
  side: 'buddy' | 'user';
  text: string;
  /** Строка ещё наполняется: транскрипт или стрим ответа. */
  live: boolean;
}

export interface TalkState {
  phase: TalkPhase;
  lines: TalkLine[];
  error: string | null;
  ended: boolean;
}

export type TalkEvent =
  | { type: 'micTap' }
  | { type: 'sttResult'; text: string; final: boolean }
  | { type: 'sttEnd' }
  | { type: 'replyStart' }
  | { type: 'replyDelta'; text: string }
  | { type: 'replyDone'; text: string }
  | { type: 'speakDone' }
  | { type: 'error'; message: string }
  | { type: 'close' };

export type TalkEffect = 'startStt' | 'stopStt' | 'send' | 'stopSpeech' | 'end';

export function initialTalk(): TalkState {
  return { phase: 'waiting', lines: [], error: null, ended: false };
}

const last = (s: TalkState) => s.lines[s.lines.length - 1];

function setLast(s: TalkState, patch: Partial<TalkLine>): TalkLine[] {
  if (s.lines.length === 0) return s.lines;
  return [...s.lines.slice(0, -1), { ...last(s), ...patch }];
}

function dropLiveTail(s: TalkState): TalkLine[] {
  const l = last(s);
  return l && l.live && l.text.trim() === '' ? s.lines.slice(0, -1) : setLast(s, { live: false });
}

export function reduceTalk(s: TalkState, e: TalkEvent): { state: TalkState; effects: TalkEffect[] } {
  const ok = (state: TalkState, ...effects: TalkEffect[]) => ({ state, effects });
  if (s.ended) return ok(s);
  switch (e.type) {
    case 'micTap':
      if (s.phase === 'waiting') return ok({ ...s, phase: 'listening', error: null, lines: [...s.lines, { side: 'user', text: '', live: true }] }, 'startStt');
      if (s.phase === 'listening') return ok(s, 'stopStt');
      if (s.phase === 'speaking') return ok({ ...s, phase: 'listening', lines: [...setLast(s, { live: false }), { side: 'user', text: '', live: true }] }, 'stopSpeech', 'startStt');
      return ok(s);
    case 'sttResult':
      return s.phase === 'listening' ? ok({ ...s, lines: setLast(s, { text: e.text }) }) : ok(s);
    case 'sttEnd': {
      if (s.phase !== 'listening') return ok(s);
      const text = last(s)?.text.trim() ?? '';
      if (!text) return ok({ ...s, phase: 'waiting', lines: s.lines.slice(0, -1) });
      return ok({ ...s, phase: 'thinking', lines: setLast(s, { text, live: false }) }, 'send');
    }
    case 'replyStart':
      return ok({ ...s, phase: 'speaking', lines: [...s.lines, { side: 'buddy', text: '', live: true }] });
    case 'replyDelta':
      return s.phase === 'speaking' ? ok({ ...s, lines: setLast(s, { text: last(s).text + e.text }) }) : ok(s);
    case 'replyDone':
      return s.phase === 'speaking' ? ok({ ...s, lines: setLast(s, { text: e.text, live: false }) }) : ok(s);
    case 'speakDone':
      return s.phase === 'speaking' ? ok({ ...s, phase: 'waiting' }) : ok(s);
    case 'error':
      return ok({ ...s, phase: 'waiting', error: e.message, lines: dropLiveTail(s) });
    case 'close':
      return ok({ ...s, ended: true, lines: dropLiveTail(s) }, 'stopStt', 'stopSpeech', 'end');
  }
}
