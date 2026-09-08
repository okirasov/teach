import type { Lesson } from '@/domain/types';

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

export interface PlanStage {
  n: string;
  t: string;
  d: string;
}

export interface SubjectDraft {
  topic: string;
  focus: string;
  mission: string;
  /** Выбранные источники (id из findSources). */
  sourceIds: string[];
  /** Сами выбранные источники — сервер не ищет их заново. */
  sources?: SourceCandidate[];
}

/** Этапы фоновой подготовки первого урока — ровно как на карточке «Готовится…». */
export type PrepStage = 0 | 1 | 2;

export interface ContentService {
  suggestFocus(topic: string): Promise<FocusOption[]>;
  findSources(topic: string, focus: string): Promise<SourceCandidate[]>;
  buildPlan(draft: Omit<SubjectDraft, 'sourceIds'>): Promise<PlanStage[]>;
  /**
   * Готовит первый урок в фоне. onStage вызывается на каждом этапе, промис резолвится уроком.
   * В проде: сервер ставит задачу, клиент получает push/поллит статус.
   */
  prepareFirstLesson(draft: SubjectDraft, onStage: (stage: PrepStage) => void): Promise<Lesson>;
}
