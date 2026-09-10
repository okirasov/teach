jest.mock('expo-speech', () => ({
  getAvailableVoicesAsync: jest.fn(async () => [{ language: 'it-IT' }, { language: 'en_US' }]),
  speak: jest.fn((_t: string, o: { onDone?: () => void }) => o.onDone?.()),
  stop: jest.fn(),
}));

import * as Speech from 'expo-speech';
import { detectLanguage } from '@/domain/languages';
import { hasVoiceFor, speak, ttsLangFor } from '../tts';

const it = detectLanguage('Итальянский')!;

describe('tts', () => {
  test('language comes from the subject and can be switched off per subject', () => {
    expect(ttsLangFor(it, {})).toBe('it-IT');
    expect(ttsLangFor(it, { tts: false })).toBeNull();
    expect(ttsLangFor(null, {})).toBeNull();
  });
  test('voice availability matches by language or base language', async () => {
    expect(await hasVoiceFor('it-IT')).toBe(true);
    expect(await hasVoiceFor('en-GB')).toBe(true);
    expect(await hasVoiceFor('ja-JP')).toBe(false);
  });
  test('speak stops the previous utterance and reports completion', () => {
    const done = jest.fn();
    speak('Buongiorno — добрый день', 'it-IT', done, 'ru-RU');
    expect(Speech.stop).toHaveBeenCalled();
    expect(Speech.speak).toHaveBeenNthCalledWith(1, 'Buongiorno —', expect.objectContaining({ language: 'it-IT' }));
    expect(Speech.speak).toHaveBeenNthCalledWith(2, 'добрый день', expect.objectContaining({ language: 'ru-RU' }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
