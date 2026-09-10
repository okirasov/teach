import { useMemo } from 'react';

import { seedLessons, seedPlans } from '@/domain/seed';
import { useT } from '@/i18n';
import { activeSubjectIds, prepOf, useProgress } from '@/store/progress';
import { planProgress } from '@/features/subjects/plan';
import type { SubjectCardModel } from './SubjectCard';

/** Карточки предметов для «Сегодня»: сид-предметы + пользовательский (с фоновой подготовкой). */
export function useTodaySubjects(): SubjectCardModel[] {
  const t = useT();
  const done = useProgress((s) => s.done);
  const removed = useProgress((s) => s.removed);
  const subjects = useProgress((s) => s.subjects);
  const lessons = useProgress((s) => s.lessons);
  const prepStages = useProgress((s) => s.prepStages);
  const prepErrors = useProgress((s) => s.prepErrors);

  return useMemo(() => {
    return activeSubjectIds({ removed, subjects }).map((id): SubjectCardModel => {
      const sub = subjects[id];
      if (sub) {
        const p = prepOf({ prepStages, prepErrors }, id);
        return {
          id,
          name: sub.title ?? sub.topic,
          // Этап показывает индикатор плана ниже; справа — только фокус.
          level: sub.focus || t.stage1,
          lessonTitle: sub.ready ? lessons[id]?.lessonTitle ?? t.diag : (sub.lessonNumber ?? 0) > 0 ? t.preparing : t.bgLesson,
          done: !!done[id],
          prepStage: sub.ready ? undefined : p.stage,
          nextLesson: !sub.ready && (sub.lessonNumber ?? 0) > 0 ? (sub.lessonNumber ?? 0) + 1 : undefined,
          prepFailed: !sub.ready && p.error !== null,
          plan: sub.ready ? planProgress(sub.plan, sub.lessonNumber ?? 0, sub.planStage) : undefined,
        };
      }
      const l = seedLessons[id];
      // Демо: урок 2 первого этапа плана на пять этапов, как у настоящего предмета после диагностики.
      return { id, name: l.name, level: l.level, lessonTitle: l.lessonTitle ?? '', done: !!done[id], demo: true, plan: planProgress(seedPlans[id], 2, 0) };
    });
  }, [t, done, removed, subjects, lessons, prepStages, prepErrors]);
}
