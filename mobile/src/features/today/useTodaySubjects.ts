import { useMemo } from 'react';

import { seedLessons, seedPlans } from '@/domain/seed';
import { useT } from '@/i18n';
import { activeSubjectIds, CUSTOM_ID, useProgress } from '@/store/progress';
import { planProgress } from '@/features/subjects/plan';
import type { SubjectCardModel } from './SubjectCard';

/** Карточки предметов для «Сегодня»: сид-предметы + пользовательский (с фоновой подготовкой). */
export function useTodaySubjects(): SubjectCardModel[] {
  const t = useT();
  const done = useProgress((s) => s.done);
  const removed = useProgress((s) => s.removed);
  const custom = useProgress((s) => s.custom);
  const prepStage = useProgress((s) => s.prepStage);
  const prepError = useProgress((s) => s.prepError);
  const customLesson = useProgress((s) => s.customLesson);

  return useMemo(() => {
    return activeSubjectIds({ removed, custom }).map((id): SubjectCardModel => {
      if (id === CUSTOM_ID && custom) {
        return {
          id,
          name: custom.title ?? custom.topic,
          // Этап показывает индикатор плана ниже; справа — только фокус.
          level: custom.focus || t.stage1,
          lessonTitle: custom.ready ? customLesson?.lessonTitle ?? t.diag : (custom.lessonNumber ?? 0) > 0 ? t.preparing : t.bgLesson,
          done: !!done[id],
          prepStage: custom.ready ? undefined : prepStage,
          nextLesson: !custom.ready && (custom.lessonNumber ?? 0) > 0 ? (custom.lessonNumber ?? 0) + 1 : undefined,
          prepFailed: !custom.ready && prepError !== null,
          plan: custom.ready ? planProgress(custom.plan, custom.lessonNumber ?? 0, custom.planStage) : undefined,
        };
      }
      const l = seedLessons[id];
      // Демо: урок 2 первого этапа плана на пять этапов, как у настоящего предмета после диагностики.
      return { id, name: l.name, level: l.level, lessonTitle: l.lessonTitle ?? '', done: !!done[id], demo: true, plan: planProgress(seedPlans[id], 2, 0) };
    });
  }, [t, done, removed, custom, prepStage, prepError, customLesson]);
}
