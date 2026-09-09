import type { ContentService, PreparedLesson, SubjectDraft } from '@/content';
import type { LessonRecord } from '@/domain/types';
import { CUSTOM_ID, subjectName, useProgress } from '@/store/progress';
import { useRefs } from '@/store/refs';

/**
 * Создаёт пользовательский предмет и запускает фоновую подготовку первого урока.
 * Живёт вне React: уход с экрана мастера подготовку не прерывает.
 */
export async function createSubjectAndPrepare(service: ContentService, draft: SubjectDraft): Promise<void> {
  useProgress.getState().createCustom({ topic: draft.topic, title: draft.title, focus: draft.focus, mission: draft.mission, sourceIds: draft.sourceIds, plan: draft.plan });
  await guard((onStage) => service.prepareFirstLesson(draft, onStage));
}

/** После разбора: записи уходят на сервер, следующий урок готовится в фоне, карточка показывает этапы. */
export async function prepareNextLesson(service: ContentService, records: LessonRecord[]): Promise<void> {
  const c = useProgress.getState().custom;
  if (!c) return;
  useProgress.getState().startNextLesson(records);
  await guard((onStage) => service.prepareNextLesson(c.remoteId, (c.lessonNumber ?? 0) + 1, records, onStage));
}

/** Повтор после сбоя: первый урок по черновику или следующий по сохранённым записям. */
export async function retryPrepare(service: ContentService): Promise<void> {
  const c = useProgress.getState().custom;
  if (!c || c.ready) return;
  useProgress.getState().setPrepStage(0);
  if ((c.lessonNumber ?? 0) > 0 && c.pendingRecords) {
    await guard((onStage) => service.prepareNextLesson(c.remoteId, (c.lessonNumber ?? 0) + 1, c.pendingRecords!, onStage));
    return;
  }
  await guard((onStage) => service.prepareFirstLesson({ topic: c.topic, title: c.title, focus: c.focus, mission: c.mission, sourceIds: c.sourceIds ?? [] }, onStage));
}

async function guard(run: (onStage: (stage: number) => void) => Promise<PreparedLesson>): Promise<void> {
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
  // Справочники предмета — сжатая суть уроков, приходят вместе с уроком и живут офлайн.
  if (result.references?.length) await useRefs.getState().replaceForSubject(CUSTOM_ID, subjectName(cur, CUSTOM_ID), result.references);
}
