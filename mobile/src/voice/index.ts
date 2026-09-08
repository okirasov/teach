import { Platform } from 'react-native';

import { simulatedRecognizer } from './simulated';
import type { SpeechRecognizer } from './types';

export * from './types';

/**
 * Активный распознаватель: платформенный STT на устройстве; симуляция прототипа — на web
 * (превью) и при EXPO_PUBLIC_VOICE_SIM=1 (симулятор без микрофона, автотесты).
 */
function pick(): SpeechRecognizer {
  if (Platform.OS === 'web' || process.env.EXPO_PUBLIC_VOICE_SIM === '1') return simulatedRecognizer;
  // Ленивая загрузка: нативный модуль не должен требоваться в web-бандле.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./native') as typeof import('./native')).nativeRecognizer;
}

export const recognizer: SpeechRecognizer = pick();
