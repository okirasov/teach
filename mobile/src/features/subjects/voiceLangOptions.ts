import { topicKind } from '@/domain/seed';
import type { SubjectConfig } from '@/domain/types';
import type { Dict } from '@/i18n';
import type { Lang } from '@/store/settings';

export interface VoiceLangOption {
  value: SubjectConfig['vlang'];
  label: string;
}

/**
 * Два пилла «Язык распознавания» (DESIGN.md §4.10): язык интерфейса и язык предмета.
 * Для языкового предмета — «Русский / English», по умолчанию язык предмета;
 * если оба совпадают — показываем «Русский / English».
 */
export function voiceLangOptions(t: Dict, subjectName: string, uiLang: Lang, cfg: Pick<SubjectConfig, 'vlang'> | { vlang?: undefined }) {
  const ui = uiLang === 'ru' ? t.langRu : t.langEn;
  const isLang = topicKind(subjectName) === 'lang';
  const lessonLang = /англ|english/i.test(subjectName) ? 'English' : isLang ? subjectName : ui;
  const current: SubjectConfig['vlang'] = cfg.vlang ?? (isLang ? 'lesson' : 'ui');
  const options: VoiceLangOption[] =
    lessonLang === ui
      ? [{ value: 'ui', label: t.langRu }, { value: 'lesson', label: t.langEn }]
      : [{ value: 'ui', label: ui }, { value: 'lesson', label: lessonLang }];
  return { current, options };
}
