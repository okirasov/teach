import type { Reference, RefRow } from '@/domain/reference';

export function weakCount(ref: Reference): number {
  return ref.rows.filter((r) => r.weak).length;
}

function matches(q: string, ...parts: string[]): boolean {
  return parts.some((p) => p.toLowerCase().includes(q));
}

export interface RefGroup {
  group: string;
  items: Reference[];
}

/** Предметы, у которых есть справочники, в порядке первого появления. */
export function refSubjects(refs: Reference[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const r of refs) if (!seen.has(r.subjectId)) seen.set(r.subjectId, r.subjectName);
  return [...seen].map(([id, name]) => ({ id, name }));
}

/** Живой поиск по названиям и строкам + фильтр «Слабые места»; пустые группы скрываются. */
export function filterRefs(refs: Reference[], subjectId: string, query: string, weakOnly: boolean): RefGroup[] {
  const q = query.trim().toLowerCase();
  const groups: RefGroup[] = [];
  for (const r of refs) {
    if (r.subjectId !== subjectId) continue;
    if (weakOnly && weakCount(r) === 0) continue;
    if (q && !matches(q, r.title) && !r.rows.some((row) => matches(q, row.k, row.v))) continue;
    let g = groups.find((x) => x.group === r.group);
    if (!g) {
      g = { group: r.group, items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }
  return groups;
}

export interface RefSection {
  sec: string;
  rows: RefRow[];
}

/** Строки справочника по подразделам с поиском внутри; строки без подраздела — секция с пустым именем. */
export function sectionRows(ref: Reference, query: string): RefSection[] {
  const q = query.trim().toLowerCase();
  const secs: RefSection[] = [];
  for (const row of ref.rows) {
    if (q && !matches(q, row.k, row.v)) continue;
    const name = row.sec ?? '';
    let s = secs.find((x) => x.sec === name);
    if (!s) {
      s = { sec: name, rows: [] };
      secs.push(s);
    }
    s.rows.push(row);
  }
  return secs;
}
