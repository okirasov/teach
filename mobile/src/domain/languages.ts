/** Язык предмета: код распознавания и локализованные имена. Определяется один раз при создании предмета. */
export interface LanguageInfo {
  /** BCP-47 для STT. */
  code: string;
  ru: string;
  en: string;
}

interface LanguageDef extends LanguageInfo {
  match: RegExp;
}

const LANGUAGES: LanguageDef[] = [
  { code: 'en-US', ru: 'Английский', en: 'English', match: /англ|english/i },
  { code: 'it-IT', ru: 'Итальянский', en: 'Italian', match: /итал|italian/i },
  { code: 'es-ES', ru: 'Испанский', en: 'Spanish', match: /испан|spanish|español/i },
  { code: 'de-DE', ru: 'Немецкий', en: 'German', match: /немец|german|deutsch/i },
  { code: 'fr-FR', ru: 'Французский', en: 'French', match: /франц|french|français/i },
  { code: 'pt-PT', ru: 'Португальский', en: 'Portuguese', match: /португал|portugu/i },
  { code: 'zh-CN', ru: 'Китайский', en: 'Chinese', match: /китай|chinese|mandarin/i },
  { code: 'ja-JP', ru: 'Японский', en: 'Japanese', match: /япон|japanese/i },
  { code: 'ko-KR', ru: 'Корейский', en: 'Korean', match: /корей|korean/i },
  { code: 'ar-SA', ru: 'Арабский', en: 'Arabic', match: /араб|arabic/i },
  { code: 'tr-TR', ru: 'Турецкий', en: 'Turkish', match: /турец|turkish/i },
  { code: 'pl-PL', ru: 'Польский', en: 'Polish', match: /польск|polish/i },
  { code: 'cs-CZ', ru: 'Чешский', en: 'Czech', match: /чешск|czech/i },
  { code: 'nl-NL', ru: 'Нидерландский', en: 'Dutch', match: /нидерланд|голланд|dutch/i },
  { code: 'sv-SE', ru: 'Шведский', en: 'Swedish', match: /шведск|swedish/i },
  { code: 'el-GR', ru: 'Греческий', en: 'Greek', match: /греческ|greek/i },
  { code: 'he-IL', ru: 'Иврит', en: 'Hebrew', match: /иврит|hebrew/i },
  { code: 'hi-IN', ru: 'Хинди', en: 'Hindi', match: /хинди|hindi/i },
  { code: 'uk-UA', ru: 'Украинский', en: 'Ukrainian', match: /украин|ukrainian/i },
  { code: 'ru-RU', ru: 'Русский', en: 'Russian', match: /русск(ий|ого) язык|russian/i },
];

/** Язык из темы предмета («Итальянский язык с самого начала» → it-IT). null — предмет не языковой. */
export function detectLanguage(topic: string): LanguageInfo | null {
  const t = topic.trim();
  if (!t) return null;
  const hit = LANGUAGES.find((l) => l.match.test(t));
  return hit ? { code: hit.code, ru: hit.ru, en: hit.en } : null;
}

export const uiLanguageTag = { ru: 'ru-RU', en: 'en-US' } as const;
