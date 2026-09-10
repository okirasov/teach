import { create } from 'zustand';

import { detectLanguage, type LanguageInfo } from '@/domain/languages';
import { customLesson, DEMO_IDS, reviewLesson, seedLessons, seedMissions } from '@/domain/seed';
import type { SavedSession } from '@/features/session/engine';
import type { CustomSubject, Lesson, LessonRecord, Mission, SubjectConfig, SubjectId } from '@/domain/types';
import { defaultSubjectConfig } from '@/domain/types';

/**
 * Id первого пользовательского предмета. Исторический: карточки повторов и справочники
 * уже созданных предметов лежат в SQLite с этим subjectId, поэтому он остаётся как есть,
 * а новые предметы получают сгенерированные id.
 */
export const CUSTOM_ID: SubjectId = 'custom';
export const REVIEW_ID: SubjectId = 'review';

/** Этапы фоновой подготовки первого урока (t.prepSteps). */
export const PREP_STAGES = 3;

/** Подготовка урока конкретного предмета: этап 0..3 и ошибка, если сорвалось. */
export interface PrepState {
  stage: number;
  error: string | null;
}

const NO_PREP: PrepState = { stage: 0, error: null };

/** Зарезервированные id: демо, повторы и исторический первый предмет. */
const RESERVED = new Set<SubjectId>([REVIEW_ID, CUSTOM_ID, ...DEMO_IDS]);

/** Прогресс и данные обучения. Пользовательских предметов может быть несколько. */
export interface ProgressState {
  done: Record<SubjectId, boolean>;
  /** Прерванные крестиком сессии по предмету: возобновляются при следующем открытии того же урока. */
  sessions: Record<SubjectId, SavedSession>;
  removed: Record<SubjectId, boolean>;
  /** Прирост очереди повторов за пройденные сессии. */
  added: number;
  /** Пользовательские предметы по id. */
  subjects: Record<SubjectId, CustomSubject>;
  /** Текущий готовый урок каждого предмета. */
  lessons: Record<SubjectId, Lesson>;
  /** Этап подготовки по предмету (переживает перезапуск). */
  prepStages: Record<SubjectId, number>;
  /**
   * Ошибка подготовки по предмету. Намеренно не сохраняется: после перезапуска
   * прерванная подготовка должна возобновиться сама, а не остаться навсегда «неудачной».
   */
  prepErrors: Record<SubjectId, string>;
  /** Монотонный счётчик: даёт id и порядок, никогда не переиспользуется. */
  seq: number;
  missions: Record<SubjectId, Mission>;
  cfg: Record<SubjectId, Partial<SubjectConfig>>;
  reviewLog: { t: string; s: string }[];

  markDone: (id: SubjectId, records: { t: string; s: string }[]) => void;
  saveSession: (id: SubjectId, saved: SavedSession) => void;
  clearSession: (id: SubjectId) => void;
  removeSubject: (id: SubjectId) => void;
  /** Создаёт предмет и возвращает его id: первый — CUSTOM_ID, дальше сгенерированные. */
  createSubject: (c: Omit<CustomSubject, 'ready'>) => SubjectId;
  setPrepStage: (id: SubjectId, stage: number) => void;
  setPrepError: (id: SubjectId, message: string | null) => void;
  /** Урок готов (сохраняется, чтобы сессия брала именно его); remoteId — id предмета на сервере. */
  setSubjectReady: (id: SubjectId, lesson: Lesson, remoteId?: string, planStage?: number) => void;
  startNextLesson: (id: SubjectId, records: LessonRecord[]) => void;
  setMission: (id: SubjectId, text: string) => void;
  setCfg: (id: SubjectId, patch: Partial<SubjectConfig>) => void;
}

/**
 * Id нового предмета по монотонному счётчику. Id удалённого предмета не переиспользуется:
 * иначе новый предмет унаследовал бы карточки повторов и справочники удалённого,
 * если их удаление ещё не дошло до SQLite.
 */
export function nextSubjectId(seq: number): SubjectId {
  return `s${seq}`;
}

export const useProgress = create<ProgressState>((set) => ({
  done: {},
  sessions: {},
  removed: {},
  added: 0,
  subjects: {},
  lessons: {},
  prepStages: {},
  prepErrors: {},
  seq: 0,
  missions: { ...seedMissions },
  cfg: {},
  reviewLog: [],

  saveSession: (id, saved) => set((s) => ({ sessions: { ...s.sessions, [id]: saved } })),
  clearSession: (id) =>
    set((s) => {
      if (!(id in s.sessions)) return s;
      const sessions = { ...s.sessions };
      delete sessions[id];
      return { sessions };
    }),
  markDone: (id, records) =>
    set((s) => ({ done: { ...s.done, [id]: true }, added: s.added + records.length, reviewLog: [...s.reviewLog, ...records] })),
  removeSubject: (id) =>
    set((s) => {
      const drop = <T,>(map: Record<SubjectId, T>) => {
        const next = { ...map };
        delete next[id];
        return next;
      };
      return {
        removed: { ...s.removed, [id]: true },
        cfg: drop(s.cfg),
        subjects: drop(s.subjects),
        lessons: drop(s.lessons),
        prepStages: drop(s.prepStages),
        prepErrors: drop(s.prepErrors),
        sessions: drop(s.sessions),
      };
    }),
  createSubject: (c) => {
    let seq = useProgress.getState().seq + 1;
    while (RESERVED.has(nextSubjectId(seq))) seq += 1;
    const id = nextSubjectId(seq);
    set((s) => ({
      seq,
      subjects: {
        ...s.subjects,
        [id]: {
          ...c,
          ready: false,
          language: c.language === undefined ? detectLanguage(c.topic) : c.language,
          lessonNumber: 0,
          createdAt: seq,
        },
      },
      lessons: (({ [id]: _drop, ...rest }) => rest)(s.lessons),
      prepStages: { ...s.prepStages, [id]: 0 },
      prepErrors: (({ [id]: _dropErr, ...rest }) => rest)(s.prepErrors),
      missions: { ...s.missions, [id]: { cur: c.mission, hist: [] } },
      removed: { ...s.removed, [id]: false },
      done: { ...s.done, [id]: false },
    }));
    return id;
  },
  setPrepStage: (id, stage) =>
    set((s) => ({ prepStages: { ...s.prepStages, [id]: stage }, prepErrors: (({ [id]: _drop, ...rest }) => rest)(s.prepErrors) })),
  setPrepError: (id, message) =>
    set((s) => (message === null
      ? { prepErrors: (({ [id]: _drop, ...rest }) => rest)(s.prepErrors) }
      : { prepErrors: { ...s.prepErrors, [id]: message } })),
  setSubjectReady: (id, lesson, remoteId, planStage) =>
    set((s) => {
      const cur = s.subjects[id];
      if (!cur) return s;
      return {
        subjects: {
          ...s.subjects,
          [id]: {
            ...cur, ready: true, remoteId: remoteId ?? cur.remoteId, lessonNumber: (cur.lessonNumber ?? 0) + 1,
            pendingRecords: undefined, planStage: planStage ?? cur.planStage,
          },
        },
        lessons: { ...s.lessons, [id]: lesson },
        prepStages: { ...s.prepStages, [id]: PREP_STAGES },
        prepErrors: (({ [id]: _dropErr, ...rest }) => rest)(s.prepErrors),
        // Новый урок — прерванная сессия прошлого урока больше не нужна.
        sessions: (({ [id]: _dropped, ...rest }) => rest)(s.sessions),
        // Новый урок — предмет снова «не пройден сегодня».
        done: { ...s.done, [id]: false },
      };
    }),
  /** Разбор пройден, следующий урок готовится: карточка снова показывает этапы. */
  startNextLesson: (id, records) =>
    set((s) => {
      const cur = s.subjects[id];
      if (!cur) return s;
      return {
        subjects: { ...s.subjects, [id]: { ...cur, ready: false, pendingRecords: records } },
        // Источники предмета уже есть — следующий урок начинается сразу с «собираю урок».
        prepStages: { ...s.prepStages, [id]: 2 },
        prepErrors: (({ [id]: _dropErr, ...rest }) => rest)(s.prepErrors),
      };
    }),
  setMission: (id, text) =>
    set((s) => {
      const m = s.missions[id] ?? { cur: '', hist: [] };
      return { missions: { ...s.missions, [id]: { cur: text, hist: [...m.hist, `v${m.hist.length + 1} · ${m.cur}`] } } };
    }),
  setCfg: (id, patch) => set((s) => ({ cfg: { ...s.cfg, [id]: { ...s.cfg[id], ...patch } } })),
}));

/** Селекторы. */

type SubjectsSlice = Pick<ProgressState, 'subjects'>;

/** Пользовательские предметы в порядке создания. */
export function userSubjectIds(s: Pick<ProgressState, 'subjects' | 'removed'>): SubjectId[] {
  return Object.keys(s.subjects)
    .filter((id) => !s.removed[id])
    .sort((a, b) => (s.subjects[a].createdAt ?? 0) - (s.subjects[b].createdAt ?? 0));
}

/** Предметы на экранах: демо и пользовательские. */
export function activeSubjectIds(s: Pick<ProgressState, 'removed' | 'subjects'>): SubjectId[] {
  return [...DEMO_IDS.filter((id) => !s.removed[id]), ...userSubjectIds(s)];
}

export function isUserSubject(s: SubjectsSlice, id: SubjectId): boolean {
  return id in s.subjects;
}

/** Состояние подготовки предмета. */
export function prepOf(s: Pick<ProgressState, 'prepStages' | 'prepErrors'>, id: SubjectId): PrepState {
  const stage = s.prepStages[id];
  const error = s.prepErrors[id];
  if (stage === undefined && error === undefined) return NO_PREP;
  return { stage: stage ?? 0, error: error ?? null };
}

/** Язык предмета: у пользовательского — сохранённый при создании, у сидовых — по имени. */
export function subjectLanguage(s: SubjectsSlice, id: SubjectId): LanguageInfo | null {
  const sub = s.subjects[id];
  if (sub) return sub.language ?? detectLanguage(sub.topic);
  return detectLanguage(seedLessons[id]?.name ?? '');
}

export function subjectName(s: SubjectsSlice, id: SubjectId): string {
  const sub = s.subjects[id];
  if (sub) return sub.title ?? sub.topic;
  return seedLessons[id]?.name ?? '';
}

export function subjectConfig(s: Pick<ProgressState, 'cfg'>, id: SubjectId): SubjectConfig {
  return { ...defaultSubjectConfig, ...s.cfg[id] };
}

export function getLesson(s: Pick<ProgressState, 'subjects' | 'lessons'>, id: SubjectId, reviewName: string): Lesson | null {
  if (id === REVIEW_ID) return reviewLesson(reviewName);
  const sub = s.subjects[id];
  if (sub) return s.lessons[id] ?? customLesson(sub.topic, sub.mission);
  return seedLessons[id] ?? null;
}

/**
 * Снимок kv старой версии (один предмет в `custom`/`customLesson`/`prepStage`) —
 * в новую форму. Данные тестировщиков переживают обновление: id остаётся 'custom',
 * поэтому его карточки повторов и справочники продолжают находиться.
 */
export function migrateProgressSnapshot(saved: Record<string, unknown>): Record<string, unknown> {
  if (!saved || 'subjects' in saved) return saved;
  const { custom, customLesson: lesson, prepStage, prepError: _dropError, ...rest } = saved as Record<string, unknown> & {
    custom?: CustomSubject | null;
    customLesson?: Lesson | null;
    prepStage?: number;
    prepError?: string | null;
  };
  // Ошибку подготовки не переносим: после обновления прерванная подготовка должна возобновиться.
  if (!custom) return { ...rest, subjects: {}, lessons: {}, prepStages: {}, prepErrors: {}, seq: 0 };
  return {
    ...rest,
    // createdAt 0 и seq 0: предмет остаётся первым, следующий получит id s1.
    subjects: { [CUSTOM_ID]: { ...custom, createdAt: 0 } },
    lessons: lesson ? { [CUSTOM_ID]: lesson } : {},
    prepStages: custom.ready ? {} : { [CUSTOM_ID]: typeof prepStage === 'number' ? prepStage : 0 },
    prepErrors: {},
    seq: 0,
  };
}
