import { splitByLanguage } from '../segments';

describe('splitByLanguage', () => {
  it('splits a mixed example into subject-language and interface-language runs', () => {
    const segs = splitByLanguage('If I were you, I would take the job. — «Были бы» вы другим человеком нельзя, поэтому were даже с I.', 'en-US', 'ru-RU');
    expect(segs).toEqual([
      { text: 'If I were you, I would take the job. —', lang: 'en-US' },
      { text: '«Были бы» вы другим человеком нельзя, поэтому', lang: 'ru-RU' },
      { text: 'were', lang: 'en-US' },
      { text: 'даже с', lang: 'ru-RU' },
      { text: 'I.', lang: 'en-US' },
    ]);
  });
  it('keeps a single-language text as one run and drops punctuation-only pieces', () => {
    expect(splitByLanguage('— Ciao, Marco! Come stai? — Bene, grazie. E tu?', 'it-IT', 'ru-RU')).toEqual([{ text: '— Ciao, Marco! Come stai? — Bene, grazie. E tu?', lang: 'it-IT' }]);
    expect(splitByLanguage('…', 'it-IT', 'ru-RU')).toEqual([]);
  });
  it('with an English interface, Cyrillic is not treated as interface text', () => {
    expect(splitByLanguage('Buongiorno — привет', 'it-IT', 'en-US')).toEqual([{ text: 'Buongiorno — привет', lang: 'it-IT' }]);
  });
});
