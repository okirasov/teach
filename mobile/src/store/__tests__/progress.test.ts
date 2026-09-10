import {
  activeSubjectIds,
  CUSTOM_ID,
  getLesson,
  migrateProgressSnapshot,
  PREP_STAGES,
  prepOf,
  subjectConfig,
  useProgress,
  userSubjectIds,
} from '../progress';

const initial = useProgress.getInitialState();
beforeEach(() => useProgress.setState(initial, true));

describe('progress store', () => {
  it('lists seed subjects and hides removed ones', () => {
    expect(activeSubjectIds(useProgress.getState())).toEqual(['en', 'speak']);
    useProgress.getState().removeSubject('speak');
    expect(activeSubjectIds(useProgress.getState())).toEqual(['en']);
  });

  it('markDone flags the subject and grows the queue by the number of records', () => {
    useProgress.getState().markDone('en', [{ t: 'a', s: 'Английский' }, { t: 'b', s: 'Английский' }]);
    const s = useProgress.getState();
    expect(s.done.en).toBe(true);
    expect(s.added).toBe(2);
    expect(s.reviewLog).toHaveLength(2);
  });

  it('custom subject appears, prepares in stages and becomes ready', () => {
    const id = useProgress.getState().createSubject({ topic: 'SQL', focus: 'Основы и синтаксис', mission: 'писать отчёты' });
    expect(id).toBe(CUSTOM_ID);
    expect(activeSubjectIds(useProgress.getState())).toContain(id);
    expect(useProgress.getState().subjects[id].ready).toBe(false);
    useProgress.getState().setPrepStage(id, 1);
    expect(prepOf(useProgress.getState(), id).stage).toBe(1);
    useProgress.getState().setSubjectReady(id, { name: 'SQL', level: 'старт', steps: [] });
    expect(useProgress.getState().subjects[id].ready).toBe(true);
    expect(prepOf(useProgress.getState(), id).stage).toBe(PREP_STAGES);
    expect(getLesson(useProgress.getState(), id, 'Повторы')?.name).toBe('SQL');
  });

  it('removing the custom subject drops it entirely', () => {
    useProgress.getState().createSubject({ topic: 'SQL', focus: '', mission: 'm' });
    useProgress.getState().removeSubject(CUSTOM_ID);
    expect(useProgress.getState().subjects[CUSTOM_ID]).toBeUndefined();
    expect(activeSubjectIds(useProgress.getState())).not.toContain(CUSTOM_ID);
  });

  it('ids: первый предмет — исторический custom, следующие — сгенерированные', () => {
    const a = useProgress.getState().createSubject({ topic: 'SQL', focus: '', mission: 'm' });
    const b = useProgress.getState().createSubject({ topic: 'Итальянский', focus: '', mission: 'm2' });
    const c = useProgress.getState().createSubject({ topic: 'История', focus: '', mission: 'm3' });
    expect([a, b, c]).toEqual([CUSTOM_ID, 'custom-2', 'custom-3']);
    expect(userSubjectIds(useProgress.getState())).toEqual([a, b, c]);
    // Удалили средний — новый предмет занимает освободившийся id, не ломая остальные.
    useProgress.getState().removeSubject(b);
    const d = useProgress.getState().createSubject({ topic: 'Ещё', focus: '', mission: 'm4' });
    expect(d).toBe('custom-2');
    expect(useProgress.getState().subjects[a].topic).toBe('SQL');
    expect(useProgress.getState().subjects[c].topic).toBe('История');
  });

  it('состояние подготовки и уроки не смешиваются между предметами', () => {
    const a = useProgress.getState().createSubject({ topic: 'SQL', focus: '', mission: 'm' });
    const b = useProgress.getState().createSubject({ topic: 'Итальянский', focus: '', mission: 'm2' });
    useProgress.getState().setPrepStage(a, 2);
    useProgress.getState().setPrepError(b, 'offline');
    expect(prepOf(useProgress.getState(), a)).toEqual({ stage: 2, error: null });
    expect(prepOf(useProgress.getState(), b)).toEqual({ stage: 0, error: 'offline' });

    useProgress.getState().setSubjectReady(a, { name: 'SQL', level: '', steps: [] });
    expect(getLesson(useProgress.getState(), a, 'Повторы')?.name).toBe('SQL');
    // У b урока нет — getLesson отдаёт заглушку по теме, а не урок a.
    expect(getLesson(useProgress.getState(), b, 'Повторы')?.name).toBe('Итальянский');
  });

  it('снимок старой версии с одним предметом переносится под id custom', () => {
    const legacy = {
      done: { custom: true }, removed: {}, added: 3, missions: {}, cfg: {}, reviewLog: [], sessions: {},
      custom: { topic: 'Итальянский', focus: 'Фразы', mission: 'кафе', ready: true, lessonNumber: 2, remoteId: 'r1' },
      customLesson: { name: 'Итальянский', level: 'этап 01', steps: [] },
      prepStage: 3, prepError: null,
    };
    const next = migrateProgressSnapshot(legacy) as Record<string, any>;
    expect(next.subjects[CUSTOM_ID]).toMatchObject({ topic: 'Итальянский', ready: true, remoteId: 'r1', createdAt: 1 });
    expect(next.lessons[CUSTOM_ID].name).toBe('Итальянский');
    expect(next.prep[CUSTOM_ID]).toEqual({ stage: 3, error: null });
    expect(next.added).toBe(3);
    expect('custom' in next).toBe(false);
    // Уже новый снимок не трогаем; пустой старый даёт пустые записи.
    const modern = { subjects: { x: {} }, lessons: {}, prep: {} };
    expect(migrateProgressSnapshot(modern)).toBe(modern);
    expect(migrateProgressSnapshot({ added: 1 })).toMatchObject({ added: 1, subjects: {}, lessons: {}, prep: {} });
  });

  it('mission edits append history versions, never delete', () => {
    useProgress.getState().setMission('speak', 'новая');
    const m = useProgress.getState().missions.speak;
    expect(m.cur).toBe('новая');
    expect(m.hist).toEqual(['v1 · уверенно выступить перед командой на 10 минут']);
  });

  it('subject config merges over defaults', () => {
    expect(subjectConfig(useProgress.getState(), 'en').voice).toBe(true);
    useProgress.getState().setCfg('en', { voice: false });
    expect(subjectConfig(useProgress.getState(), 'en')).toMatchObject({ voice: false, dur: 10 });
  });
});
