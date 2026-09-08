import { simulatedRecognizer } from './simulated';
import type { SpeechRecognizer } from './types';

export * from './types';

/**
 * Активный распознаватель. Платформенный STT подключается на шаге «голос»;
 * до этого — симуляция прототипа.
 */
export const recognizer: SpeechRecognizer = simulatedRecognizer;
