import { ru } from '@/i18n/ru';
import { voiceLangOptions } from '../voiceLangOptions';

describe('voiceLangOptions', () => {
  it('english subject: interface vs English, lesson by default', () => {
    const r = voiceLangOptions(ru, 'Английский', 'ru', {});
    expect(r.current).toBe('lesson');
    expect(r.options.map((o) => o.label)).toEqual(['Русский', 'English']);
  });
  it('non-language subject: both coincide → Русский / English, interface by default', () => {
    const r = voiceLangOptions(ru, 'История', 'ru', {});
    expect(r.current).toBe('ui');
    expect(r.options.map((o) => o.label)).toEqual(['Русский', 'English']);
  });
  it('explicit config wins', () => {
    expect(voiceLangOptions(ru, 'Английский', 'ru', { vlang: 'ui' }).current).toBe('ui');
  });
});
