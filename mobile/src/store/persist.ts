import type { StoreApi } from 'zustand';

import type { KvRepo } from '@/db/kv';

/**
 * Персист части состояния zustand-стора в kv: при подключении читает снимок,
 * дальше пишет при каждом изменении выбранных полей. Возвращает отписку.
 */
export async function persistSlice<S extends object, K extends keyof S>(
  store: StoreApi<S>,
  kv: KvRepo,
  key: string,
  fields: K[],
  /** Приводит снимок старой версии к текущей форме до применения. */
  migrate?: (saved: Record<string, unknown>) => Record<string, unknown>,
): Promise<() => void> {
  const raw = await kv.get(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const saved = (migrate ? migrate(parsed) : parsed) as Partial<Pick<S, K>>;
      const patch: Partial<S> = {};
      for (const f of fields) if (f in saved) patch[f] = saved[f] as S[K];
      store.setState(patch);
    } catch {
      /* битый снимок — игнорируем */
    }
  }
  const pick = (s: S) => Object.fromEntries(fields.map((f) => [f, s[f]])) as Pick<S, K>;
  let last = JSON.stringify(pick(store.getState()));
  return store.subscribe((s) => {
    const next = JSON.stringify(pick(s));
    if (next === last) return;
    last = next;
    kv.set(key, next).catch(() => {});
  });
}
