import { useProgress } from '@/store/progress';
import { useReviews } from '@/store/reviews';

/** Удаляет предмет вместе с записями и очередью повторов (DESIGN.md §4.10). */
export async function deleteSubject(id: string): Promise<void> {
  useProgress.getState().removeSubject(id);
  await useReviews.getState().removeSubject(id);
}
