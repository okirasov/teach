import { create } from 'zustand';

import { customLesson, reviewLesson, seedLessons, seedMissions } from '@/domain/seed';
import type { CustomSubject, Lesson, Mission, SubjectConfig, SubjectId } from '@/domain/types';
import { defaultSubjectConfig } from '@/domain/types';

export const CUSTOM_ID: SubjectId = 'custom';
export const REVIEW_ID: SubjectId = 'review';

/** Этапы фоновой подготовки первого урока (t.prepSteps). */
export const PREP_STAGES = 3;

/**
 * Прогресс и данные обучения (`done, added, custom, removed, missions, cfg` прототипа).
 * Пока в памяти; на шаге хранилища — SQLite с тем же интерфейсом.
 */
export interface ProgressState {
  done: Record<SubjectId, boolean>;
  removed: Record<SubjectId, boolean>;
  /** Прирост очереди повторов за пройденные сессии. */
  added: number;
  custom: CustomSubject | null;
  prepStage: number;
  missions: Record<SubjectId, Mission>;
  cfg: Record<SubjectId, Partial<SubjectConfig>>;
  reviewLog: { t: string; s: string }[];

  markDone: (id: SubjectId, records: { t: string; s: string }[]) => void;
  removeSubject: (id: SubjectId) => void;
  createCustom: (c: Omit<CustomSubject, 'ready'>) => void;
  /** Этап фоновой подготовки первого урока. */
  setPrepStage: (stage: number) => void;
  /** Первый урок готов (сохраняется, чтобы сессия брала именно его). */
  setCustomReady: (lesson: Lesson) => void;
  customLesson: Lesson | null;
  /** Подготовка первого урока не удалась (сервер недоступен и т. п.) — карточка предлагает повторить. */
  prepError: string | null;
  setPrepError: (message: string | null) => void;
  setMission: (id: SubjectId, text: string) => void;
  setCfg: (id: SubjectId, patch: Partial<SubjectConfig>) => void;
}

export const useProgress = create<ProgressState>((set, get) => ({
  done: {},
  removed: {},
  added: 0,
  custom: null,
  customLesson: null,
  prepError: null,
  prepStage: 0,
  missions: { ...seedMissions },
  cfg: {},
  reviewLog: [],

  markDone: (id, records) =>
    set((s) => ({ done: { ...s.done, [id]: true }, added: s.added + records.length, reviewLog: [...s.reviewLog, ...records] })),
  removeSubject: (id) =>
    set((s) => {
      const cfg = { ...s.cfg };
      delete cfg[id];
      return { removed: { ...s.removed, [id]: true }, cfg, custom: id === CUSTOM_ID ? null : s.custom, customLesson: id === CUSTOM_ID ? null : s.customLesson };
    }),
  createCustom: (c) =>
    set((s) => ({
      custom: { ...c, ready: false },
      customLesson: null,
      prepError: null,
      prepStage: 0,
      missions: { ...s.missions, [CUSTOM_ID]: { cur: c.mission, hist: [] } },
      removed: { ...s.removed, [CUSTOM_ID]: false },
      done: { ...s.done, [CUSTOM_ID]: false },
    })),
  setPrepStage: (stage) => set({ prepStage: stage, prepError: null }),
  setPrepError: (message) => set({ prepError: message }),
  setCustomReady: (lesson) =>
    set((s) => (s.custom ? { custom: { ...s.custom, ready: true }, customLesson: lesson, prepStage: PREP_STAGES } : s)),
  setMission: (id, text) =>
    set((s) => {
      const m = s.missions[id] ?? { cur: '', hist: [] };
      return { missions: { ...s.missions, [id]: { cur: text, hist: [...m.hist, `v${m.hist.length + 1} · ${m.cur}`] } } };
    }),
  setCfg: (id, patch) => set((s) => ({ cfg: { ...s.cfg, [id]: { ...s.cfg[id], ...patch } } })),
}));

/** Селекторы. */

export function activeSubjectIds(s: Pick<ProgressState, 'removed' | 'custom'>): SubjectId[] {
  const ids = Object.keys(seedLessons).filter((id) => !s.removed[id]);
  if (s.custom && !s.removed[CUSTOM_ID]) ids.push(CUSTOM_ID);
  return ids;
}

export function subjectName(s: Pick<ProgressState, 'custom'>, id: SubjectId): string {
  if (id === CUSTOM_ID) return s.custom?.topic ?? '';
  return seedLessons[id]?.name ?? '';
}

export function subjectConfig(s: Pick<ProgressState, 'cfg'>, id: SubjectId): SubjectConfig {
  return { ...defaultSubjectConfig, ...s.cfg[id] };
}

export function getLesson(s: Pick<ProgressState, 'custom' | 'customLesson'>, id: SubjectId, reviewName: string): Lesson | null {
  if (id === REVIEW_ID) return reviewLesson(reviewName);
  if (id === CUSTOM_ID) return s.customLesson ?? (s.custom ? customLesson(s.custom.topic, s.custom.mission) : null);
  return seedLessons[id] ?? null;
}
