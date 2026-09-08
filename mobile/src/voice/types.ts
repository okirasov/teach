/**
 * Адаптер распознавания речи. Реализации: симуляция (прототип, web/Expo Go)
 * и платформенный STT (expo-speech-recognition, dev-build).
 * Голос никогда не блокирует прогресс: любые ошибки просто останавливают запись.
 */
export interface SpeechOptions {
  /** BCP-47: ru-RU, en-US. */
  lang: string;
  /** Подсказка для симулятора — текст, который «наговаривается». */
  hint?: string;
}

export interface SpeechSession {
  /** Останавливает распознавание; финальный транскрипт приходит через onResult. */
  stop(): void;
}

export interface SpeechRecognizer {
  /** Доступно ли распознавание на этом устройстве / сборке. */
  isAvailable(): Promise<boolean>;
  start(
    opts: SpeechOptions,
    handlers: {
      /** Промежуточный или финальный транскрипт целиком. */
      onResult: (transcript: string, isFinal: boolean) => void;
      onEnd: () => void;
      onError?: (message: string) => void;
    },
  ): SpeechSession;
}
