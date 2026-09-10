import { useMemo } from 'react';

import { useT } from '@/i18n';
import { getLesson, useProgress } from '@/store/progress';
import { useReviews } from '@/store/reviews';
import { useSettings } from '@/store/settings';
import { buildReviewLesson, type ReviewLessonPlan } from './buildReviewLesson';
import { dueToday } from './queue';

/** Урок повторов из карточек, срок которых наступил, с учётом глобального лимита. */
export function useReviewPlan(): ReviewLessonPlan {
  const t = useT();
  const cards = useReviews((s) => s.cards);
  const subjects = useProgress((s) => s.subjects);
  const lessons = useProgress((s) => s.lessons);
  const cap = useSettings((s) => s.cap);
  return useMemo(() => {
    const due = dueToday(cards, new Date());
    const resolve = (subjectId: string, step: number) => getLesson({ subjects, lessons }, subjectId, t.reviewName)?.steps[step] ?? null;
    return buildReviewLesson(due, resolve, t.reviewName, cap);
  }, [cards, subjects, lessons, cap, t]);
}
