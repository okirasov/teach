import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import type { SpeechRecognizer } from './types';

/**
 * Платформенный STT: SFSpeechRecognizer (iOS) / SpeechRecognizer (Android) через expo-speech-recognition.
 * Работает только в dev/production-сборке (не в Expo Go).
 */
export const nativeRecognizer: SpeechRecognizer = {
  async isAvailable() {
    try {
      const supported = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      const perm = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (__DEV__) console.log(`[voice] native: supported=${supported} permission=${perm.status} canAskAgain=${perm.canAskAgain}`);
      if (!supported) return false;
      if (perm.granted) return true;
      // Спрашиваем один раз; отказ означает «микрофона нет», текст остаётся доступен.
      if (!perm.canAskAgain) return false;
      return (await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted;
    } catch {
      return false;
    }
  },
  start(opts, h) {
    const m = ExpoSpeechRecognitionModule;
    let done = false;
    let last = '';
    const subs = [
      m.addListener('result', (e) => {
        const text = e.results[0]?.transcript ?? '';
        last = text;
        h.onResult(text, e.isFinal);
      }),
      m.addListener('end', () => finish()),
      m.addListener('error', (e) => {
        // «no-speech» и «aborted» — штатные; остальное тоже лишь останавливает запись.
        if (e.error !== 'no-speech' && e.error !== 'aborted') h.onError?.(e.message || e.error);
        finish();
      }),
    ];
    const finish = () => {
      if (done) return;
      done = true;
      subs.forEach((s) => s.remove());
      h.onResult(last, true);
      h.onEnd();
    };
    try {
      m.start({
        lang: opts.lang,
        interimResults: true,
        continuous: opts.continuous ?? false,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
      });
    } catch (e) {
      h.onError?.(e instanceof Error ? e.message : String(e));
      finish();
    }
    return {
      stop() {
        if (done) return;
        try {
          m.stop();
        } catch {
          finish();
        }
      },
    };
  },
};
