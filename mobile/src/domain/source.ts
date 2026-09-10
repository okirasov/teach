/**
 * Строка источника объяснения: «Название, раздел · доверие высокое/среднее/низкое».
 * Высокое доверие — норма, о нём не пишем; среднее и низкое показываем как предупреждение.
 */
export type SourceTrust = 'mid' | 'low';

export function splitSource(source: string): { text: string; warn?: SourceTrust } {
  const m = /^(.*?)\s*[·—-]\s*(?:доверие|trust)\s+(высокое|среднее|низкое|high|mid|medium|low)\s*$/iu.exec(source.trim());
  if (!m) return { text: source.trim() };
  const level = m[2].toLowerCase();
  const warn: SourceTrust | undefined = level === 'среднее' || level === 'mid' || level === 'medium' ? 'mid' : level === 'низкое' || level === 'low' ? 'low' : undefined;
  return warn ? { text: m[1], warn } : { text: m[1] };
}
