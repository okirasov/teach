import { voiceLangFor } from '../voiceLang';

describe('voiceLangFor', () => {
  it('language subjects default to the lesson language', () => {
    expect(voiceLangFor('Английский', {} as never, 'ru')).toBe('en-US');
    expect(voiceLangFor('Английский', { vlang: 'ui' }, 'ru')).toBe('ru-RU');
  });
  it('non-language subjects follow the interface language', () => {
    expect(voiceLangFor('История', {} as never, 'ru')).toBe('ru-RU');
    expect(voiceLangFor('История', { vlang: 'lesson' }, 'en')).toBe('en-US');
  });
});
