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
): Promise<() => void> {
  const raw = await kv.get(key);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as Partial<Pick<S, K>>;
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
