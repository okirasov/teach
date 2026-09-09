import type { ContentService, PreparedLesson, SubjectDraft } from '@/content';
import type { LessonRecord } from '@/domain/types';
import { CUSTOM_ID, subjectConfig, subjectName, useProgress } from '@/store/progress';
import { useRefs } from '@/store/refs';

/**
 * Создаёт пользовательский предмет и запускает фоновую подготовку первого урока.
 * Живёт вне React: уход с экрана мастера подготовку не прерывает.
 */
export async function createSubjectAndPrepare(service: ContentService, draft: SubjectDraft): Promise<void> {
  useProgress.getState().createCustom({ topic: draft.topic, title: draft.title, focus: draft.focus, mission: draft.mission, sourceIds: draft.sourceIds, plan: draft.plan });
  const dur = subjectConfig(useProgress.getState(), CUSTOM_ID).dur;
  await guard((onStage) => service.prepareFirstLesson({ ...draft, durationMinutes: dur }, onStage));
}

/** После разбора: записи уходят на сервер, следующий урок готовится в фоне, карточка показывает этапы. */
export async function prepareNextLesson(service: ContentService, records: LessonRecord[]): Promise<void> {
  const c = useProgress.getState().custom;
  if (!c) return;
  const stamped = records.map((r) => ({ ...r, lessonNumber: r.lessonNumber ?? c.lessonNumber ?? 0 }));
  useProgress.getState().startNextLesson(stamped);
  const dur = subjectConfig(useProgress.getState(), CUSTOM_ID).dur;
  await guard((onStage) => service.prepareNextLesson(c.remoteId, (c.lessonNumber ?? 0) + 1, stamped, onStage, { durationMinutes: dur }));
}

/** При открытии урока: попросить сервер заготовить следующий. Ошибки не мешают уроку. */
export function prefetchNextLesson(service: ContentService): void {
  const c = useProgress.getState().custom;
  if (!c?.ready || !c.remoteId) return;
  service.prefetchNextLesson(c.remoteId).catch(() => {});
}

/**
 * После перезапуска приложения: подготовка шла, но опрос прервался. Записи и задача уже на сервере,
 * поэтому только ждём готовности; без remoteId (черновик не дошёл до сервера) — обычный повтор.
 */
export async function resumePrepare(service: ContentService): Promise<void> {
  const { custom, prepError } = useProgress.getState();
  if (!custom || custom.ready || prepError !== null) return;
  if (!custom.remoteId) {
    await retryPrepare(service);
    return;
  }
  await guard((onStage) => service.resumeLesson(custom.remoteId, (custom.lessonNumber ?? 0) + 1, onStage));
}

/** Повтор после сбоя: первый урок по черновику или следующий по сохранённым записям. */
export async function retryPrepare(service: ContentService): Promise<void> {
  const c = useProgress.getState().custom;
  if (!c || c.ready) return;
  useProgress.getState().setPrepStage(0);
  if ((c.lessonNumber ?? 0) > 0 && c.pendingRecords) {
    await guard((onStage) => service.prepareNextLesson(c.remoteId, (c.lessonNumber ?? 0) + 1, c.pendingRecords!, onStage, { durationMinutes: subjectConfig(useProgress.getState(), CUSTOM_ID).dur }));
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
  cur.setCustomReady(result.lesson, result.remoteId, result.planStage);
  // Справочники предмета — сжатая суть уроков, приходят вместе с уроком и живут офлайн.
  if (result.references?.length) await useRefs.getState().replaceForSubject(CUSTOM_ID, subjectName(cur, CUSTOM_ID), result.references);
}
