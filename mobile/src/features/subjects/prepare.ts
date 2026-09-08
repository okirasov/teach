import type { ContentService, SubjectDraft } from '@/content';
import { CUSTOM_ID, useProgress } from '@/store/progress';

/**
 * Создаёт пользовательский предмет и запускает фоновую подготовку первого урока.
 * Живёт вне React: уход с экрана мастера подготовку не прерывает.
 */
export async function createSubjectAndPrepare(service: ContentService, draft: SubjectDraft): Promise<void> {
  const st = useProgress.getState();
  st.createCustom({ topic: draft.topic, focus: draft.focus, mission: draft.mission });
  const lesson = await service.prepareFirstLesson(draft, (stage) => useProgress.getState().setPrepStage(stage));
  const cur = useProgress.getState();
  // Предмет могли удалить, пока урок готовился.
  if (!cur.custom || cur.removed[CUSTOM_ID]) return;
  cur.setCustomReady(lesson);
}
