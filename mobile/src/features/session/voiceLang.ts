import type { LanguageInfo } from '@/domain/languages';
import { uiLanguageTag } from '@/domain/languages';
import type { SubjectConfig } from '@/domain/types';
import type { Lang } from '@/store/settings';

/** Язык распознавания по настройке предмета: «интерфейс» или «урок» (DESIGN.md §4.10). */
export function voiceLangFor(language: LanguageInfo | null, cfg: Pick<SubjectConfig, 'vlang'>, uiLang: Lang): string {
  const mode = cfg.vlang ?? (language ? 'lesson' : 'ui');
  return mode === 'lesson' && language ? language.code : uiLanguageTag[uiLang];
}
