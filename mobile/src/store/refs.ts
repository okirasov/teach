import { create } from 'zustand';

import type { ReferenceIn } from '@/content/types';

import type { RefsRepo } from '@/db/refsRepo';
import type { Reference } from '@/domain/reference';

export interface RefsState {
  repo: RefsRepo | null;
  refs: Reference[];
  ready: boolean;
  attach: (repo: RefsRepo) => Promise<void>;
  detach: () => void;
  removeSubject: (subjectId: string) => Promise<void>;
  /** Полный набор справочников предмета с сервера → SQLite и стор; старые строки предмета заменяются. */
  replaceForSubject: (subjectId: string, subjectName: string, refs: ReferenceIn[]) => Promise<void>;
}

/** Справочники: источник истины — репозиторий (SQLite), в памяти — копия для UI. Работают офлайн. */
export const useRefs = create<RefsState>((set, get) => ({
  repo: null,
  refs: [],
  ready: false,
  attach: async (repo) => set({ repo, refs: await repo.all(), ready: true }),
  detach: () => set({ repo: null, refs: [], ready: false }),
  replaceForSubject: async (subjectId, subjectName, incoming) => {
    const { repo, refs } = get();
    const prev = new Map(refs.filter((r) => r.subjectId === subjectId).map((r) => [r.id, r]));
    const next: Reference[] = incoming.map((r) => {
      const id = `${subjectId}:${r.id}`;
      const old = prev.get(id);
      return {
        id, subjectId, subjectName, group: r.group, title: r.title, updatedAfter: r.updatedAfter,
        rows: r.rows.map((row) => ({ sec: row.sec, k: row.k, v: row.v, weak: old?.rows.find((o) => o.k === row.k)?.weak ?? false })),
      };
    });
    if (repo) {
      await repo.removeBySubject(subjectId);
      await repo.upsert(next);
    }
    set((s) => ({ refs: [...s.refs.filter((r) => r.subjectId !== subjectId), ...next] }));
  },
  removeSubject: async (subjectId) => {
    const { repo } = get();
    if (repo) await repo.removeBySubject(subjectId);
    set((s) => ({ refs: s.refs.filter((x) => x.subjectId !== subjectId) }));
  },
}));
