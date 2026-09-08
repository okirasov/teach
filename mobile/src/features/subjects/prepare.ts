import type { ContentService, SubjectDraft } from '@/content';
import { CUSTOM_ID, useProgress } from '@/store/progress';

/**
 * Создаёт пользовательский предмет и запускает фоновую подготовку первого урока.
 * Живёт вне React: уход с экрана мастера подготовку не прерывает.
 */
export async function createSubjectAndPrepare(service: ContentService, draft: SubjectDraft): Promise<void> {
  useProgress.getState().createCustom({ topic: draft.topic, focus: draft.focus, mission: draft.mission, sourceIds: draft.sourceIds });
  await prepare(service, draft);
}

/** Повторная подготовка после сбоя — по сохранённому черновику предмета. */
export async function retryPrepare(service: ContentService): Promise<void> {
  const c = useProgress.getState().custom;
  if (!c || c.ready) return;
  useProgress.getState().setPrepStage(0);
  await prepare(service, { topic: c.topic, focus: c.focus, mission: c.mission, sourceIds: c.sourceIds ?? [] });
}

async function prepare(service: ContentService, draft: SubjectDraft): Promise<void> {
  let lesson;
  try {
    lesson = await service.prepareFirstLesson(draft, (stage) => useProgress.getState().setPrepStage(stage));
  } catch (e) {
    // Голос и сеть никогда не блокируют: предмет остаётся, карточка предлагает повторить.
    useProgress.getState().setPrepError(e instanceof Error ? e.message : String(e));
    return;
  }
  const cur = useProgress.getState();
  // Предмет могли удалить, пока урок готовился.
  if (!cur.custom || cur.removed[CUSTOM_ID]) return;
  cur.setCustomReady(lesson);
}
