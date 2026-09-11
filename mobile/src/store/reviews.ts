import { create } from 'zustand';

import type { ReviewsRepo } from '@/db/reviewsRepo';
import { emptyCard, schedule } from '@/domain/fsrs';
import type { ReviewCard, StepRef } from '@/domain/reviewCard';

/**
 * Одна учебная точка — шаг конкретного урока. Пересдача того же урока пересчитывает карточку,
 * шаг другого урока даёт новую: иначе записи нового урока переписывали бы карточки старого.
 */
const refKey = (ref: StepRef) => `${ref.subjectId}:${ref.lessonNumber ?? ''}:${ref.step}`;

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
export interface ReviewStats {
  month: number;
  today: number;
}

export interface ReviewsState {
  repo: ReviewsRepo | null;
  cards: ReviewCard[];
  ready: boolean;
  /** Закрыто карточек за месяц / сегодня — для карточки аккаунта. */
  stats: ReviewStats;
  refreshStats: (now?: Date) => Promise<void>;
  attach: (repo: ReviewsRepo) => Promise<void>;
  detach: () => void;
  /**
   * Записи после сессии урока → карточки. Если карточка с той же ссылкой на шаг того же урока уже есть,
   * она пересчитывается по результату, а не дублируется: одна учебная точка — одна карточка.
   */
  addRecords: (records: NewRecord[], now?: Date) => Promise<ReviewCard[]>;
  /** Результаты сессии повторов → пересчёт сроков существующих карточек. */
  applyResults: (results: ReviewResult[], now?: Date) => Promise<void>;
  removeSubject: (subjectId: string) => Promise<void>;
  /** Починка ссылок старых карточек: номер урока и сохранённый вопрос, без пересчёта сроков. */
  repairRefs: (updates: { cardId: string; ref: StepRef }[]) => Promise<void>;
}

export const useReviews = create<ReviewsState>((set, get) => ({
  repo: null,
  cards: [],
  ready: false,
  stats: { month: 0, today: 0 },
  refreshStats: async (now = new Date()) => {
    const { repo } = get();
    if (!repo) return;
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [month, today] = await Promise.all([repo.countLogsSince(monthStart), repo.countLogsSince(dayStart)]);
    set({ stats: { month, today } });
  },
  attach: async (repo) => {
    const cards = await repo.all();
    set({ repo, cards, ready: true });
    await get().refreshStats();
  },
  detach: () => set({ repo: null, cards: [], ready: false, stats: { month: 0, today: 0 } }),
  addRecords: async (records, now = new Date()) => {
    const { repo, cards } = get();
    const existingByRef = new Map(cards.filter((c) => c.ref).map((c) => [refKey(c.ref!), c]));
    const created: ReviewCard[] = [];
    const updated: ReviewCard[] = [];
    const logs = [];
    for (const r of records) {
      const prev = r.ref ? existingByRef.get(refKey(r.ref)) : undefined;
      if (prev) {
        const { card, log } = schedule(prev.fsrs, r.ok, now);
        updated.push({ ...prev, title: r.title, note: r.note, ref: r.ref ?? prev.ref, fsrs: card });
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
    await get().refreshStats(now);
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
    await get().refreshStats(now);
  },
  repairRefs: async (updates) => {
    if (updates.length === 0) return;
    const byId = new Map(updates.map((u) => [u.cardId, u.ref]));
    const next = get().cards.map((c) => (byId.has(c.id) ? { ...c, ref: byId.get(c.id)! } : c));
    const { repo } = get();
    if (repo) await repo.upsert(next.filter((c) => byId.has(c.id)));
    set({ cards: next });
  },
  removeSubject: async (subjectId) => {
    const { repo } = get();
    if (repo) await repo.removeBySubject(subjectId);
    set((s) => ({ cards: s.cards.filter((c) => c.subjectId !== subjectId) }));
  },
}));
