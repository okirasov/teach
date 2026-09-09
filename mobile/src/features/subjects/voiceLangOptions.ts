import type { LanguageInfo } from '@/domain/languages';
import type { SubjectConfig } from '@/domain/types';
import type { Dict } from '@/i18n';
import type { Lang } from '@/store/settings';

export interface VoiceLangOption {
  value: SubjectConfig['vlang'];
  label: string;
}

/**
 * Два пилла «Язык распознавания» (DESIGN.md §4.10): язык интерфейса и язык предмета.
 * Имя языка предмета локализовано («Итальянский» / «Italian»), по умолчанию выбран язык предмета;
 * если предмет не языковой или язык совпадает с интерфейсом — показываем «Русский / English».
 */
export function voiceLangOptions(t: Dict, language: LanguageInfo | null, uiLang: Lang, cfg: Pick<SubjectConfig, 'vlang'> | { vlang?: undefined }) {
  const ui = uiLang === 'ru' ? t.langRu : t.langEn;
  const lessonLang = language ? (uiLang === 'ru' ? language.ru : language.en) : ui;
  const current: SubjectConfig['vlang'] = cfg.vlang ?? (language ? 'lesson' : 'ui');
  const options: VoiceLangOption[] =
    lessonLang === ui
      ? [{ value: 'ui', label: t.langRu }, { value: 'lesson', label: t.langEn }]
      : [{ value: 'ui', label: ui }, { value: 'lesson', label: lessonLang }];
  return { current, options };
}
