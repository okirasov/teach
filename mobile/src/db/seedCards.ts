import { emptyCard, schedule } from '@/domain/fsrs';
import type { ReviewCard } from '@/domain/reviewCard';
import { seedLessons } from '@/domain/seed';

function daysAgo(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Карточки демо-предметов: по одной «на сегодня» (ошибка день назад) и одной «позже» (успех два дня назад)
 * на каждый демо-урок, чтобы первый запуск показывал очередь повторов. Сеются один раз на аккаунт.
 */
export function demoQueue(now: Date): ReviewCard[] {
  const make = (id: string, subjectId: string, step: number, reviewedDaysAgo: number, ok: boolean): ReviewCard | null => {
    const lesson = seedLessons[subjectId];
    const st = lesson?.steps[step];
    if (!st || st.type === 'explain') return null;
    const explain = lesson.steps.find((s) => s.type === 'explain');
    const when = daysAgo(now, reviewedDaysAgo);
    const { card } = schedule(emptyCard(when), ok, when);
    return {
      id,
      subjectId,
      subjectName: lesson.name,
      title: st.recTitle,
      note: st.recNote,
      source: explain?.type === 'explain' ? explain.source.split(' · ')[0] : '',
      ref: { subjectId, step },
      createdAt: when.getTime(),
      fsrs: card,
    };
  };
  return [make('demo-en-1', 'en', 2, 1, false), make('demo-speak-1', 'speak', 1, 1, false), make('demo-en-2', 'en', 3, 2, true), make('demo-speak-2', 'speak', 3, 2, true)].filter(
    (c): c is ReviewCard => c !== null,
  );
}
