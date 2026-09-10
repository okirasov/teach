import * as Speech from 'expo-speech';

import type { LanguageInfo } from '@/domain/languages';
import type { SubjectConfig } from '@/domain/types';
import { splitByLanguage } from './segments';

/**
 * Озвучка примеров системным синтезом (AVSpeechSynthesizer / Android TextToSpeech): без сети,
 * без сервера и без токенов. Голос — язык предмета; для неязыковых предметов озвучки нет.
 */
export function ttsLangFor(subjectLang: LanguageInfo | null, cfg: Pick<SubjectConfig, 'tts'>): string | null {
  if (!subjectLang) return null;
  return cfg.tts === false ? null : subjectLang.code;
}

let voicesCache: Promise<Set<string>> | null = null;

/** Языки, для которых на устройстве есть голос (кэш на сессию приложения). */
export async function availableTtsLanguages(): Promise<Set<string>> {
  voicesCache ??= Speech.getAvailableVoicesAsync()
    .then((voices) => new Set(voices.map((v) => v.language.replace('_', '-').toLowerCase())))
    .catch(() => new Set<string>());
  return voicesCache;
}

export async function hasVoiceFor(lang: string): Promise<boolean> {
  const langs = await availableTtsLanguages();
  if (langs.size === 0) return false;
  const l = lang.toLowerCase();
  const base = l.split('-')[0];
  for (const v of langs) if (v === l || v.split('-')[0] === base) return true;
  return false;
}

/** Озвучить текст: куски на языке предмета и на языке интерфейса читаются по очереди своими голосами. */
export function speak(text: string, lang: string, onDone: () => void, uiLang = 'ru-RU'): void {
  Speech.stop();
  const segments = splitByLanguage(text, lang, uiLang);
  let stopped = false;
  const next = (i: number) => {
    if (stopped || i >= segments.length) {
      onDone();
      return;
    }
    Speech.speak(segments[i].text, {
      language: segments[i].lang,
      rate: 0.9,
      onDone: () => next(i + 1),
      onStopped: () => {
        stopped = true;
        onDone();
      },
      onError: () => next(i + 1),
    });
  };
  next(0);
}

export function stopSpeaking(): void {
  Speech.stop();
}
