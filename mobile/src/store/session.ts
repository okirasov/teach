import { create } from 'zustand';

import type { Lesson } from '@/domain/types';
import {
  primary as enginePrimary,
  select as engineSelect,
  setInput as engineSetInput,
  startSession,
  toggleOrder as engineToggleOrder,
  type SessionState,
} from '@/features/session/engine';

export interface SessionStore {
  s: SessionState | null;
  /** Идёт запись голоса. */
  rec: boolean;
  start: (subjectId: string, lesson: Lesson) => void;
  select: (i: number) => void;
  toggleOrder: (i: number) => void;
  setInput: (v: string) => void;
  /** true — сессия закончена, пора в разбор. */
  primary: () => boolean;
  setRec: (rec: boolean) => void;
  end: () => void;
}

export const useSession = create<SessionStore>((set, get) => ({
  s: null,
  rec: false,
  start: (subjectId, lesson) => set({ s: startSession(subjectId, lesson), rec: false }),
  select: (i) => set((st) => (st.s ? { s: engineSelect(st.s, i) } : st)),
  toggleOrder: (i) => set((st) => (st.s ? { s: engineToggleOrder(st.s, i) } : st)),
  setInput: (v) => set((st) => (st.s ? { s: engineSetInput(st.s, v) } : st)),
  primary: () => {
    const cur = get().s;
    if (!cur) return false;
    const r = enginePrimary(cur);
    set({ s: r.state, rec: false });
    return r.finished;
  },
  setRec: (rec) => set({ rec }),
  end: () => set({ s: null, rec: false }),
}));
