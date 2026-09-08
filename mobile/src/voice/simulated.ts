import type { SpeechRecognizer } from './types';

/** Слово каждые ~240 мс, как в прототипе (README «Голос»). */
export const SIM_WORD_MS = 240;

/** Симулятор STT: «печатает» подсказку по словам. Используется там, где нет платформенного STT. */
export const simulatedRecognizer: SpeechRecognizer = {
  async isAvailable() {
    return true;
  },
  start(opts, h) {
    const words = (opts.hint ?? '').split(' ').filter(Boolean);
    let i = 0;
    let stopped = false;
    const timer = setInterval(() => {
      if (stopped) return;
      if (i >= words.length) {
        finish();
        return;
      }
      i += 1;
      h.onResult(words.slice(0, i).join(' '), false);
    }, SIM_WORD_MS);
    const finish = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      h.onResult(words.slice(0, i).join(' '), true);
      h.onEnd();
    };
    return { stop: finish };
  },
};
