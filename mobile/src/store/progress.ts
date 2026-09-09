import { create } from 'zustand';

import { detectLanguage, type LanguageInfo } from '@/domain/languages';
import { customLesson, reviewLesson, seedLessons, seedMissions } from '@/domain/seed';
import type { CustomSubject, Lesson, LessonRecord, Mission, SubjectConfig, SubjectId } from '@/domain/types';
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
  /** Урок готов (сохраняется, чтобы сессия брала именно его); remoteId — id предмета на сервере. */
  setCustomReady: (lesson: Lesson, remoteId?: string, planStage?: number) => void;
  startNextLesson: (records: LessonRecord[]) => void;
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
      custom: { ...c, ready: false, language: c.language === undefined ? detectLanguage(c.topic) : c.language, lessonNumber: 0 },
      customLesson: null,
      prepError: null,
      prepStage: 0,
      missions: { ...s.missions, [CUSTOM_ID]: { cur: c.mission, hist: [] } },
      removed: { ...s.removed, [CUSTOM_ID]: false },
      done: { ...s.done, [CUSTOM_ID]: false },
    })),
  setPrepStage: (stage) => set({ prepStage: stage, prepError: null }),
  setPrepError: (message) => set({ prepError: message }),
  setCustomReady: (lesson, remoteId, planStage) =>
    set((s) =>
      s.custom
        ? {
            custom: {
              ...s.custom, ready: true, remoteId: remoteId ?? s.custom.remoteId, lessonNumber: (s.custom.lessonNumber ?? 0) + 1, pendingRecords: undefined,
              planStage: planStage ?? s.custom.planStage,
            },
            customLesson: lesson,
            prepStage: PREP_STAGES,
            prepError: null,
            // Новый урок — предмет снова «не пройден сегодня».
            done: { ...s.done, [CUSTOM_ID]: false },
          }
        : s,
    ),
  /** Разбор пройден, следующий урок готовится: карточка снова показывает этапы. */
  startNextLesson: (records) =>
    // Источники предмета уже есть — следующий урок начинается сразу с «собираю урок».
    set((s) => (s.custom ? { custom: { ...s.custom, ready: false, pendingRecords: records }, prepStage: 2, prepError: null } : s)),
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

/** Язык предмета: у пользовательского — сохранённый при создании, у сидовых — по имени. */
export function subjectLanguage(s: Pick<ProgressState, 'custom'>, id: SubjectId): LanguageInfo | null {
  if (id === CUSTOM_ID) return s.custom?.language ?? (s.custom ? detectLanguage(s.custom.topic) : null);
  return detectLanguage(seedLessons[id]?.name ?? '');
}

export function subjectName(s: Pick<ProgressState, 'custom'>, id: SubjectId): string {
  if (id === CUSTOM_ID) return s.custom?.title ?? s.custom?.topic ?? '';
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
