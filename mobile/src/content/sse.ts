/** События потока реплики бадди (POST /talks/{id}/turns, text/event-stream). */
export type SseTalkEvent = { t: 'delta'; text: string } | { t: 'done'; reply: string; turn: number } | { t: 'error'; message: string };

/**
 * Разбор SSE по кускам: событие — строки до пустой строки, полезная нагрузка — JSON после `data: `.
 * Неполный хвост хранится до следующего куска.
 */
export function createSseParser(): { push(chunk: string): SseTalkEvent[] } {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk;
      const out: SseTalkEvent[] = [];
      for (;;) {
        const end = buf.indexOf('\n\n');
        if (end < 0) break;
        const block = buf.slice(0, end);
        buf = buf.slice(end + 2);
        const data = block
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('\n');
        if (!data) continue;
        try {
          out.push(JSON.parse(data) as SseTalkEvent);
        } catch {
          // Битое событие пропускаем: поток продолжается, done всё равно придёт или сервер закроет соединение.
        }
      }
      return out;
    },
  };
}
