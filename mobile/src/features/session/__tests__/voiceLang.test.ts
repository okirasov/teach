import { detectLanguage } from '@/domain/languages';
import { voiceLangFor } from '../voiceLang';

describe('voiceLangFor', () => {
  it('language subject defaults to the lesson language, ui override wins', () => {
    const en = detectLanguage('Английский');
    expect(voiceLangFor(en, {} as never, 'ru')).toBe('en-US');
    expect(voiceLangFor(en, { vlang: 'ui' }, 'ru')).toBe('ru-RU');
    expect(voiceLangFor(detectLanguage('Итальянский язык с самого начала'), {} as never, 'en')).toBe('it-IT');
  });
  it('non-language subject follows the interface language', () => {
    expect(voiceLangFor(null, {} as never, 'ru')).toBe('ru-RU');
    expect(voiceLangFor(null, { vlang: 'lesson' }, 'en')).toBe('en-US');
  });
});
