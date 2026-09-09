import { useMemo } from 'react';

import { seedLessons } from '@/domain/seed';
import { useT } from '@/i18n';
import { activeSubjectIds, CUSTOM_ID, useProgress } from '@/store/progress';
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
          name: custom.topic,
          level: custom.focus ? `${t.stage1} · ${custom.focus}` : t.stage1,
          lessonTitle: custom.ready ? customLesson?.lessonTitle ?? t.diag : (custom.lessonNumber ?? 0) > 0 ? t.preparing : t.bgLesson,
          done: !!done[id],
          prepStage: custom.ready ? undefined : prepStage,
          prepFailed: !custom.ready && prepError !== null,
        };
      }
      const l = seedLessons[id];
      return { id, name: l.name, level: l.level, lessonTitle: l.lessonTitle ?? '', done: !!done[id], demo: true };
    });
  }, [t, done, removed, custom, prepStage, prepError, customLesson]);
}
