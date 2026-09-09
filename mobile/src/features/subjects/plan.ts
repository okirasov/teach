import type { PlanStage } from '@/domain/types';

/**
 * Этап плана по номеру урока — та же карта, что у сервера (Prompts.NextLesson):
 * уроки 1–3 → этап 01 «каркас», 4–6 → 02 «приёмы», дальше → 03 «применение под миссию».
 * Диагностика (урок 1) относится к первому этапу.
 */
export function planStageIndex(lessonNumber: number, total = 3): number {
  const n = Math.max(1, lessonNumber);
  const idx = n <= 3 ? 0 : n <= 6 ? 1 : 2;
  return Math.min(idx, Math.max(0, total - 1));
}

export interface PlanProgress {
  index: number;
  total: number;
  title: string;
  lessonNumber: number;
}

/** Этап с сервера (по результатам) имеет приоритет; без него — оценка по номеру урока. */
export function planProgress(plan: PlanStage[] | undefined, lessonNumber: number, serverStage?: number): PlanProgress | undefined {
  if (!plan || plan.length === 0 || lessonNumber <= 0) return undefined;
  const index = serverStage !== undefined ? Math.min(Math.max(0, serverStage), plan.length - 1) : planStageIndex(lessonNumber, plan.length);
  return { index, total: plan.length, title: plan[index].t, lessonNumber };
}
