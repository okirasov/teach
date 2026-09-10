import { Platform } from 'react-native';

import { memoryKv, type KvRepo } from './kv';
import { DEMO_IDS } from '@/domain/seed';
import { migrate } from './migrations';
import { prototypeRefs } from './seedRefs';
import { prototypeQueue } from './seedCards';
import { memoryRefsRepo, type RefsRepo } from './refsRepo';
import { memoryReviewsRepo, type ReviewsRepo } from './reviewsRepo';

export interface Repos {
  reviews: ReviewsRepo;
  refs: RefsRepo;
  kv: KvRepo;
  close(): Promise<void>;
}

/** Имя файла БД привязано к account id: выход из аккаунта БД не трогает. */
export function databaseName(accountId: string): string {
  return `teach-${accountId.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`;
}

const memoryCache = new Map<string, { reviews: ReviewsRepo; refs: RefsRepo; kv: KvRepo }>();

/**
 * Открывает локальное хранилище для аккаунта. На устройстве — SQLite (expo-sqlite);
 * на web (только превью) — память, живущая до перезагрузки.
 */
export async function openRepos(accountId: string, now = new Date()): Promise<Repos> {
  if (Platform.OS === 'web') {
    const key = databaseName(accountId);
    let repos = memoryCache.get(key);
    if (!repos) {
      repos = { reviews: memoryReviewsRepo([]), refs: memoryRefsRepo([]), kv: memoryKv() };
      await seedDemo(repos.reviews, repos.refs, repos.kv, now);
      memoryCache.set(key, repos);
    }
    return { ...repos, close: async () => {} };
  }
  const SQLite = await import('expo-sqlite');
  const { sqliteReviewsRepo } = await import('./sqliteReviewsRepo');
  const { sqliteKv } = await import('./kv');
  const { sqliteRefsRepo } = await import('./refsRepo');
  const db = await SQLite.openDatabaseAsync(databaseName(accountId));
  await migrate(db);
  const reviews = sqliteReviewsRepo(db);
  const refs = sqliteRefsRepo(db);
  const kv = sqliteKv(db);
  await seedDemo(reviews, refs, kv, now);
  if (__DEV__) console.log(`[db] ${databaseName(accountId)} · ${await reviews.count()} cards · ${await refs.count()} refs`);
  return { reviews, refs, kv, close: () => db.closeAsync() };
}

/**
 * Карточки и справочники демо-предметов (английский, история) — один раз на базу аккаунта.
 * Флаг в kv: миграция v3 вычищала демо-данные прототипа, после неё они засеваются заново.
 */
const DEMO_SEED_KEY = 'demo.seeded.v2';

export async function seedDemo(reviews: ReviewsRepo, refs: RefsRepo, kv: KvRepo, now: Date): Promise<void> {
  if ((await kv.get(DEMO_SEED_KEY)) === '1') return;
  const demo = new Set(DEMO_IDS);
  await reviews.upsert(prototypeQueue(now).filter((c) => demo.has(c.subjectId)));
  await refs.upsert(prototypeRefs.filter((r) => demo.has(r.subjectId)));
  await kv.set(DEMO_SEED_KEY, '1');
}
