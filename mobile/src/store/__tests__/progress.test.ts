import {
  activeSubjectIds,
  CUSTOM_ID,
  getLesson,
  PREP_STAGES,
  subjectConfig,
  useProgress,
} from '../progress';

const initial = useProgress.getInitialState();
beforeEach(() => useProgress.setState(initial, true));

describe('progress store', () => {
  it('lists seed subjects and hides removed ones', () => {
    expect(activeSubjectIds(useProgress.getState())).toEqual(['en', 'qa', 'hist']);
    useProgress.getState().removeSubject('qa');
    expect(activeSubjectIds(useProgress.getState())).toEqual(['en', 'hist']);
  });

  it('markDone flags the subject and grows the queue by the number of records', () => {
    useProgress.getState().markDone('en', [{ t: 'a', s: 'Английский' }, { t: 'b', s: 'Английский' }]);
    const s = useProgress.getState();
    expect(s.done.en).toBe(true);
    expect(s.added).toBe(2);
    expect(s.reviewLog).toHaveLength(2);
  });

  it('custom subject appears, prepares in stages and becomes ready', () => {
    useProgress.getState().createCustom({ topic: 'SQL', focus: 'Основы и синтаксис', mission: 'писать отчёты' });
    expect(activeSubjectIds(useProgress.getState())).toContain(CUSTOM_ID);
    expect(useProgress.getState().custom?.ready).toBe(false);
    useProgress.getState().setPrepStage(1);
    expect(useProgress.getState().prepStage).toBe(1);
    useProgress.getState().setCustomReady({ name: 'SQL', level: 'старт', steps: [] });
    expect(useProgress.getState().custom?.ready).toBe(true);
    expect(useProgress.getState().prepStage).toBe(PREP_STAGES);
    expect(getLesson(useProgress.getState(), CUSTOM_ID, 'Повторы')?.name).toBe('SQL');
  });

  it('removing the custom subject drops it entirely', () => {
    useProgress.getState().createCustom({ topic: 'SQL', focus: '', mission: 'm' });
    useProgress.getState().removeSubject(CUSTOM_ID);
    expect(useProgress.getState().custom).toBeNull();
    expect(activeSubjectIds(useProgress.getState())).not.toContain(CUSTOM_ID);
  });

  it('mission edits append history versions, never delete', () => {
    useProgress.getState().setMission('qa', 'новая');
    const m = useProgress.getState().missions.qa;
    expect(m.cur).toBe('новая');
    expect(m.hist).toEqual(['v1 · перейти из ручного тестирования в автоматизацию']);
  });

  it('subject config merges over defaults', () => {
    expect(subjectConfig(useProgress.getState(), 'en').voice).toBe(true);
    useProgress.getState().setCfg('en', { voice: false });
    expect(subjectConfig(useProgress.getState(), 'en')).toMatchObject({ voice: false, dur: 5 });
  });
});
