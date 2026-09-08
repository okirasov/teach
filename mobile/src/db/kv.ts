import type { SQLiteDatabase } from 'expo-sqlite';

/** Ключ-значение для настроек и прогресса (таблица kv). */
export interface KvRepo {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export function memoryKv(): KvRepo {
  const m = new Map<string, string>();
  return {
    async get(k) {
      return m.get(k) ?? null;
    },
    async set(k, v) {
      m.set(k, v);
    },
  };
}

export function sqliteKv(db: SQLiteDatabase): KvRepo {
  return {
    async get(k) {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', k);
      return row?.value ?? null;
    },
    async set(k, v) {
      await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', k, v);
    },
  };
}
