import { create } from 'zustand';

import type { ReviewsRepo } from '@/db/reviewsRepo';
import { emptyCard, schedule } from '@/domain/fsrs';
import type { ReviewCard, StepRef } from '@/domain/reviewCard';

export interface NewRecord {
  subjectId: string;
  subjectName: string;
  title: string;
  note: string;
  source: string;
  ref: StepRef | null;
  ok: boolean;
}

export interface ReviewResult {
  cardId: string;
  ok: boolean;
}

let seq = 0;
export function newCardId(now: Date): string {
  seq += 1;
  return `c-${now.getTime().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Очередь повторов. Источник истины — репозиторий (SQLite); в памяти — копия для UI.
 * Все записи проходят через FSRS: сроками владеет алгоритм.
 */
export interface ReviewsState {
  repo: ReviewsRepo | null;
  cards: ReviewCard[];
  ready: boolean;
  attach: (repo: ReviewsRepo) => Promise<void>;
  detach: () => void;
  /**
   * Записи после сессии урока → карточки. Если карточка с той же ссылкой на шаг уже есть,
   * она пересчитывается по результату, а не дублируется: одна учебная точка — одна карточка.
   */
  addRecords: (records: NewRecord[], now?: Date) => Promise<ReviewCard[]>;
  /** Результаты сессии повторов → пересчёт сроков существующих карточек. */
  applyResults: (results: ReviewResult[], now?: Date) => Promise<void>;
  removeSubject: (subjectId: string) => Promise<void>;
}

export const useReviews = create<ReviewsState>((set, get) => ({
  repo: null,
  cards: [],
  ready: false,
  attach: async (repo) => {
    const cards = await repo.all();
    set({ repo, cards, ready: true });
  },
  detach: () => set({ repo: null, cards: [], ready: false }),
  addRecords: async (records, now = new Date()) => {
    const { repo, cards } = get();
    const existingByRef = new Map(cards.filter((c) => c.ref).map((c) => [`${c.ref!.subjectId}:${c.ref!.step}`, c]));
    const created: ReviewCard[] = [];
    const updated: ReviewCard[] = [];
    const logs = [];
    for (const r of records) {
      const prev = r.ref ? existingByRef.get(`${r.ref.subjectId}:${r.ref.step}`) : undefined;
      if (prev) {
        const { card, log } = schedule(prev.fsrs, r.ok, now);
        updated.push({ ...prev, title: r.title, note: r.note, fsrs: card });
        logs.push({ cardId: prev.id, log });
        continue;
      }
      const { card, log } = schedule(emptyCard(now), r.ok, now);
      const id = newCardId(now);
      created.push({ id, subjectId: r.subjectId, subjectName: r.subjectName, title: r.title, note: r.note, source: r.source, ref: r.ref, createdAt: now.getTime(), fsrs: card });
      logs.push({ cardId: id, log });
    }
    if (repo) {
      await repo.upsert([...updated, ...created]);
      await repo.addLogs(logs);
    }
    const upd = new Map(updated.map((c) => [c.id, c]));
    set((s) => ({ cards: [...s.cards.map((c) => upd.get(c.id) ?? c), ...created] }));
    return [...updated, ...created];
  },
  applyResults: async (results, now = new Date()) => {
    const { repo, cards } = get();
    const byId = new Map(cards.map((c) => [c.id, c]));
    const updated: ReviewCard[] = [];
    const logs = [];
    for (const r of results) {
      const c = byId.get(r.cardId);
      if (!c) continue;
      const { card, log } = schedule(c.fsrs, r.ok, now);
      updated.push({ ...c, fsrs: card });
      logs.push({ cardId: c.id, log });
    }
    if (repo) {
      await repo.upsert(updated);
      await repo.addLogs(logs);
    }
    const upd = new Map(updated.map((c) => [c.id, c]));
    set((s) => ({ cards: s.cards.map((c) => upd.get(c.id) ?? c) }));
  },
  removeSubject: async (subjectId) => {
    const { repo } = get();
    if (repo) await repo.removeBySubject(subjectId);
    set((s) => ({ cards: s.cards.filter((c) => c.subjectId !== subjectId) }));
  },
}));
