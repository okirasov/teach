import type { SQLiteDatabase } from 'expo-sqlite';
import type { Card as FsrsCard } from 'ts-fsrs';

import type { ReviewCard, StepRef } from '@/domain/reviewCard';
import type { ReviewsRepo } from './reviewsRepo';

interface Row {
  id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  note: string;
  source: string;
  ref_json: string | null;
  created_at: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number;
  last_review: number | null;
}

function fromRow(r: Row): ReviewCard {
  const fsrs: FsrsCard = {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    reps: r.reps,
    lapses: r.lapses,
    learning_steps: r.learning_steps,
    state: r.state,
    last_review: r.last_review == null ? undefined : new Date(r.last_review),
  };
  return {
    id: r.id,
    subjectId: r.subject_id,
    subjectName: r.subject_name,
    title: r.title,
    note: r.note,
    source: r.source,
    ref: r.ref_json ? (JSON.parse(r.ref_json) as StepRef) : null,
    createdAt: r.created_at,
    fsrs,
  };
}

export function sqliteReviewsRepo(db: SQLiteDatabase): ReviewsRepo {
  return {
    async all() {
      const rows = await db.getAllAsync<Row>('SELECT * FROM review_cards ORDER BY due ASC, created_at ASC');
      return rows.map(fromRow);
    },
    async upsert(cards) {
      const st = await db.prepareAsync(
        `INSERT OR REPLACE INTO review_cards
         (id, subject_id, subject_name, title, note, source, ref_json, created_at, due, stability, difficulty,
          elapsed_days, scheduled_days, reps, lapses, learning_steps, state, last_review)
         VALUES ($id, $subjectId, $subjectName, $title, $note, $source, $ref, $createdAt, $due, $stability, $difficulty,
          $elapsed, $scheduled, $reps, $lapses, $learning, $state, $lastReview)`,
      );
      try {
        await db.withTransactionAsync(async () => {
          for (const c of cards) {
            await st.executeAsync({
              $id: c.id,
              $subjectId: c.subjectId,
              $subjectName: c.subjectName,
              $title: c.title,
              $note: c.note,
              $source: c.source,
              $ref: c.ref ? JSON.stringify(c.ref) : null,
              $createdAt: c.createdAt,
              $due: c.fsrs.due.getTime(),
              $stability: c.fsrs.stability,
              $difficulty: c.fsrs.difficulty,
              $elapsed: c.fsrs.elapsed_days,
              $scheduled: c.fsrs.scheduled_days,
              $reps: c.fsrs.reps,
              $lapses: c.fsrs.lapses,
              $learning: c.fsrs.learning_steps,
              $state: c.fsrs.state,
              $lastReview: c.fsrs.last_review ? c.fsrs.last_review.getTime() : null,
            });
          }
        });
      } finally {
        await st.finalizeAsync();
      }
    },
    async addLogs(entries) {
      const st = await db.prepareAsync(
        `INSERT INTO review_log (card_id, rating, state, due, stability, difficulty, elapsed_days, last_elapsed_days,
          scheduled_days, learning_steps, reviewed_at)
         VALUES ($cardId, $rating, $state, $due, $stability, $difficulty, $elapsed, $lastElapsed, $scheduled, $learning, $reviewedAt)`,
      );
      try {
        await db.withTransactionAsync(async () => {
          for (const e of entries) {
            await st.executeAsync({
              $cardId: e.cardId,
              $rating: e.log.rating,
              $state: e.log.state,
              $due: e.log.due.getTime(),
              $stability: e.log.stability,
              $difficulty: e.log.difficulty,
              $elapsed: e.log.elapsed_days,
              $lastElapsed: e.log.last_elapsed_days,
              $scheduled: e.log.scheduled_days,
              $learning: e.log.learning_steps,
              $reviewedAt: e.log.review.getTime(),
            });
          }
        });
      } finally {
        await st.finalizeAsync();
      }
    },
    async removeBySubject(subjectId) {
      await db.runAsync('DELETE FROM review_cards WHERE subject_id = ?', subjectId);
    },
    async count() {
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM review_cards');
      return row?.n ?? 0;
    },
  };
}
