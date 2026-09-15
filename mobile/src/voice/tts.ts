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

export interface SpeakOptions {
  /**
   * Озвучивать только речь на языке предмета: в разговоре бадди говорит по-итальянски,
   * а русская подсказка остаётся написанной. Текст (одно предложение) звучит, только если буквы
   * языка предмета в нём преобладают; отдельные термины внутри русской фразы («ты путал costa и
   * costano») не озвучиваются. Без эффекта, если язык озвучки и есть язык интерфейса.
   */
  subjectOnly?: boolean;
}

const LETTER_RX = /\p{L}/gu;
const CYRILLIC_RX = /\p{Script=Cyrillic}/gu;

/** Доля букв языка предмета среди всех букв текста (кириллица считается языком интерфейса). */
export function subjectShare(text: string): number {
  const letters = text.match(LETTER_RX)?.length ?? 0;
  if (letters === 0) return 0;
  const cyrillic = text.match(CYRILLIC_RX)?.length ?? 0;
  return (letters - cyrillic) / letters;
}

/** Озвучить текст: куски на языке предмета и на языке интерфейса читаются по очереди своими голосами. */
export function speak(text: string, lang: string, onDone: () => void, uiLang = 'ru-RU', opts: SpeakOptions = {}): void {
  Speech.stop();
  const all = splitByLanguage(text, lang, uiLang);
  const subjectOnly = !!opts.subjectOnly && lang.toLowerCase() !== uiLang.toLowerCase();
  const segments = !subjectOnly ? all : subjectShare(text) >= 0.5 ? all.filter((s) => s.lang !== uiLang) : [];
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
