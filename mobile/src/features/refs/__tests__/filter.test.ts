import { prototypeRefs } from '@/domain/__fixtures__/protoRefs';
import { filterRefs, refSubjects, sectionRows, weakCount } from '../filter';

describe('refs filter', () => {
  it('lists subjects that have references', () => {
    expect(refSubjects(prototypeRefs).map((s) => s.id)).toEqual(['en', 'qa', 'hist']);
  });

  it('orders subject tabs like the Today screen when an order is given', () => {
    expect(refSubjects(prototypeRefs, ['hist', 'en']).map((s) => s.id)).toEqual(['hist', 'en', 'qa']);
  });

  it('groups references of a subject in order', () => {
    const g = filterRefs(prototypeRefs, 'en', '', false);
    expect(g.map((x) => x.group)).toEqual(['Грамматика', 'Цель', 'Глоссарий']);
    expect(g[0].items).toHaveLength(3);
  });

  it('weak-only keeps references with mistakes and hides empty groups', () => {
    const g = filterRefs(prototypeRefs, 'en', '', true);
    expect(g.map((x) => x.group)).toEqual(['Грамматика', 'Цель']);
    expect(g[0].items.map((r) => r.id)).toEqual(['tenses', 'cond']);
    expect(weakCount(g[0].items[0])).toBe(2);
  });

  it('search matches titles and rows, case-insensitively', () => {
    expect(filterRefs(prototypeRefs, 'en', 'FIGURE', false).flatMap((g) => g.items.map((r) => r.id))).toEqual(['phrasal', 'glen']);
    expect(filterRefs(prototypeRefs, 'qa', 'эквивалент', false).flatMap((g) => g.items.map((r) => r.id))).toEqual(['equiv', 'glqa']);
    expect(filterRefs(prototypeRefs, 'hist', 'zzz', false)).toEqual([]);
  });

  it('splits rows into sections and searches inside', () => {
    const tenses = prototypeRefs.find((r) => r.id === 'tenses')!;
    expect(sectionRows(tenses, '').map((s) => [s.sec, s.rows.length])).toEqual([['Настоящее', 4], ['Прошедшее', 3], ['Будущее', 3]]);
    expect(sectionRows(tenses, 'perfect').map((s) => s.rows.map((r) => r.k))).toEqual([
      ['Present Perfect', 'Present Perfect Continuous'],
      ['Past Simple vs Perfect'],
    ]);
    const cond = prototypeRefs.find((r) => r.id === 'cond')!;
    expect(sectionRows(cond, '')[0].sec).toBe('');
  });
});
