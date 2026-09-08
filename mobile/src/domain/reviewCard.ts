import type { Card as FsrsCard } from 'ts-fsrs';

/** Откуда взялся вопрос карточки: шаг урока, который можно задать снова. */
export interface StepRef {
  subjectId: string;
  step: number;
}

/**
 * ReviewItem из брифа §5.3: запись об усвоенном + расписание FSRS.
 * Поля FSRS хранятся как есть, чтобы алгоритм был заменяем без миграций.
 */
export interface ReviewCard {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  note: string;
  source: string;
  ref: StepRef | null;
  createdAt: number;
  fsrs: FsrsCard;
}
