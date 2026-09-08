import { useSettings, type Lang } from '@/store/settings';
import { en } from './en';
import { ru, type Dict } from './ru';

export type { Dict };

export const dictionaries: Record<Lang, Dict> = { ru, en };

export function getDict(lang: Lang): Dict {
  return dictionaries[lang];
}

/** Словарь текущего языка интерфейса. Смена языка в Профиле перерисовывает все строки. */
export function useT(): Dict {
  const lang = useSettings((s) => s.lang);
  return dictionaries[lang];
}

/** Дата шапки: «ВС · 7 СЕН» / «SUN · SEP 7». */
export function formatHeaderDate(d: Date, lang: Lang): string {
  const t = dictionaries[lang];
  const wd = t.weekdays[d.getDay()];
  const mo = t.months[d.getMonth()];
  return lang === 'ru' ? `${wd} · ${d.getDate()} ${mo}` : `${wd} · ${mo} ${d.getDate()}`;
}
