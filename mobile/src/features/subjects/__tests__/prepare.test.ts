import { createLocalContentService } from '@/content/local';
import { memoryRefsRepo } from '@/db/refsRepo';
import { PREP_STAGES, prepOf, useProgress, userSubjectIds } from '@/store/progress';
import { useRefs } from '@/store/refs';
import { createSubjectAndPrepare, prefetchNextLesson, prepareNextLesson, resumePrepare, retryPrepare } from '../prepare';

const initial = useProgress.getInitialState();
const refsInitial = useRefs.getInitialState();
beforeEach(async () => {
  useProgress.setState(initial, true);
  useRefs.setState(refsInitial, true);
  await useRefs.getState().attach(memoryRefsRepo());
});

const draft = { topic: 'SQL', focus: 'Основы и синтаксис', mission: 'писать отчёты', sourceIds: ['src-0'] };
const svc = () => createLocalContentService({ stageMs: 5 });
const sub = (id: string) => useProgress.getState().subjects[id];
const patchSubject = (id: string, patch: Record<string, unknown>) =>
  useProgress.setState((st) => ({ subjects: { ...st.subjects, [id]: { ...st.subjects[id], ...patch } } }));

describe('createSubjectAndPrepare', () => {
  it('creates the subject as «preparing» and flips it to ready with the generated lesson', async () => {
    const p = createSubjectAndPrepare(svc(), draft);
    const id = await p;
    expect(id).toBe('s1');
    expect(sub(id)).toMatchObject({ topic: 'SQL' });
    const after = useProgress.getState();
    expect(after.subjects[id].ready).toBe(true);
    expect(prepOf(after, id).stage).toBe(PREP_STAGES);
    expect(after.lessons[id]?.name).toBe('SQL');
    expect(after.missions[id].cur).toBe('писать отчёты');
  });

  it('does not resurrect a subject deleted while preparing', async () => {
    const p = createSubjectAndPrepare(svc(), draft);
    const id = userSubjectIds(useProgress.getState())[0];
    useProgress.getState().removeSubject(id);
    await p;
    expect(sub(id)).toBeUndefined();
    expect(useProgress.getState().lessons[id]).toBeUndefined();
  });

  it('a failing service leaves the subject in place with prepError; retry can finish it', async () => {
    const failing = { ...svc(), prepareFirstLesson: async () => { throw new Error('offline'); } };
    const id = await createSubjectAndPrepare(failing, draft);
    expect(sub(id)).toMatchObject({ topic: 'SQL', ready: false, sourceIds: ['src-0'] });
    expect(prepOf(useProgress.getState(), id).error).toBe('offline');

    await retryPrepare(svc(), id);
    expect(prepOf(useProgress.getState(), id).error).toBeNull();
    expect(sub(id).ready).toBe(true);
  });

  it('after a recap the next lesson is prepared and replaces the current one; done resets', async () => {
    const s1 = svc();
    const id = await createSubjectAndPrepare(s1, draft);
    useProgress.getState().markDone(id, [{ t: 'a', s: 'SQL' }]);
    expect(sub(id)).toMatchObject({ ready: true, lessonNumber: 1, language: null });

    const p = prepareNextLesson(s1, id, [{ title: 'Стартовая уверенность', note: '', ok: true, stepIndex: 1 }, { title: 'Карта того, что уже есть', note: '', ok: false, stepIndex: 2 }]);
    expect(sub(id).ready).toBe(false);
    await p;
    const st = useProgress.getState();
    expect(st.subjects[id]).toMatchObject({ ready: true, lessonNumber: 2 });
    expect(st.lessons[id]?.lessonTitle).toBe('Урок 2 · Каркас темы');
    expect(st.done[id]).toBe(false);
  });

  it('language is detected at creation', async () => {
    const id = await createSubjectAndPrepare(svc(), { ...draft, topic: 'Итальянский язык с самого начала' });
    expect(sub(id).language).toMatchObject({ code: 'it-IT', en: 'Italian' });
  });

  it('stores the subject title and the glossary reference that came with the lesson', async () => {
    const id = await createSubjectAndPrepare(svc(), { ...draft, title: 'SQL' });
    expect(sub(id).title).toBe('SQL');
    const refs = useRefs.getState().refs.filter((r) => r.subjectId === id);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ subjectName: 'SQL', group: 'Глоссарий', updatedAfter: 1 });
    expect(refs[0].rows.length).toBeGreaterThan(0);

    await prepareNextLesson(svc(), id, [{ title: 'Стартовая уверенность', note: '', ok: false, stepIndex: 1 }]);
    const after = useRefs.getState().refs.filter((r) => r.subjectId === id);
    expect(after).toHaveLength(1);
    expect(after[0].updatedAfter).toBe(2);
  });

  it('prefetch asks the service only for a ready remote subject and swallows errors', async () => {
    const s1 = svc();
    const spy = jest.spyOn(s1, 'prefetchNextLesson').mockRejectedValue(new Error('offline'));
    prefetchNextLesson(s1, 's1');
    expect(spy).not.toHaveBeenCalled(); // предмета нет
    const id = await createSubjectAndPrepare(s1, draft);
    patchSubject(id, { remoteId: 'r1' });
    prefetchNextLesson(s1, id);
    expect(spy).toHaveBeenCalledWith('r1');
    await new Promise((r) => setTimeout(r, 0));
    expect(prepOf(useProgress.getState(), id).error).toBeNull();
  });

  it('resume after a restart waits for the server lesson without re-sending the recap', async () => {
    const s1 = svc();
    const id = await createSubjectAndPrepare(s1, draft);
    // Приложение закрыли посреди подготовки урока 2: ready=false, записи уже ушли.
    patchSubject(id, { ready: false, remoteId: 'r1', pendingRecords: [] });
    useProgress.getState().setPrepStage(id, 1);
    const next = jest.spyOn(s1, 'prepareNextLesson');
    await resumePrepare(s1);
    expect(next).not.toHaveBeenCalled();
    expect(sub(id)).toMatchObject({ ready: true, lessonNumber: 2 });
    // Готовый предмет и предмет с ошибкой не трогаем.
    const resume = jest.spyOn(s1, 'resumeLesson');
    await resumePrepare(s1);
    patchSubject(id, { ready: false });
    useProgress.getState().setPrepError(id, 'boom');
    await resumePrepare(s1);
    expect(resume).not.toHaveBeenCalled();
  });
});

describe('несколько предметов', () => {
  it('второй предмет не затирает первый: свои id, уроки, миссии и справочники', async () => {
    const first = await createSubjectAndPrepare(svc(), draft);
    const second = await createSubjectAndPrepare(svc(), { topic: 'Итальянский', focus: 'Фразы', mission: 'кафе', sourceIds: ['src-0'] });
    expect(second).not.toBe(first);
    expect(userSubjectIds(useProgress.getState())).toEqual([first, second]);

    const st = useProgress.getState();
    expect(st.subjects[first].topic).toBe('SQL');
    expect(st.subjects[second].topic).toBe('Итальянский');
    expect(st.missions[first].cur).toBe('писать отчёты');
    expect(st.missions[second].cur).toBe('кафе');
    expect(st.lessons[first]?.name).toBe('SQL');
    expect(st.lessons[second]?.name).toBe('Итальянский');
    expect(useRefs.getState().refs.filter((r) => r.subjectId === first)).toHaveLength(1);
    expect(useRefs.getState().refs.filter((r) => r.subjectId === second)).toHaveLength(1);
  });

  it('подготовка и ошибки у предметов независимы', async () => {
    const ok = await createSubjectAndPrepare(svc(), draft);
    const failing = { ...svc(), prepareFirstLesson: async () => { throw new Error('offline'); } };
    const bad = await createSubjectAndPrepare(failing, { topic: 'Итальянский', focus: 'Фразы', mission: 'кафе', sourceIds: [] });

    const st = useProgress.getState();
    expect(prepOf(st, ok).error).toBeNull();
    expect(prepOf(st, ok).stage).toBe(PREP_STAGES);
    expect(prepOf(st, bad).error).toBe('offline');
    expect(st.subjects[ok].ready).toBe(true);
    expect(st.subjects[bad].ready).toBe(false);

    // Повтор одного не трогает другой.
    await retryPrepare(svc(), bad);
    expect(useProgress.getState().subjects[bad].ready).toBe(true);
    expect(useProgress.getState().subjects[ok].ready).toBe(true);
  });

  it('удаление одного предмета оставляет второй нетронутым', async () => {
    const first = await createSubjectAndPrepare(svc(), draft);
    const second = await createSubjectAndPrepare(svc(), { topic: 'Итальянский', focus: 'Фразы', mission: 'кафе', sourceIds: [] });
    useProgress.getState().removeSubject(first);
    const st = useProgress.getState();
    expect(st.subjects[first]).toBeUndefined();
    expect(st.lessons[first]).toBeUndefined();
    expect(st.subjects[second].topic).toBe('Итальянский');
    expect(st.lessons[second]).toBeDefined();
    expect(userSubjectIds(st)).toEqual([second]);
  });

  it('resume поднимает обе прерванные подготовки', async () => {
    const s1 = svc();
    const a = await createSubjectAndPrepare(s1, draft);
    const b = await createSubjectAndPrepare(s1, { topic: 'Итальянский', focus: 'Фразы', mission: 'кафе', sourceIds: [] });
    patchSubject(a, { ready: false, remoteId: 'ra', pendingRecords: [] });
    patchSubject(b, { ready: false, remoteId: 'rb', pendingRecords: [] });
    await resumePrepare(s1);
    expect(useProgress.getState().subjects[a].ready).toBe(true);
    expect(useProgress.getState().subjects[b].ready).toBe(true);
  });
});

describe('повтор после сбоя первого урока', () => {
  it('не создаёт второй предмет на сервере, а дожидается уже начатой генерации', async () => {
    // Сервер принял черновик (id известен), но опрос урока сорвался.
    const failing = {
      ...svc(),
      prepareFirstLesson: async (_d: unknown, _s: unknown, onCreated?: (r: string) => void) => {
        onCreated?.('r-42');
        throw new Error('offline');
      },
    } as unknown as ReturnType<typeof svc>;
    const id = await createSubjectAndPrepare(failing, draft);
    expect(sub(id).remoteId).toBe('r-42');
    expect(prepOf(useProgress.getState(), id).error).toBe('offline');

    const good = svc();
    const first = jest.spyOn(good, 'prepareFirstLesson');
    const resume = jest.spyOn(good, 'resumeLesson');
    await retryPrepare(good, id);
    // Второй предмет не создаём: ждём урок уже созданного.
    expect(first).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledWith('r-42', 1, expect.any(Function));
    expect(sub(id).ready).toBe(true);
  });

  it('без id на сервере повтор создаёт предмет заново', async () => {
    const failing = { ...svc(), prepareFirstLesson: async () => { throw new Error('offline'); } };
    const id = await createSubjectAndPrepare(failing, draft);
    expect(sub(id).remoteId).toBeUndefined();
    const good = svc();
    const first = jest.spyOn(good, 'prepareFirstLesson');
    await retryPrepare(good, id);
    expect(first).toHaveBeenCalled();
    expect(sub(id).ready).toBe(true);
  });
});

describe('одновременные подготовки', () => {
  it('ошибка подготовки удалённого предмета никуда не пишется', async () => {
    const failing = { ...svc(), prepareFirstLesson: async () => { await new Promise((r) => setTimeout(r, 20)); throw new Error('offline'); } };
    const p = createSubjectAndPrepare(failing, draft);
    const id = userSubjectIds(useProgress.getState())[0];
    useProgress.getState().removeSubject(id);
    await p;
    expect(useProgress.getState().prepErrors[id]).toBeUndefined();
    expect(sub(id)).toBeUndefined();
  });

  it('вторая подготовка того же предмета не запускается, пока идёт первая', async () => {
    const s1 = svc();
    const id = await createSubjectAndPrepare(s1, draft);
    patchSubject(id, { ready: false, remoteId: 'r1', pendingRecords: [] });
    const spy = jest.spyOn(s1, 'resumeLesson');
    // Возобновление и повтор стартуют одновременно — модель должна быть вызвана один раз.
    await Promise.all([resumePrepare(s1), resumePrepare(s1)]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(sub(id).ready).toBe(true);
  });
});
