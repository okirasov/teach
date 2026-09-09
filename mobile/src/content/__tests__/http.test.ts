import { createHttpContentService } from '../http';

type Handler = (url: string, init?: RequestInit) => { status?: number; body: unknown };

function fakeFetch(handler: Handler) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = handler(url, init);
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body } as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('http content service', () => {
  it('posts wizard requests to the contract paths', async () => {
    const { fn, calls } = fakeFetch((url, init) => {
      if (url.endsWith('/subjects/focus')) return { body: [{ t: 'A', d: 'a' }] };
      if (url.endsWith('/subjects/sources') && init?.method === 'POST') return { status: 202, body: { jobId: 'j1', status: 'running' } };
      if (url.endsWith('/subjects/sources/j1')) return { body: { status: 'ready', items: [{ id: 'src-0', t: 'S', m: 'm', trust: 'high' }] } };
      if (url.endsWith('/subjects/plan')) return { body: [{ n: '01', t: 'p', d: 'd' }] };
      return { status: 404, body: null };
    });
    const svc = createHttpContentService({ baseUrl: 'http://srv/', fetchFn: fn, pollMs: 1, token: 'tok-1' });
    expect((await svc.suggestFocus('История'))[0].t).toBe('A');
    expect((await svc.findSources('SQL', 'f'))[0].trust).toBe('high');
    expect((await svc.buildPlan({ topic: 'SQL', focus: 'f', mission: 'm' }))[0].n).toBe('01');
    expect(calls.map((c) => c.url)).toEqual(['http://srv/subjects/focus', 'http://srv/subjects/sources', 'http://srv/subjects/sources/j1', 'http://srv/subjects/plan']);
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ topic: 'История' });
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
  });

  it('prepareFirstLesson creates the subject, reports stages while polling and resolves with the lesson', async () => {
    let polls = 0;
    const lesson = { name: 'SQL', level: 'старт', steps: [] };
    const { fn } = fakeFetch((url, init) => {
      if (url.endsWith('/subjects') && init?.method === 'POST') return { status: 202, body: { subjectId: 'abc', status: 'preparing' } };
      if (url.endsWith('/subjects/abc/lesson')) {
        polls += 1;
        if (polls === 1) return { body: { status: 'preparing', stage: 0, number: 1 } };
        if (polls === 2) return { body: { status: 'preparing', stage: 1, number: 1 } };
        return { body: { status: 'ready', number: 1, lesson } };
      }
      return { status: 404, body: null };
    });
    const svc = createHttpContentService({ baseUrl: 'http://srv', fetchFn: fn, pollMs: 1 });
    const stages: number[] = [];
    const result = await svc.prepareFirstLesson({ topic: 'SQL', focus: 'f', mission: 'm', sourceIds: ['src-0'] }, (s) => stages.push(s));
    expect(result).toEqual({ lesson, remoteId: 'abc' });
    expect(stages).toEqual([0, 1, 2]);
  });

  it('prepareNextLesson posts the recap and waits for the next lesson number', async () => {
    let polls = 0;
    const lesson2 = { name: 'SQL', level: 'этап 01', lessonTitle: 'Урок 2 · X', steps: [] };
    const { fn, calls } = fakeFetch((url, init) => {
      if (url.endsWith('/sessions/abc/recap') && init?.method === 'POST') return { status: 202, body: { status: 'preparing' } };
      if (url.endsWith('/subjects/abc/lesson')) {
        polls += 1;
        if (polls === 1) return { body: { status: 'ready', number: 1, lesson: { name: 'old', level: '', steps: [] } } };
        if (polls === 2) return { body: { status: 'preparing', stage: 2, number: 2 } };
        return { body: { status: 'ready', number: 2, lesson: lesson2, references: [{ id: 'g', group: 'Глоссарий', title: 'Термины · SQL', updatedAfter: 2, rows: [{ k: 'JOIN', v: 'соединение таблиц' }] }] } };
      }
      return { status: 404, body: null };
    });
    const svc = createHttpContentService({ baseUrl: 'http://srv', fetchFn: fn, pollMs: 1 });
    const stages: number[] = [];
    const result = await svc.prepareNextLesson('abc', 2, [{ title: 't', note: 'n', ok: false, stepIndex: 1 }], (s) => stages.push(s));
    expect(result.references?.[0].rows[0].k).toBe('JOIN');
    expect(result.lesson).toEqual(lesson2);
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ records: [{ title: 't', note: 'n', ok: false, stepIndex: 1 }] });
    expect(stages[stages.length - 1]).toBe(2);
  });

  it('fails loudly on server errors and failed generation', async () => {
    const { fn } = fakeFetch((url) => (url.endsWith('/subjects/focus') ? { status: 500, body: null } : { status: 202, body: { subjectId: 'x' } }));
    const svc = createHttpContentService({ baseUrl: 'http://srv', fetchFn: fn, pollMs: 1 });
    await expect(svc.suggestFocus('x')).rejects.toMatchObject({ status: 500 });

    const failed = fakeFetch((url, init) =>
      url.endsWith('/subjects') && init?.method === 'POST' ? { status: 202, body: { subjectId: 'x' } } : { body: { status: 'failed', stage: 2 } },
    );
    const svc2 = createHttpContentService({ baseUrl: 'http://srv', fetchFn: failed.fn, pollMs: 1 });
    await expect(svc2.prepareFirstLesson({ topic: 'x', focus: '', mission: '', sourceIds: [] }, () => {})).rejects.toThrow('failed');
  });
});
