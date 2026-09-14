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
jest.mock('@/content', () => ({
  content: {
    startTalk: async () => 't1',
    talkTurn: async (_id: string, text: string, onDelta: (d: string) => void) => {
      mockTurns.push(text);
      const reply = text ? 'Sí. ¿Y la cuenta?' : 'Привет. С чего начнём?';
      for (const w of reply.split(' ')) onDelta(w + ' ');
      return reply;
    },
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
  beforeEach(() => { mockSpeak.mockClear(); mockTurns.length = 0; });

  it('opens the talk with the buddy line, speaks it by sentences and waits', async () => {
    act(() => { create(<Probe />); });
    await flush(); await flush();
    expect(mockTurns).toEqual(['']);
    expect(mockSpeak.mock.calls.map((c) => c[0])).toEqual(['Привет.', 'С чего начнём?']);
    expect(api.state.phase).toBe('waiting');
    expect(api.state.lines[0]).toEqual({ side: 'buddy', text: 'Привет. С чего начнём?', live: false });
  });

  it('sends the transcript when mockStt ends and speaks the reply', async () => {
    act(() => { create(<Probe />); });
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
});
