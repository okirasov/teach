import React, { useEffect, useState } from 'react';

import { useAuth } from '@/store/auth';
import { persistSlice } from '@/store/persist';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { useReviews } from '@/store/reviews';
import { openRepos, type Repos } from './database';

/**
 * Открывает локальную БД аккаунта после входа и подключает сторы.
 * Выход отключает сторы, но файл БД остаётся на устройстве.
 */
export function DbGate({ children }: { children: React.ReactNode }) {
  const accountId = useAuth((s) => s.account?.id ?? null);
  const attach = useReviews((s) => s.attach);
  const detach = useReviews((s) => s.detach);
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) {
      detach();
      setReadyFor(null);
      return;
    }
    let repos: Repos | null = null;
    let cancelled = false;
    const unsubs: (() => void)[] = [];
    openRepos(accountId)
      .then(async (r) => {
        if (cancelled) return r.close();
        repos = r;
        await attach(r.reviews);
        unsubs.push(await persistSlice(useSettings, r.kv, 'settings', ['lang', 'theme', 'reminder', 'weekendOff', 'cap', 'mode']));
        unsubs.push(
          await persistSlice(useProgress, r.kv, 'progress', ['done', 'removed', 'added', 'custom', 'customLesson', 'prepStage', 'missions', 'cfg', 'reviewLog']),
        );
        if (!cancelled) setReadyFor(accountId);
      })
      .catch((e) => console.warn('db open failed', e));
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      detach();
      repos?.close().catch(() => {});
    };
  }, [accountId, attach, detach]);

  if (accountId && readyFor !== accountId) return null;
  return <>{children}</>;
}
