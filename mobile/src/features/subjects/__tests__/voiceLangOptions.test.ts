import { detectLanguage } from '@/domain/languages';
import { ru } from '@/i18n/ru';
import { en } from '@/i18n/en';
import { voiceLangOptions } from '../voiceLangOptions';

describe('voiceLangOptions', () => {
  it('english subject: interface vs the localized language name, lesson by default', () => {
    const r = voiceLangOptions(ru, detectLanguage('Английский'), 'ru', {});
    expect(r.current).toBe('lesson');
    expect(r.options.map((o) => o.label)).toEqual(['Русский', 'Английский']);
    expect(voiceLangOptions(en, detectLanguage('Английский'), 'en', {}).options.map((o) => o.label)).toEqual(['Русский', 'English']);
  });
  it('italian subject shows the localized language name, not the topic', () => {
    const lang = detectLanguage('Итальянский язык с самого начала');
    expect(voiceLangOptions(ru, lang, 'ru', {}).options.map((o) => o.label)).toEqual(['Русский', 'Итальянский']);
    expect(voiceLangOptions(en, lang, 'en', {}).options.map((o) => o.label)).toEqual(['English', 'Italian']);
  });
  it('non-language subject: both coincide → Русский / English, interface by default', () => {
    const r = voiceLangOptions(ru, null, 'ru', {});
    expect(r.current).toBe('ui');
    expect(r.options.map((o) => o.label)).toEqual(['Русский', 'English']);
  });
  it('explicit config wins', () => {
    expect(voiceLangOptions(ru, detectLanguage('Английский'), 'ru', { vlang: 'ui' }).current).toBe('ui');
  });
});
