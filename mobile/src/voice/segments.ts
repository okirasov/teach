/**
 * Разрезание текста на реплики по письменности: пример вроде
 * «If I were you… — «Были бы» вы другим человеком…» читается двумя голосами.
 * Кириллица — язык интерфейса, остальное — язык предмета; знаки препинания
 * и цифры прилипают к текущему куску.
 */
export interface SpeechSegment {
  text: string;
  lang: string;
}

const CYRILLIC = /\p{Script=Cyrillic}/u;
const LETTER = /\p{L}/u;

export function splitByLanguage(text: string, subjectLang: string, uiLang: string): SpeechSegment[] {
  const uiIsCyrillic = uiLang.toLowerCase().startsWith('ru');
  const out: SpeechSegment[] = [];
  let cur: SpeechSegment | null = null;
  for (const token of text.split(/(\s+)/)) {
    if (token.length === 0) continue;
    const hasLetter = LETTER.test(token);
    const lang: string = !hasLetter ? (cur?.lang ?? subjectLang) : CYRILLIC.test(token) ? (uiIsCyrillic ? uiLang : subjectLang) : subjectLang;
    if (cur && cur.lang === lang) cur.text += token;
    else if (cur && !hasLetter) cur.text += token;
    else {
      cur = { text: token, lang };
      out.push(cur);
    }
  }
  return out.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => LETTER.test(s.text));
}
