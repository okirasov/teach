import type { ContentService, PreparedLesson, SubjectDraft } from '@/content';
import type { LessonRecord, SubjectId } from '@/domain/types';
import { prepOf, subjectConfig, subjectName, useProgress } from '@/store/progress';
import { useRefs } from '@/store/refs';

/**
 * Предметы, подготовка которых уже идёт. Без этого повтор и возобновление могут запустить
 * вторую генерацию того же предмета: она перезапишет урок первой и потратит вызов модели.
 */
const inFlight = new Set<SubjectId>();

/**
 * Создаёт пользовательский предмет и запускает фоновую подготовку первого урока.
 * Живёт вне React: уход с экрана мастера подготовку не прерывает. Предметов может быть
 * несколько, и готовиться они могут одновременно — состояние подготовки хранится по id.
 */
export async function createSubjectAndPrepare(service: ContentService, draft: SubjectDraft): Promise<SubjectId> {
  const id = useProgress.getState().createSubject({
    topic: draft.topic, title: draft.title, focus: draft.focus, mission: draft.mission, sourceIds: draft.sourceIds, plan: draft.plan,
  });
  const dur = subjectConfig(useProgress.getState(), id).dur;
  await guard(id, (onStage) => service.prepareFirstLesson({ ...draft, durationMinutes: dur }, onStage));
  return id;
}

/** После разбора: записи уходят на сервер, следующий урок готовится в фоне, карточка показывает этапы. */
export async function prepareNextLesson(service: ContentService, id: SubjectId, records: LessonRecord[]): Promise<void> {
  const c = useProgress.getState().subjects[id];
  if (!c) return;
  const stamped = records.map((r) => ({ ...r, lessonNumber: r.lessonNumber ?? c.lessonNumber ?? 0 }));
  useProgress.getState().startNextLesson(id, stamped);
  const dur = subjectConfig(useProgress.getState(), id).dur;
  await guard(id, (onStage) => service.prepareNextLesson(c.remoteId, (c.lessonNumber ?? 0) + 1, stamped, onStage, { durationMinutes: dur }));
}

/** При открытии урока: попросить сервер заготовить следующий. Ошибки не мешают уроку. */
export function prefetchNextLesson(service: ContentService, id: SubjectId): void {
  const c = useProgress.getState().subjects[id];
  if (!c?.ready || !c.remoteId) return;
  service.prefetchNextLesson(c.remoteId).catch(() => {});
}

/**
 * После перезапуска приложения: подготовка шла, но опрос прервался. Записи и задача уже на сервере,
 * поэтому только ждём готовности; без remoteId (черновик не дошёл до сервера) — обычный повтор.
 * Проверяет все предметы: прерваться могла подготовка любого из них.
 */
export async function resumePrepare(service: ContentService): Promise<void> {
  const st = useProgress.getState();
  const pending = Object.keys(st.subjects).filter(
    (id) => !st.removed[id] && !st.subjects[id].ready && prepOf(st, id).error === null && !inFlight.has(id),
  );
  await Promise.all(
    pending.map((id) => {
      const c = st.subjects[id];
      if (!c.remoteId) return retryPrepare(service, id);
      return guard(id, (onStage) => service.resumeLesson(c.remoteId, (c.lessonNumber ?? 0) + 1, onStage));
    }),
  );
}

/** Повтор после сбоя: первый урок по черновику или следующий по сохранённым записям. */
export async function retryPrepare(service: ContentService, id: SubjectId): Promise<void> {
  const c = useProgress.getState().subjects[id];
  if (!c || c.ready) return;
  useProgress.getState().setPrepStage(id, 0);
  if ((c.lessonNumber ?? 0) > 0 && c.pendingRecords) {
    const dur = subjectConfig(useProgress.getState(), id).dur;
    await guard(id, (onStage) => service.prepareNextLesson(c.remoteId, (c.lessonNumber ?? 0) + 1, c.pendingRecords!, onStage, { durationMinutes: dur }));
    return;
  }
  await guard(id, (onStage) => service.prepareFirstLesson({ topic: c.topic, title: c.title, focus: c.focus, mission: c.mission, sourceIds: c.sourceIds ?? [] }, onStage));
}

async function guard(id: SubjectId, run: (onStage: (stage: number) => void) => Promise<PreparedLesson>): Promise<void> {
  // Вторую генерацию того же предмета не запускаем: она перезаписала бы урок первой.
  if (inFlight.has(id)) return;
  inFlight.add(id);
  let result;
  try {
    result = await run((stage) => useProgress.getState().setPrepStage(id, stage));
  } catch (e) {
    // Сеть никогда не блокирует: предмет остаётся, карточка предлагает повторить.
    useProgress.getState().setPrepError(id, e instanceof Error ? e.message : String(e));
    return;
  } finally {
    inFlight.delete(id);
  }
  const cur = useProgress.getState();
  // Предмет могли удалить, пока урок готовился.
  if (!cur.subjects[id] || cur.removed[id]) return;
  cur.setSubjectReady(id, result.lesson, result.remoteId, result.planStage);
  // Справочники предмета — сжатая суть уроков, приходят вместе с уроком и живут офлайн.
  if (result.references?.length) await useRefs.getState().replaceForSubject(id, subjectName(cur, id), result.references);
}
