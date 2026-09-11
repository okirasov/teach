/**
 * Порядок предметов на всех экранах — как на «Сегодня»: демо, затем свои по созданию.
 * То, чего нет в порядке (например, записи удалённого предмета), идёт в конец в исходном порядке.
 */
export function sortByOrder<T>(items: T[], idOf: (item: T) => string, order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return items
    .map((item, i) => ({ item, r: rank.get(idOf(item)) ?? order.length + i }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.item);
}
