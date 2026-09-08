import { en } from '../en';
import { formatHeaderDate } from '../index';
import { ru } from '../ru';

describe('i18n dictionaries', () => {
  it('ru and en expose the same keys with the same value kinds', () => {
    const ruKeys = Object.keys(ru).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(ruKeys);
    for (const k of ruKeys) {
      expect(typeof (en as Record<string, unknown>)[k]).toBe(typeof (ru as Record<string, unknown>)[k]);
    }
  });

  it('function entries return strings', () => {
    expect(ru.queueLine(12)).toBe('12 карточек · ~6 мин');
    expect(en.reviewsSummary(13)).toBe('13 in queue');
    expect(ru.firstTry(2, 3)).toBe('2 из 3 с первой попытки');
  });

  it('pluralises russian day intervals', () => {
    expect(ru.dInDays(1)).toBe('через 1 день');
    expect(ru.dInDays(3)).toBe('через 3 дня');
    expect(ru.dInDays(5)).toBe('через 5 дней');
    expect(ru.dInDays(11)).toBe('через 11 дней');
    expect(ru.dInDays(21)).toBe('через 21 день');
    expect(en.dInDays(1)).toBe('in 1 day');
    expect(en.dInDays(4)).toBe('in 4 days');
  });

  it('formats the header date like the prototype', () => {
    const d = new Date(2025, 8, 7); // Sunday, Sep 7
    expect(formatHeaderDate(d, 'ru')).toBe('ВС · 7 СЕН');
    expect(formatHeaderDate(d, 'en')).toBe('SUN · SEP 7');
  });
});
