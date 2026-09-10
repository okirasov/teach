import type { SQLiteDatabase } from 'expo-sqlite';

/** Версионированные миграции через PRAGMA user_version. Только добавляем, не правим прошлые. */
const migrations: string[] = [
  // v1 — карточки повторов и журнал ответов (FSRS-поля как есть)
  `
  CREATE TABLE IF NOT EXISTS review_cards (
    id TEXT PRIMARY KEY NOT NULL,
    subject_id TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT NOT NULL,
    source TEXT NOT NULL,
    ref_json TEXT,
    created_at INTEGER NOT NULL,
    due INTEGER NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    learning_steps INTEGER NOT NULL,
    state INTEGER NOT NULL,
    last_review INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_review_cards_due ON review_cards(due);
  CREATE INDEX IF NOT EXISTS idx_review_cards_subject ON review_cards(subject_id);
  CREATE TABLE IF NOT EXISTS review_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    state INTEGER NOT NULL,
    due INTEGER NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days INTEGER NOT NULL,
    last_elapsed_days INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL,
    learning_steps INTEGER NOT NULL,
    reviewed_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // v2 — справочники (офлайн)
  `
  CREATE TABLE IF NOT EXISTS refs (
    id TEXT PRIMARY KEY NOT NULL,
    subject_id TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    grp TEXT NOT NULL,
    title TEXT NOT NULL,
    updated_after INTEGER NOT NULL,
    sort INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ref_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_id TEXT NOT NULL,
    sec TEXT,
    k TEXT NOT NULL,
    v TEXT NOT NULL,
    weak INTEGER NOT NULL,
    sort INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ref_rows_ref ON ref_rows(ref_id);
  `,
  // v3 — демо-предметы прототипа (en, qa, hist) убраны из приложения: их карточки и справочники удаляются
  `
  DELETE FROM review_cards WHERE subject_id IN ('en', 'qa', 'hist');
  DELETE FROM review_log WHERE card_id NOT IN (SELECT id FROM review_cards);
  DELETE FROM ref_rows WHERE ref_id IN (SELECT id FROM refs WHERE subject_id IN ('en', 'qa', 'hist'));
  DELETE FROM refs WHERE subject_id IN ('en', 'qa', 'hist');
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < migrations.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrations[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version += 1;
  }
}
