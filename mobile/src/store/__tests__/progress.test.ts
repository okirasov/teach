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
    const id = useProgress.getState().createSubject({ topic: 'SQL', focus: '', mission: 'm' });
    useProgress.getState().removeSubject(id);
    expect(useProgress.getState().subjects[id]).toBeUndefined();
    expect(activeSubjectIds(useProgress.getState())).not.toContain(id);
  });

  it('ids монотонные и не переиспользуются после удаления', () => {
    const a = useProgress.getState().createSubject({ topic: 'SQL', focus: '', mission: 'm' });
    const b = useProgress.getState().createSubject({ topic: 'Итальянский', focus: '', mission: 'm2' });
    const c = useProgress.getState().createSubject({ topic: 'История', focus: '', mission: 'm3' });
    expect([a, b, c]).toEqual(['s1', 's2', 's3']);
    expect(userSubjectIds(useProgress.getState())).toEqual([a, b, c]);
    // Удалили средний — новый предмет получает СВОЙ id, а не освободившийся:
    // иначе он унаследовал бы карточки повторов и справочники удалённого.
    useProgress.getState().removeSubject(b);
    const d = useProgress.getState().createSubject({ topic: 'Ещё', focus: '', mission: 'm4' });
    expect(d).toBe('s4');
    expect(userSubjectIds(useProgress.getState())).toEqual([a, c, d]);
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

  it('ошибка подготовки не сохраняется между запусками', () => {
    const id = useProgress.getState().createSubject({ topic: 'SQL', focus: '', mission: 'm' });
    useProgress.getState().setPrepError(id, 'offline');
    expect(prepOf(useProgress.getState(), id).error).toBe('offline');
    // Следующая попытка снимает ошибку.
    useProgress.getState().setPrepStage(id, 1);
    expect(prepOf(useProgress.getState(), id)).toEqual({ stage: 1, error: null });
    // Ошибки нет среди сохраняемых полей — после перезапуска подготовка возобновится сама.
    useProgress.getState().setPrepError(id, 'offline');
    expect(Object.keys(useProgress.getState())).toContain('prepErrors');
    expect(useProgress.getState().prepStages[id]).toBe(1);
  });

  it('снимок старой версии с одним предметом переносится под id custom', () => {
    const legacy = {
      done: { custom: true }, removed: {}, added: 3, missions: {}, cfg: {}, reviewLog: [], sessions: {},
      custom: { topic: 'Итальянский', focus: 'Фразы', mission: 'кафе', ready: true, lessonNumber: 2, remoteId: 'r1' },
      customLesson: { name: 'Итальянский', level: 'этап 01', steps: [] },
      prepStage: 3, prepError: null,
    };
    const next = migrateProgressSnapshot(legacy) as Record<string, any>;
    expect(next.subjects[CUSTOM_ID]).toMatchObject({ topic: 'Итальянский', ready: true, remoteId: 'r1', createdAt: 0 });
    expect(next.lessons[CUSTOM_ID].name).toBe('Итальянский');
    // Готовый предмет не «в подготовке», ошибка не переносится.
    expect(next.prepStages[CUSTOM_ID]).toBeUndefined();
    expect(next.prepErrors).toEqual({});
    expect(next.seq).toBe(0);
    expect(next.added).toBe(3);
    expect('custom' in next).toBe(false);
    // Перенесённый предмет остаётся первым, следующий получает s1 и идёт после него.
    useProgress.setState(next as never);
    const second = useProgress.getState().createSubject({ topic: 'Новый', focus: '', mission: 'm' });
    expect(second).toBe('s1');
    expect(userSubjectIds(useProgress.getState())).toEqual([CUSTOM_ID, 's1']);
    // Уже новый снимок не трогаем; пустой старый даёт пустые записи.
    const modern = { subjects: { x: {} }, lessons: {}, prepStages: {} };
    expect(migrateProgressSnapshot(modern)).toBe(modern);
    expect(migrateProgressSnapshot({ added: 1 })).toMatchObject({ added: 1, subjects: {}, lessons: {}, seq: 0 });

    // Прерванная подготовка переносится с этапом, но без ошибки: возобновится сама.
    const interrupted = migrateProgressSnapshot({
      custom: { topic: 'SQL', focus: '', mission: 'm', ready: false }, customLesson: null, prepStage: 2, prepError: 'offline',
    }) as Record<string, any>;
    expect(interrupted.prepStages[CUSTOM_ID]).toBe(2);
    expect(interrupted.prepErrors).toEqual({});
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
