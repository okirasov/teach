import { currentDemoLesson, demoHasNext, useProgress } from '@/store/progress';
import { useRefs } from '@/store/refs';

/**
 * Демо переходит к следующему статичному уроку: урок открывается сразу, а глоссарий демо
 * пополняется терминами нового урока — как у настоящего предмета после разбора.
 */
export async function goToNextDemoLesson(id: string): Promise<boolean> {
  if (!demoHasNext(useProgress.getState(), id)) return false;
  useProgress.getState().advanceDemo(id);
  const next = currentDemoLesson(useProgress.getState(), id);
  if (next?.references.length) await useRefs.getState().replaceForSubject(id, next.lesson.name, next.references);
  return true;
}
