import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import { useTalk } from '../useTalk';

const mockSpeak = jest.fn();
jest.mock('@/voice/tts', () => ({
  speak: (text: string, _lang: string, onDone: () => void) => {
    mockSpeak(text);
    setTimeout(onDone, 0);
  },
  stopSpeaking: jest.fn(),
}));
const mockStt = { handlers: null as null | { onResult: (t: string, f: boolean) => void; onEnd: () => void }, stop: jest.fn() };
jest.mock('@/voice', () => ({
  recognizer: {
    isAvailable: async () => true,
    start: (_o: unknown, h: typeof mockStt.handlers) => {
      mockStt.handlers = h;
      return { stop: () => { mockStt.stop(); h!.onEnd(); } };
    },
  },
}));
const mockTurns: string[] = [];
const mockTalkTurn = jest.fn(async (_id: string, text: string, onDelta: (d: string) => void): Promise<string> => {
  mockTurns.push(text);
  const reply = text ? 'Sí. ¿Y la cuenta?' : 'Привет. С чего начнём?';
  for (const w of reply.split(' ')) onDelta(w + ' ');
  return reply;
});
jest.mock('@/content', () => ({
  content: {
    startTalk: async () => 't1',
    talkTurn: (id: string, text: string, onDelta: (d: string) => void) => mockTalkTurn(id, text, onDelta),
    endTalk: jest.fn(async () => {}),
  },
}));

let api: ReturnType<typeof useTalk>;
function Probe() {
  api = useTalk({ remoteId: 'abc', sttLang: 'es-ES', ttsLang: 'es-ES', uiLang: 'ru-RU' });
  return <Text>{api.state.phase}</Text>;
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('useTalk', () => {
  let tree: ReturnType<typeof create> | null = null;

  beforeEach(() => {
    mockSpeak.mockClear();
    mockTurns.length = 0;
    mockTalkTurn.mockClear();
  });

  afterEach(() => {
    act(() => { tree?.unmount(); });
    tree = null;
  });

  it('opens the talk with the buddy line, speaks it by sentences and waits', async () => {
    act(() => { tree = create(<Probe />); });
    await flush(); await flush();
    expect(mockTurns).toEqual(['']);
    expect(mockSpeak.mock.calls.map((c) => c[0])).toEqual(['Привет.', 'С чего начнём?']);
    expect(api.state.phase).toBe('waiting');
    expect(api.state.lines[0]).toEqual({ side: 'buddy', text: 'Привет. С чего начнём?', live: false });
  });

  it('sends the transcript when mockStt ends and speaks the reply', async () => {
    act(() => { tree = create(<Probe />); });
    await flush(); await flush();
    act(() => api.onMic());
    expect(api.state.phase).toBe('listening');
    act(() => mockStt.handlers!.onResult('La cuenta', false));
    act(() => { mockStt.handlers!.onResult('La cuenta, por favor', true); mockStt.handlers!.onEnd(); });
    expect(api.state.phase).toBe('thinking');
    await flush(); await flush(); await flush();
    expect(mockTurns).toEqual(['', 'La cuenta, por favor']);
    expect(api.state.lines.map((l) => l.text)).toEqual(['Привет. С чего начнём?', 'La cuenta, por favor', 'Sí. ¿Y la cuenta?']);
    expect(api.state.phase).toBe('waiting');
  });

  it('does not mix a stale turn into a new one after interrupting mid-reply', async () => {
    type Ctrl = { onDelta: (d: string) => void; resolve: (text: string) => void };
    let ctrlA: Ctrl | null = null;
    let ctrlB: Ctrl | null = null;

    act(() => { tree = create(<Probe />); });
    await flush(); await flush();
    expect(api.state.phase).toBe('waiting');

    // Turn A: mic tap, say 'a', stt ends -> send('a') starts a controllable, still-pending talkTurn
    // that has already emitted one delta before we interrupt it.
    mockTalkTurn.mockImplementationOnce((_id: string, text: string, onDelta: (d: string) => void) => {
      mockTurns.push(text);
      return new Promise<string>((resolve) => {
        ctrlA = { onDelta, resolve };
        onDelta('Первое ');
      });
    });
    act(() => api.onMic());
    act(() => mockStt.handlers!.onResult('a', true));
    act(() => { mockStt.handlers!.onEnd(); });
    await flush();
    expect(api.state.phase).toBe('speaking');
    expect(api.state.lines[api.state.lines.length - 1].text).toBe('Первое ');

    // Interrupt turn A mid-reply: mic tap while speaking stops speech + starts a new STT session.
    mockTalkTurn.mockImplementationOnce((_id: string, text: string, onDelta: (d: string) => void) => {
      mockTurns.push(text);
      return new Promise<string>((resolve) => {
        ctrlB = { onDelta, resolve };
      });
    });
    act(() => api.onMic());
    expect(api.state.phase).toBe('listening');
    act(() => mockStt.handlers!.onResult('b', true));
    act(() => { mockStt.handlers!.onEnd(); });
    await flush();
    expect(api.state.phase).toBe('speaking');
    // Turn B's buddy line has started (empty so far); it must be the CURRENT last line, not turn A's.
    const lineCountBeforeStaleDelta = api.state.lines.length;

    // Turn A's stream is still alive on the network side: it delivers a late delta and finishes.
    // Both must be ignored — no dispatch, no queue push, no state change — because turn A is stale.
    act(() => { ctrlA!.onDelta('ХВОСТ '); ctrlA!.resolve('unused'); });
    await flush();
    expect(api.state.lines.length).toBe(lineCountBeforeStaleDelta);
    expect(api.state.lines.some((l) => l.text.includes('ХВОСТ'))).toBe(false);
    expect(api.state.lines[api.state.lines.length - 1].text).not.toContain('ХВОСТ');
    expect(api.state.phase).toBe('speaking'); // turn B's stream is still open — must not have flipped to waiting

    // Now resolve turn B for real.
    act(() => { ctrlB!.onDelta('Ответ. '); });
    act(() => { ctrlB!.resolve('Ответ.'); });
    await flush(); await flush(); await flush();
    expect(mockTurns).toEqual(['', 'a', 'b']);
    expect(api.state.lines[api.state.lines.length - 1].text).toBe('Ответ.');
    expect(api.state.phase).toBe('waiting');
  });
});
