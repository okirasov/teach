import { detectLanguage } from '../languages';

describe('detectLanguage', () => {
  it('finds the language in a topic phrase, in either UI language', () => {
    expect(detectLanguage('Итальянский язык с самого начала')).toMatchObject({ code: 'it-IT', ru: 'Итальянский', en: 'Italian' });
    expect(detectLanguage('Italian for travel')).toMatchObject({ code: 'it-IT' });
    expect(detectLanguage('Английский')).toMatchObject({ code: 'en-US', en: 'English' });
  });
  it('returns null for non-language topics', () => {
    expect(detectLanguage('История')).toBeNull();
    expect(detectLanguage('SQL')).toBeNull();
    expect(detectLanguage('')).toBeNull();
  });
});
