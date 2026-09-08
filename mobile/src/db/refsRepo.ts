import type { SQLiteDatabase } from 'expo-sqlite';

import type { Reference, RefRow } from '@/domain/reference';

/** Хранилище справочников: SQLite на устройстве, память для web-превью и тестов. */
export interface RefsRepo {
  all(): Promise<Reference[]>;
  upsert(refs: Reference[]): Promise<void>;
  removeBySubject(subjectId: string): Promise<void>;
  count(): Promise<number>;
}

export function memoryRefsRepo(initial: Reference[] = []): RefsRepo {
  const map = new Map(initial.map((x) => [x.id, x]));
  return {
    async all() {
      return [...map.values()];
    },
    async upsert(refs) {
      for (const x of refs) map.set(x.id, x);
    },
    async removeBySubject(subjectId) {
      for (const [id, x] of map) if (x.subjectId === subjectId) map.delete(id);
    },
    async count() {
      return map.size;
    },
  };
}

interface RefRowDb { id: string; subject_id: string; subject_name: string; grp: string; title: string; updated_after: number; sort: number }
interface RowDb { ref_id: string; sec: string | null; k: string; v: string; weak: number; sort: number }

export function sqliteRefsRepo(db: SQLiteDatabase): RefsRepo {
  return {
    async all() {
      const refs = await db.getAllAsync<RefRowDb>('SELECT * FROM refs ORDER BY sort ASC');
      const rows = await db.getAllAsync<RowDb>('SELECT * FROM ref_rows ORDER BY ref_id, sort ASC');
      const byRef = new Map<string, RefRow[]>();
      for (const rw of rows) {
        const list = byRef.get(rw.ref_id) ?? [];
        list.push(rw.sec ? { sec: rw.sec, k: rw.k, v: rw.v, weak: !!rw.weak } : { k: rw.k, v: rw.v, weak: !!rw.weak });
        byRef.set(rw.ref_id, list);
      }
      return refs.map((x) => ({ id: x.id, subjectId: x.subject_id, subjectName: x.subject_name, group: x.grp, title: x.title, updatedAfter: x.updated_after, rows: byRef.get(x.id) ?? [] }));
    },
    async upsert(refs) {
      await db.withTransactionAsync(async () => {
        let sort = 0;
        for (const x of refs) {
          await db.runAsync(
            'INSERT OR REPLACE INTO refs (id, subject_id, subject_name, grp, title, updated_after, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
            x.id, x.subjectId, x.subjectName, x.group, x.title, x.updatedAfter, sort++,
          );
          await db.runAsync('DELETE FROM ref_rows WHERE ref_id = ?', x.id);
          for (let i = 0; i < x.rows.length; i++) {
            const rw = x.rows[i];
            await db.runAsync('INSERT INTO ref_rows (ref_id, sec, k, v, weak, sort) VALUES (?, ?, ?, ?, ?, ?)', x.id, rw.sec ?? null, rw.k, rw.v, rw.weak ? 1 : 0, i);
          }
        }
      });
    },
    async removeBySubject(subjectId) {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM ref_rows WHERE ref_id IN (SELECT id FROM refs WHERE subject_id = ?)', subjectId);
        await db.runAsync('DELETE FROM refs WHERE subject_id = ?', subjectId);
      });
    },
    async count() {
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM refs');
      return row?.n ?? 0;
    },
  };
}
