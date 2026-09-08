import type { ReviewCard } from '@/domain/reviewCard';
import type { ReviewLog } from 'ts-fsrs';

export interface ReviewLogEntry {
  cardId: string;
  log: ReviewLog;
}

/** Хранилище карточек повторов. Реализации: SQLite (устройство) и память (web-превью, тесты). */
export interface ReviewsRepo {
  all(): Promise<ReviewCard[]>;
  upsert(cards: ReviewCard[]): Promise<void>;
  addLogs(entries: ReviewLogEntry[]): Promise<void>;
  removeBySubject(subjectId: string): Promise<void>;
  count(): Promise<number>;
  /** Сколько ответов записано начиная с момента `since` (карточка аккаунта: за месяц / сегодня). */
  countLogsSince(since: Date): Promise<number>;
}

export function memoryReviewsRepo(initial: ReviewCard[] = []): ReviewsRepo & { logs: ReviewLogEntry[] } {
  const map = new Map(initial.map((c) => [c.id, c]));
  const logs: ReviewLogEntry[] = [];
  return {
    logs,
    async all() {
      return [...map.values()];
    },
    async upsert(cards) {
      for (const c of cards) map.set(c.id, c);
    },
    async addLogs(entries) {
      logs.push(...entries);
    },
    async removeBySubject(subjectId) {
      for (const [id, c] of map) if (c.subjectId === subjectId) map.delete(id);
    },
    async count() {
      return map.size;
    },
    async countLogsSince(since) {
      return logs.filter((e) => e.log.review.getTime() >= since.getTime()).length;
    },
  };
}
