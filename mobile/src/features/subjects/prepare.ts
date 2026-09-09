import type { ContentService, SubjectDraft } from '@/content';
import type { LessonRecord } from '@/domain/types';
import { CUSTOM_ID, useProgress } from '@/store/progress';

/**
 * Создаёт пользовательский предмет и запускает фоновую подготовку первого урока.
 * Живёт вне React: уход с экрана мастера подготовку не прерывает.
 */
export async function createSubjectAndPrepare(service: ContentService, draft: SubjectDraft): Promise<void> {
  useProgress.getState().createCustom({ topic: draft.topic, focus: draft.focus, mission: draft.mission, sourceIds: draft.sourceIds });
  await guard(async (onStage) => {
    const r = await service.prepareFirstLesson(draft, onStage);
    return { lesson: r.lesson, remoteId: r.remoteId };
  });
}

/** После разбора: записи уходят на сервер, следующий урок готовится в фоне, карточка показывает этапы. */
export async function prepareNextLesson(service: ContentService, records: LessonRecord[]): Promise<void> {
  const c = useProgress.getState().custom;
  if (!c) return;
  useProgress.getState().startNextLesson(records);
  await guard(async (onStage) => ({ lesson: await service.prepareNextLesson(c.remoteId, (c.lessonNumber ?? 0) + 1, records, onStage) }));
}

/** Повтор после сбоя: первый урок по черновику или следующий по сохранённым записям. */
export async function retryPrepare(service: ContentService): Promise<void> {
  const c = useProgress.getState().custom;
  if (!c || c.ready) return;
  useProgress.getState().setPrepStage(0);
  if ((c.lessonNumber ?? 0) > 0 && c.pendingRecords) {
    await guard(async (onStage) => ({ lesson: await service.prepareNextLesson(c.remoteId, (c.lessonNumber ?? 0) + 1, c.pendingRecords!, onStage) }));
    return;
  }
  await guard(async (onStage) => {
    const r = await service.prepareFirstLesson({ topic: c.topic, focus: c.focus, mission: c.mission, sourceIds: c.sourceIds ?? [] }, onStage);
    return { lesson: r.lesson, remoteId: r.remoteId };
  });
}

async function guard(run: (onStage: (stage: number) => void) => Promise<{ lesson: import('@/domain/types').Lesson; remoteId?: string }>): Promise<void> {
  let result;
  try {
    result = await run((stage) => useProgress.getState().setPrepStage(stage));
  } catch (e) {
    // Сеть никогда не блокирует: предмет остаётся, карточка предлагает повторить.
    useProgress.getState().setPrepError(e instanceof Error ? e.message : String(e));
    return;
  }
  const cur = useProgress.getState();
  // Предмет могли удалить, пока урок готовился.
  if (!cur.custom || cur.removed[CUSTOM_ID]) return;
  cur.setCustomReady(result.lesson, result.remoteId);
}
