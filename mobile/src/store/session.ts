import { create } from 'zustand';

import type { Lesson } from '@/domain/types';
import {
  goBack as engineGoBack,
  goForward as engineGoForward,
  primary as enginePrimary,
  restoreSession,
  type SavedSession,
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
  /** «Сомневаюсь» по индексу записи в разборе — отправлено на проверку. */
  doubts: Record<number, boolean>;
  /** saved — снимок прерванной сессии этого предмета; подходит только к тому же уроку. */
  start: (subjectId: string, lesson: Lesson, cardIds?: string[], saved?: SavedSession) => void;
  select: (i: number) => void;
  toggleOrder: (i: number) => void;
  setInput: (v: string) => void;
  /** true — сессия закончена, пора в разбор. */
  /** hits — оценка свободного ответа сервером; без неё критерии считаются по ключам. */
  primary: (hits?: boolean[]) => boolean;
  /** Свайпы по шагам: назад к пройденным, вперёд до активного. */
  back: () => void;
  forward: () => void;
  setRec: (rec: boolean) => void;
  doubt: (recordIndex: number) => void;
  end: () => void;
}

export const useSession = create<SessionStore>((set, get) => ({
  s: null,
  rec: false,
  doubts: {},
  start: (subjectId, lesson, cardIds, saved) =>
    set({ s: restoreSession(subjectId, lesson, saved, cardIds) ?? startSession(subjectId, lesson, cardIds), rec: false, doubts: {} }),
  select: (i) => set((st) => (st.s ? { s: engineSelect(st.s, i) } : st)),
  toggleOrder: (i) => set((st) => (st.s ? { s: engineToggleOrder(st.s, i) } : st)),
  setInput: (v) => set((st) => (st.s ? { s: engineSetInput(st.s, v) } : st)),
  primary: (hits) => {
    const cur = get().s;
    if (!cur) return false;
    const r = enginePrimary(cur, hits);
    set({ s: r.state, rec: false });
    return r.finished;
  },
  back: () => set((st) => (st.s ? { s: engineGoBack(st.s) } : st)),
  forward: () => set((st) => (st.s ? { s: engineGoForward(st.s), rec: false } : st)),
  setRec: (rec) => set({ rec }),
  doubt: (i) => set((st) => ({ doubts: { ...st.doubts, [i]: true } })),
  end: () => set({ s: null, rec: false, doubts: {} }),
}));
