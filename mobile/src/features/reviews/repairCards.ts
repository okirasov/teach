import type { ContentService } from '@/content';
import type { ReviewCard, StepRef } from '@/domain/reviewCard';
import type { Lesson } from '@/domain/types';
import { demoLessons } from '@/domain/seed';
import { useProgress } from '@/store/progress';
import { useReviews } from '@/store/reviews';

/** Предметы, которые уже чинились в этом запуске: без совпадений сервер повторно не спрашиваем. */
const attempted = new Set<string>();

/** Для тестов: забыть, какие предметы уже чинились. */
export function forgetRepairAttempts(): void {
  attempted.clear();
}

/**
 * Старые карточки повторов своих предметов ссылались только на номер шага, и повтор задавал вопрос
 * из текущего урока. Сервер хранит все уроки предмета: по заголовку записи находим урок каждой такой
 * карточки и сохраняем номер урока и сам вопрос. Уроки перебираем с новых: старый код переписывал
 * заголовок карточки заголовком последнего урока с тем же номером шага. Карточку без совпадения не трогаем.
 * Демо не чиним: их старые карточки все из первого урока цепочки и находятся правильно.
 */
export async function repairLegacyCards(service: ContentService): Promise<number> {
  const { subjects } = useProgress.getState();
  const bySubject = new Map<string, ReviewCard[]>();
  for (const c of useReviews.getState().cards) {
    if (!c.ref || c.ref.lessonNumber !== undefined || c.ref.snapshot || demoLessons[c.subjectId]) continue;
    if (!subjects[c.subjectId]?.remoteId || attempted.has(c.subjectId)) continue;
    bySubject.set(c.subjectId, [...(bySubject.get(c.subjectId) ?? []), c]);
  }
  const updates: { cardId: string; ref: StepRef }[] = [];
  for (const [subjectId, cards] of bySubject) {
    attempted.add(subjectId);
    let history: { number: number; lesson: Lesson }[];
    try {
      history = await service.lessonHistory(subjects[subjectId].remoteId!);
    } catch {
      // Нет сети — попробуем в следующий раз.
      attempted.delete(subjectId);
      continue;
    }
    const newestFirst = [...history].sort((a, b) => b.number - a.number);
    for (const c of cards) {
      const ref = c.ref!;
      for (const h of newestFirst) {
        const st = h.lesson.steps[ref.step];
        if (st && st.type !== 'explain' && st.recTitle === c.title) {
          updates.push({ cardId: c.id, ref: { ...ref, lessonNumber: h.number, snapshot: st } });
          break;
        }
      }
    }
  }
  await useReviews.getState().repairRefs(updates);
  return updates.length;
}
