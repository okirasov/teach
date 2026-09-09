import { createLocalContentService } from '../local';

describe('local content service', () => {
  const svc = createLocalContentService({ stageMs: 10 });

  it('suggests focus options by topic kind', async () => {
    expect((await svc.suggestFocus('История'))[0].t).toBe('Поздняя Античность');
    expect((await svc.suggestFocus('SQL'))[0].t).toBe('Основы и синтаксис');
    expect((await svc.suggestFocus('Садоводство'))[0].t).toBe('Садоводство: основы');
  });

  it('suggests a short title: language name or first words', async () => {
    expect(await svc.suggestTitle('Итальянский язык с самого начала')).toBe('Итальянский');
    expect(await svc.suggestTitle('публичные выступления перед руководством и инвесторами')).toBe('Публичные выступления');
    expect(await svc.suggestTitle('SQL')).toBe('SQL');
  });

  it('finds four sources with trust levels', async () => {
    const src = await svc.findSources('SQL', 'Основы и синтаксис');
    expect(src).toHaveLength(4);
    expect(src.map((s) => s.trust)).toEqual(['high', 'high', 'mid', 'low']);
    expect(src[0].t).toContain('Основы и синтаксис');
  });

  it('plan echoes the mission in stage 03', async () => {
    const plan = await svc.buildPlan({ topic: 'SQL', focus: 'f', mission: 'писать отчёты' });
    expect(plan.map((p) => p.n)).toEqual(['01', '02', '03']);
    expect(plan[2].d).toBe('писать отчёты');
  });

  it('prepares the first lesson through three stages', async () => {
    const stages: number[] = [];
    const { lesson } = await svc.prepareFirstLesson({ topic: 'SQL', focus: 'f', mission: 'm', sourceIds: [] }, (s) => stages.push(s));
    expect(stages).toEqual([0, 1, 2]);
    expect(lesson.name).toBe('SQL');
    expect(lesson.steps[0].type).toBe('explain');
  });
});
