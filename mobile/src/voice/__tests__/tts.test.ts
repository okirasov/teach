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
  test('subjectOnly skips the interface-language segments and still completes', () => {
    (Speech.speak as jest.Mock).mockClear();
    const done = jest.fn();
    speak('Buongiorno — добрый день', 'it-IT', done, 'ru-RU', { subjectOnly: true });
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(Speech.speak).toHaveBeenCalledWith('Buongiorno —', expect.objectContaining({ language: 'it-IT' }));
    expect(done).toHaveBeenCalledTimes(1);
    (Speech.speak as jest.Mock).mockClear();
    const done2 = jest.fn();
    speak('только русский текст', 'it-IT', done2, 'ru-RU', { subjectOnly: true });
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(done2).toHaveBeenCalledTimes(1);
  });

  test('subjectOnly keeps terms inside a Russian sentence silent but voices a mostly-foreign sentence', () => {
    (Speech.speak as jest.Mock).mockClear();
    const done = jest.fn();
    speak('В уроке 4 ты путал costa и costano, здесь один кофе.', 'it-IT', done, 'ru-RU', { subjectOnly: true });
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
    (Speech.speak as jest.Mock).mockClear();
    speak('Ответь: Tell me a little about yourself.', 'en-US', jest.fn(), 'ru-RU', { subjectOnly: true });
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(Speech.speak).toHaveBeenCalledWith('Tell me a little about yourself.', expect.objectContaining({ language: 'en-US' }));
    (Speech.speak as jest.Mock).mockClear();
    speak('Present, Past, Future — три формы, которые ты уже знаешь.', 'en-US', jest.fn(), 'ru-RU', { subjectOnly: true });
    expect(Speech.speak).not.toHaveBeenCalled();
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
