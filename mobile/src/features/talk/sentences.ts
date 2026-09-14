/**
 * Режет поток реплики бадди на предложения, чтобы озвучка началась с первого предложения,
 * не дожидаясь конца генерации. Предложение закрыто, когда после . ! ? … идёт пробел или конец.
 */
export function createSentenceSplitter(): { push(delta: string): string[]; flush(): string[] } {
  let buf = '';
  const out: string[] = [];
  const scan = () => {
    const found: string[] = [];
    for (;;) {
      const m = /[.!?…]+(?=\s)/.exec(buf);
      if (!m) break;
      const cut = m.index + m[0].length;
      const head = buf.slice(0, cut);
      // Точка после числа (3.50) или одной буквы (т. е.) не заканчивает предложение.
      const beforeDot = head.slice(0, m.index);
      if (m[0] === '.' && /(\d|(^|\s)\p{L})$/u.test(beforeDot)) {
        const next = buf.slice(cut).search(/\S/);
        if (next < 0) break;
        // Ищем следующий терминатор, не отрезая этот.
        const rest = buf.slice(cut);
        const m2 = /[.!?…]+(?=\s)/.exec(rest);
        if (!m2) break;
        const cut2 = cut + m2.index + m2[0].length;
        found.push(buf.slice(0, cut2).trim());
        buf = buf.slice(cut2);
        continue;
      }
      found.push(head.trim());
      buf = buf.slice(cut);
    }
    return found.filter((s) => s.length > 0);
  };
  return {
    push(delta) {
      buf += delta;
      return scan();
    },
    flush() {
      const tail = buf.trim();
      buf = '';
      return tail ? [tail] : [];
    },
  };
}
