import type { Card as FsrsCard } from 'ts-fsrs';

import type { PracticeStep } from './types';

/** Откуда взялся вопрос карточки: шаг урока, который можно задать снова. */
export interface StepRef {
  subjectId: string;
  step: number;
  /** Номер урока, из которого шаг. У старых карточек его нет — шаг ищется в текущем уроке предмета. */
  lessonNumber?: number;
  /** Сам вопрос на момент записи: повтор задаёт именно его, даже когда предмет ушёл к следующим урокам. */
  snapshot?: PracticeStep;
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
