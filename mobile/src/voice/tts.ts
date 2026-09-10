import * as Speech from 'expo-speech';

import type { LanguageInfo } from '@/domain/languages';
import type { SubjectConfig } from '@/domain/types';

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

export function speak(text: string, lang: string, onDone: () => void): void {
  Speech.stop();
  Speech.speak(text, { language: lang, rate: 0.9, onDone, onStopped: onDone, onError: onDone });
}

export function stopSpeaking(): void {
  Speech.stop();
}
