import { createLocalContentService } from '@/content/local';
import { CUSTOM_ID, PREP_STAGES, useProgress } from '@/store/progress';
import { createSubjectAndPrepare } from '../prepare';

const initial = useProgress.getInitialState();
beforeEach(() => useProgress.setState(initial, true));

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
});
