import type { Lesson, LessonStep } from '@/domain/types';

/**
 * Стартовая диагностика: настоящая проверка по источнику идёт без подготовки — она измеряет границу,
 * а не учит. Такой шаг помечается «СТАРТ», а его результат в разборе — «точка отсчёта», не ошибка.
 * Калибровка (correct = -1) и свободный рассказ (пустой answer) проверками не считаются.
 */
export function isBaselineCheck(lesson: Pick<Lesson, 'diagnostic'>, step: LessonStep): boolean {
  if (!lesson.diagnostic) return false;
  switch (step.type) {
    case 'choice': return step.correct >= 0;
    case 'input': return step.tokens.length > 0;
    case 'order': return true;
    default: return false;
  }
}
