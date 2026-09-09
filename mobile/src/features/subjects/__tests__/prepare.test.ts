import { createLocalContentService } from '@/content/local';
import { memoryRefsRepo } from '@/db/refsRepo';
import { CUSTOM_ID, PREP_STAGES, useProgress } from '@/store/progress';
import { useRefs } from '@/store/refs';
import { createSubjectAndPrepare, prepareNextLesson, retryPrepare } from '../prepare';

const initial = useProgress.getInitialState();
const refsInitial = useRefs.getInitialState();
beforeEach(async () => {
  useProgress.setState(initial, true);
  useRefs.setState(refsInitial, true);
  await useRefs.getState().attach(memoryRefsRepo());
});

const draft = { topic: 'SQL', focus: 'Основы и синтаксис', mission: 'писать отчёты', sourceIds: ['src-0'] };

describe('createSubjectAndPrepare', () => {
  it('creates the subject as «preparing» and flips it to ready with the generated lesson', async () => {
    const p = createSubjectAndPrepare(createLocalContentService({ stageMs: 5 }), draft);
    const before = useProgress.getState();
    expect(before.custom).toMatchObject({ topic: 'SQL', ready: false });
    await p;
    const after = useProgress.getState();
    expect(after.custom?.ready).toBe(true);
    expect(after.prepStage).toBe(PREP_STAGES);
    expect(after.customLesson?.name).toBe('SQL');
    expect(after.missions[CUSTOM_ID].cur).toBe('писать отчёты');
  });

  it('does not resurrect a subject deleted while preparing', async () => {
    const p = createSubjectAndPrepare(createLocalContentService({ stageMs: 5 }), draft);
    useProgress.getState().removeSubject(CUSTOM_ID);
    await p;
    expect(useProgress.getState().custom).toBeNull();
    expect(useProgress.getState().customLesson).toBeNull();
  });

  it('a failing service leaves the subject in place with prepError; retry can finish it', async () => {
    const failing = { ...createLocalContentService({ stageMs: 5 }), prepareFirstLesson: async () => { throw new Error('offline'); } };
    await createSubjectAndPrepare(failing, draft);
    let s = useProgress.getState();
    expect(s.custom).toMatchObject({ topic: 'SQL', ready: false, sourceIds: ['src-0'] });
    expect(s.prepError).toBe('offline');

    await retryPrepare(createLocalContentService({ stageMs: 5 }));
    s = useProgress.getState();
    expect(s.prepError).toBeNull();
    expect(s.custom?.ready).toBe(true);
  });

  it('after a recap the next lesson is prepared and replaces the current one; done resets', async () => {
    const svc = createLocalContentService({ stageMs: 5 });
    await createSubjectAndPrepare(svc, draft);
    useProgress.getState().markDone(CUSTOM_ID, [{ t: 'a', s: 'SQL' }]);
    expect(useProgress.getState().custom).toMatchObject({ ready: true, lessonNumber: 1, language: null });

    const p = prepareNextLesson(svc, [{ title: 'Стартовая уверенность', note: '', ok: true, stepIndex: 1 }, { title: 'Карта того, что уже есть', note: '', ok: false, stepIndex: 2 }]);
    expect(useProgress.getState().custom?.ready).toBe(false);
    await p;
    const s = useProgress.getState();
    expect(s.custom).toMatchObject({ ready: true, lessonNumber: 2 });
    expect(s.customLesson?.lessonTitle).toBe('Урок 2 · Каркас темы');
    expect(s.done[CUSTOM_ID]).toBe(false);
  });

  it('language is detected at creation', async () => {
    await createSubjectAndPrepare(createLocalContentService({ stageMs: 5 }), { ...draft, topic: 'Итальянский язык с самого начала' });
    expect(useProgress.getState().custom?.language).toMatchObject({ code: 'it-IT', en: 'Italian' });
  });

  it('stores the subject title and the glossary reference that came with the lesson', async () => {
    await createSubjectAndPrepare(createLocalContentService({ stageMs: 5 }), { ...draft, title: 'SQL' });
    expect(useProgress.getState().custom?.title).toBe('SQL');
    const refs = useRefs.getState().refs.filter((r) => r.subjectId === CUSTOM_ID);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ subjectName: 'SQL', group: 'Глоссарий', updatedAfter: 1 });
    expect(refs[0].rows.length).toBeGreaterThan(0);

    await prepareNextLesson(createLocalContentService({ stageMs: 5 }), [{ title: 'Стартовая уверенность', note: '', ok: false, stepIndex: 1 }]);
    const after = useRefs.getState().refs.filter((r) => r.subjectId === CUSTOM_ID);
    expect(after).toHaveLength(1);
    expect(after[0].updatedAfter).toBe(2);
  });
});
