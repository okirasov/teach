import { create } from 'zustand';

import type { RefsRepo } from '@/db/refsRepo';
import type { Reference } from '@/domain/reference';

export interface RefsState {
  repo: RefsRepo | null;
  refs: Reference[];
  ready: boolean;
  attach: (repo: RefsRepo) => Promise<void>;
  detach: () => void;
  removeSubject: (subjectId: string) => Promise<void>;
}

/** Справочники: источник истины — репозиторий (SQLite), в памяти — копия для UI. Работают офлайн. */
export const useRefs = create<RefsState>((set, get) => ({
  repo: null,
  refs: [],
  ready: false,
  attach: async (repo) => set({ repo, refs: await repo.all(), ready: true }),
  detach: () => set({ repo: null, refs: [], ready: false }),
  removeSubject: async (subjectId) => {
    const { repo } = get();
    if (repo) await repo.removeBySubject(subjectId);
    set((s) => ({ refs: s.refs.filter((x) => x.subjectId !== subjectId) }));
  },
}));
