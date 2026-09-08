import { topicKind } from '@/domain/seed';
import type { SubjectConfig } from '@/domain/types';
import type { Lang } from '@/store/settings';

const uiTag: Record<Lang, string> = { ru: 'ru-RU', en: 'en-US' };

/** Язык предмета для языковых курсов (пока только английский из сида; остальные — язык интерфейса). */
export function lessonLangTag(subjectName: string, uiLang: Lang): string {
  if (/англ|english/i.test(subjectName)) return 'en-US';
  if (/испан|spanish/i.test(subjectName)) return 'es-ES';
  if (/немец|german/i.test(subjectName)) return 'de-DE';
  if (/франц|french/i.test(subjectName)) return 'fr-FR';
  return uiTag[uiLang];
}

/** Язык распознавания по настройке предмета: «интерфейс» или «урок» (DESIGN.md §4.10). */
export function voiceLangFor(subjectName: string, cfg: Pick<SubjectConfig, 'vlang'>, uiLang: Lang): string {
  const isLang = topicKind(subjectName) === 'lang';
  const mode = cfg.vlang ?? (isLang ? 'lesson' : 'ui');
  return mode === 'lesson' ? lessonLangTag(subjectName, uiLang) : uiTag[uiLang];
}
