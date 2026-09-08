import { useProgress } from '@/store/progress';
import { useRefs } from '@/store/refs';
import { useReviews } from '@/store/reviews';

/** Удаляет предмет вместе с записями, очередью повторов и справочниками (DESIGN.md §4.10). */
export async function deleteSubject(id: string): Promise<void> {
  useProgress.getState().removeSubject(id);
  await Promise.all([useReviews.getState().removeSubject(id), useRefs.getState().removeSubject(id)]);
}
