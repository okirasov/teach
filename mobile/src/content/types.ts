import type { Lesson, LessonRecord, PlanStage } from '@/domain/types';

/**
 * Сервис контента — единственная дверь клиента к генерации (бриф §5.1: клиент не держит
 * ключей и не планирует обучение; оркестратор на сервере зовёт модель, валидирует, кэширует).
 * Сейчас реализован локальной заглушкой с данными прототипа.
 */

export interface FocusOption {
  t: string;
  d: string;
}

export type Trust = 'high' | 'mid' | 'low';

export interface SourceCandidate {
  id: string;
  t: string;
  m: string;
  trust: Trust;
}

export type { PlanStage } from '@/domain/types';

export interface SubjectDraft {
  topic: string;
  /** Короткое имя для карточек (≤ 24 символов); topic остаётся полной формулировкой. */
  title?: string;
  focus: string;
  mission: string;
  /** Выбранные источники (id из findSources). */
  sourceIds: string[];
  /** Сами выбранные источники — сервер не ищет их заново. */
  sources?: SourceCandidate[];
  /** План из мастера — остаётся в предмете для индикатора этапа. */
  plan?: PlanStage[];
  /** «Длительность урока» из настроек предмета: бюджет текста и число практик на сервере. */
  durationMinutes?: number;
}

export interface NextLessonOptions {
  durationMinutes?: number;
}

/** Этапы фоновой подготовки первого урока — ровно как на карточке «Готовится…». */
export type PrepStage = 0 | 1 | 2;

/** Строка справочника с сервера. */
export interface ReferenceRowIn {
  k: string;
  v: string;
  sec?: string;
}

/** Справочник предмета с сервера (глоссарий и т. п.). */
export interface ReferenceIn {
  id: string;
  group: string;
  title: string;
  updatedAfter: number;
  rows: ReferenceRowIn[];
}

export interface ContentService {
  suggestFocus(topic: string): Promise<FocusOption[]>;
  /** Короткое имя предмета из формулировки темы. */
  suggestTitle(topic: string): Promise<string>;
  findSources(topic: string, focus: string): Promise<SourceCandidate[]>;
  buildPlan(draft: Omit<SubjectDraft, 'sourceIds'>): Promise<PlanStage[]>;
  /**
   * Готовит первый урок в фоне. onStage вызывается на каждом этапе, промис резолвится уроком
   * и id предмета на сервере (у локальной заглушки его нет).
   */
  prepareFirstLesson(draft: SubjectDraft, onStage: (stage: PrepStage) => void): Promise<PreparedLesson>;
  /**
   * Следующий урок по записям разбора: сервер сохраняет записи и генерирует урок number
   * чуть выше границы, которую они показали.
   */
  prepareNextLesson(remoteId: string | undefined, number: number, records: LessonRecord[], onStage: (stage: PrepStage) => void, opts?: NextLessonOptions): Promise<PreparedLesson>;
  /**
   * Предзагрузка: пока идёт урок N, сервер заготавливает N+1 по записям на этот момент.
   * Заготовка используется после разбора, если этап не сменился и разбор не провальный.
   */
  prefetchNextLesson(remoteId: string | undefined): Promise<void>;
  /** Продолжить ожидание урока N после перезапуска приложения: записи уже на сервере, заново не шлём. */
  resumeLesson(remoteId: string | undefined, number: number, onStage: (stage: PrepStage) => void): Promise<PreparedLesson>;
}

export interface PreparedLesson {
  lesson: Lesson;
  remoteId?: string;
  /** Справочники предмета после этого урока (полный актуальный набор). */
  references?: ReferenceIn[];
  /** Этап плана, на котором построен урок (0-based); сервер двигает его по результатам. */
  planStage?: number;
}
