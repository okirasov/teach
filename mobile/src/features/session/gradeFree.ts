import type { ContentService } from '@/content';
import type { FreeStep } from '@/domain/types';

/** Сколько ждём оценку сервера, прежде чем зачесть ответ по ключевым словам. */
export const GRADE_TIMEOUT_MS = 4000;

/**
 * Оценка свободного ответа по смыслу. Сеть не задерживает урок: если сервер не ответил
 * за GRADE_TIMEOUT_MS или недоступен, возвращаем undefined — и критерии считаются
 * по ключевым словам, как офлайн.
 */
export async function gradeFreeAnswer(
  service: ContentService,
  step: FreeStep,
  text: string,
  lang: string,
  timeoutMs = GRADE_TIMEOUT_MS,
): Promise<boolean[] | undefined> {
  if (step.criteria.length === 0) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), timeoutMs);
  });
  try {
    const hits = await Promise.race([
      service.gradeFree(step.criteria, text, lang).catch(() => undefined),
      timeout,
    ]);
    return hits && hits.length === step.criteria.length ? hits : undefined;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
