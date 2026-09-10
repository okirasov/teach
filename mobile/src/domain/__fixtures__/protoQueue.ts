import { schedule, emptyCard } from '@/domain/fsrs';
import type { ReviewCard } from '@/domain/reviewCard';
import { protoLessons as seedLessons } from './protoLessons';

function daysAgo(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Очередь прототипа: 3 карточки на сегодня, 2 позже (DESIGN.md §4.5).
 * Создаётся один раз в пустой БД, чтобы первый запуск совпадал с макетом.
 */
export function prototypeQueue(now: Date): ReviewCard[] {
  const make = (
    id: string,
    subjectId: string,
    step: number,
    title: string,
    note: string,
    /** Сколько дней назад была отвечена карточка и с каким результатом → определяет срок. */
    reviewedDaysAgo: number,
    ok: boolean,
  ): ReviewCard => {
    const lesson = seedLessons[subjectId];
    const explain = lesson.steps.find((s) => s.type === 'explain');
    const when = daysAgo(now, reviewedDaysAgo);
    const { card } = schedule(emptyCard(when), ok, when);
    return {
      id,
      subjectId,
      subjectName: lesson.name,
      title,
      note,
      source: explain?.type === 'explain' ? explain.source.split(' · ')[0] : '',
      ref: { subjectId, step },
      createdAt: when.getTime(),
      fsrs: card,
    };
  };
  return [
    // сегодня: ошибка день назад → срок сегодня
    make('seed-en-1', 'en', 1, 'После if не бывает would', 'Рука тянется к would have — типичная калька с русского «если бы».', 1, false),
    make('seed-qa-1', 'qa', 1, 'Граница — это две точки, не одна', 'Соблазн взять «1, 50, 100» — середина создаёт иллюзию покрытия.', 1, false),
    make('seed-hist-1', 'hist', 1, 'Раздел 395 был раньше разграбления 410', 'Путаются 395 и 410 — раздел был раньше разграбления.', 1, false),
    // позже: успех 2 дня назад → через 1 день; успех сегодня → через 3 дня
    make('seed-en-2', 'en', 2, 'Рамка совета If I were you…', 'Вспомнить формулу целиком, без опоры на текст.', 2, true),
    make('seed-qa-2', 'qa', 2, 'Пары точек на краях диапазона', 'Назвать все четыре длины по памяти для нового диапазона.', 0, true),
  ];
}
