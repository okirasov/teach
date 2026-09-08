jest.mock('expo-speech-recognition', () => {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const emit = (name: string, e: unknown) => [...(listeners[name] ?? [])].forEach((fn) => fn(e));
  const mod = {
    isRecognitionAvailable: jest.fn(() => true),
    getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: false })),
    start: jest.fn(),
    stop: jest.fn(() => emit('end', {})),
    abort: jest.fn(),
    addListener: jest.fn((name: string, fn: (e: unknown) => void) => {
      (listeners[name] ??= []).push(fn);
      return { remove: () => listeners[name].splice(listeners[name].indexOf(fn), 1) };
    }),
  };
  return { ExpoSpeechRecognitionModule: mod, __emit: emit, __listeners: listeners };
});

const { ExpoSpeechRecognitionModule: mockMod, __emit: mockEmit, __listeners: mockListeners } = jest.requireMock('expo-speech-recognition') as {
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.Mock;
    getPermissionsAsync: jest.Mock;
    requestPermissionsAsync: jest.Mock;
    start: jest.Mock;
    stop: jest.Mock;
  };
  __emit: (name: string, e: unknown) => void;
  __listeners: Record<string, unknown[]>;
};

import { nativeRecognizer } from '../native';

beforeEach(() => {
  for (const k of Object.keys(mockListeners)) delete mockListeners[k];
  jest.clearAllMocks();
});

describe('native recognizer', () => {
  it('is available when the platform supports it and permission is granted', async () => {
    expect(await nativeRecognizer.isAvailable()).toBe(true);
    mockMod.isRecognitionAvailable.mockReturnValueOnce(false);
    expect(await nativeRecognizer.isAvailable()).toBe(false);
  });

  it('asks for permission once and respects a denial', async () => {
    mockMod.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    mockMod.requestPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false });
    expect(await nativeRecognizer.isAvailable()).toBe(false);
    mockMod.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false });
    expect(await nativeRecognizer.isAvailable()).toBe(false);
    expect(mockMod.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('feeds interim and final transcripts, then ends once and unsubscribes', () => {
    const results: [string, boolean][] = [];
    const onEnd = jest.fn();
    nativeRecognizer.start({ lang: 'en-US' }, { onResult: (t, f) => results.push([t, f]), onEnd });
    expect(mockMod.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'en-US', interimResults: true, continuous: false }));
    mockEmit('result', { results: [{ transcript: 'If I' }], isFinal: false });
    mockEmit('result', { results: [{ transcript: 'If I were you' }], isFinal: true });
    mockEmit('end', {});
    mockEmit('end', {});
    expect(results).toEqual([['If I', false], ['If I were you', true], ['If I were you', true]]);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(mockListeners.result).toHaveLength(0);
  });

  it('stop() asks the platform to finish; the end event completes the session', () => {
    const onEnd = jest.fn();
    const session = nativeRecognizer.start({ lang: 'ru-RU', continuous: true }, { onResult: () => {}, onEnd });
    expect(mockMod.start).toHaveBeenCalledWith(expect.objectContaining({ continuous: true }));
    session.stop();
    expect(mockMod.stop).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('errors never block: no-speech ends quietly, other errors are reported and end the session', () => {
    const onError = jest.fn();
    const onEnd = jest.fn();
    nativeRecognizer.start({ lang: 'en-US' }, { onResult: () => {}, onEnd, onError });
    mockEmit('error', { error: 'no-speech', message: 'No speech' });
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);

    const onError2 = jest.fn();
    nativeRecognizer.start({ lang: 'en-US' }, { onResult: () => {}, onEnd: () => {}, onError: onError2 });
    mockEmit('error', { error: 'network', message: 'Offline' });
    expect(onError2).toHaveBeenCalledWith('Offline');
  });
});
