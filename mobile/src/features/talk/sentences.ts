/**
 * Режет поток реплики бадди на предложения, чтобы озвучка началась с первого предложения,
 * не дожидаясь конца генерации. Предложение закрыто, когда после . ! ? … идёт пробел или конец.
 */
export function createSentenceSplitter(): { push(delta: string): string[]; flush(): string[] } {
  let buf = '';
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
        let scanFrom = cut;
        let realCut = -1;
        for (;;) {
          const rest = buf.slice(scanFrom);
          const m2 = /[.!?…]+(?=\s)/.exec(rest);
          if (!m2) break;
          const abs = scanFrom + m2.index;
          const beforeDot2 = buf.slice(0, abs);
          if (m2[0] === '.' && /(\d|(^|\s)\p{L})$/u.test(beforeDot2)) {
            scanFrom = abs + m2[0].length;
            continue;
          }
          realCut = abs + m2[0].length;
          break;
        }
        if (realCut < 0) break;
        found.push(buf.slice(0, realCut).trim());
        buf = buf.slice(realCut);
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
