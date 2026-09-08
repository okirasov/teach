import { Platform } from 'react-native';

import { migrate } from './migrations';
import { memoryReviewsRepo, type ReviewsRepo } from './reviewsRepo';
import { prototypeQueue } from './seedCards';

export interface Repos {
  reviews: ReviewsRepo;
  close(): Promise<void>;
}

/** Имя файла БД привязано к account id: выход из аккаунта БД не трогает. */
export function databaseName(accountId: string): string {
  return `teach-${accountId.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`;
}

const memoryCache = new Map<string, ReviewsRepo>();

/**
 * Открывает локальное хранилище для аккаунта. На устройстве — SQLite (expo-sqlite);
 * на web (только превью) — память, живущая до перезагрузки.
 */
export async function openRepos(accountId: string, now = new Date()): Promise<Repos> {
  if (Platform.OS === 'web') {
    const key = databaseName(accountId);
    let repo = memoryCache.get(key);
    if (!repo) {
      repo = memoryReviewsRepo(prototypeQueue(now));
      memoryCache.set(key, repo);
    }
    return { reviews: repo, close: async () => {} };
  }
  const SQLite = await import('expo-sqlite');
  const { sqliteReviewsRepo } = await import('./sqliteReviewsRepo');
  const db = await SQLite.openDatabaseAsync(databaseName(accountId));
  await migrate(db);
  const reviews = sqliteReviewsRepo(db);
  if ((await reviews.count()) === 0) await reviews.upsert(prototypeQueue(now));
  if (__DEV__) console.log(`[db] ${databaseName(accountId)} · ${await reviews.count()} cards`);
  return { reviews, close: () => db.closeAsync() };
}
