import type { ReviewCard } from '@/domain/reviewCard';
import type { Lesson, LessonStep, PracticeStep } from '@/domain/types';

export interface ReviewLessonPlan {
  lesson: Lesson;
  /** id карточки на каждый шаг урока (все шаги — практика). */
  cardIds: string[];
}

/**
 * Урок повторов: вопросы тех шагов, из которых родились карточки.
 * Карточки без разрешимой ссылки пропускаются. cap — потолок на день (0 — без лимита).
 */
export function buildReviewLesson(
  cards: ReviewCard[],
  resolveStep: (subjectId: string, step: number) => LessonStep | null,
  name: string,
  cap: number,
): ReviewLessonPlan {
  const steps: PracticeStep[] = [];
  const cardIds: string[] = [];
  for (const c of cards) {
    if (cap > 0 && steps.length >= cap) break;
    if (!c.ref) continue;
    const st = resolveStep(c.ref.subjectId, c.ref.step);
    if (!st || st.type === 'explain') continue;
    steps.push(st);
    cardIds.push(c.id);
  }
  return { lesson: { name, level: '', steps }, cardIds };
}
