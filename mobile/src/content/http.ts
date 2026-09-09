import type { Lesson, LessonRecord } from '@/domain/types';
import type { ContentService, FocusOption, PlanStage, PrepStage, SourceCandidate, SubjectDraft } from './types';

/** Контракт сервера — docs/ai-content.md, server/Teach.Api. */
export interface HttpContentOptions {
  baseUrl: string;
  /** Общий bearer-токен сервера (EXPO_PUBLIC_CONTENT_TOKEN). */
  token?: string;
  /** Интервал опроса статуса подготовки, мс. */
  pollMs?: number;
  /** Максимальное время ожидания урока, мс. */
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class ContentHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ContentHttpError';
  }
}

type LessonStatus = { status: 'preparing' | 'failed'; stage: number | null; number: number } | { status: 'ready'; number: number; lesson: Lesson };
type SourcesJob = { status: 'running' | 'failed'; error?: string } | { status: 'ready'; items: SourceCandidate[] };

/** ContentService поверх HTTP-оркестратора. Ключей модели в клиенте нет. */
export function createHttpContentService(opts: HttpContentOptions): ContentService {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const pollMs = opts.pollMs ?? 3000;
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const f = opts.fetchFn ?? fetch;

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await f(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new ContentHttpError(res.status, `${method} ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  /** Опрос статуса урока до готовности урока с нужным номером; этапы уходят на карточку. */
  async function waitLesson(subjectId: string, number: number, onStage: (s: PrepStage) => void): Promise<Lesson> {
    let lastStage = -1;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const st = await call<LessonStatus>('GET', `/subjects/${subjectId}/lesson`);
      if (st.status === 'ready' && st.number >= number) {
        if (lastStage < 2) onStage(2);
        return st.lesson;
      }
      if (st.status === 'failed') throw new Error('lesson generation failed');
      const stage = Math.min(2, Math.max(0, (st.status === 'ready' ? 0 : st.stage) ?? 0)) as PrepStage;
      if (stage !== lastStage) {
        lastStage = stage;
        onStage(stage);
      }
      if (Date.now() > deadline) throw new Error('lesson generation timed out');
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  return {
    suggestFocus: (topic) => call<FocusOption[]>('POST', '/subjects/focus', { topic }),
    /** Поиск источников — фоновая задача на сервере: web search дольше таймаута HTTP на телефоне (60 с). */
    async findSources(topic, focus) {
      const job = await call<{ jobId: string; status: string }>('POST', '/subjects/sources', { topic, focus });
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const st = await call<SourcesJob>('GET', `/subjects/sources/${job.jobId}`);
        if (st.status === 'ready') return st.items;
        if (st.status === 'failed') throw new Error(st.error || 'sources search failed');
        if (Date.now() > deadline) throw new Error('sources search timed out');
        await new Promise((r) => setTimeout(r, pollMs));
      }
    },
    buildPlan: (draft) => call<PlanStage[]>('POST', '/subjects/plan', draft),
    async prepareFirstLesson(draft: SubjectDraft, onStage) {
      const created = await call<{ subjectId: string; status: string }>('POST', '/subjects', draft);
      const lesson = await waitLesson(created.subjectId, 1, onStage);
      return { lesson, remoteId: created.subjectId };
    },
    async prepareNextLesson(remoteId, number, records: LessonRecord[], onStage) {
      if (!remoteId) throw new Error('subject has no server id');
      const r = await call<{ status: string }>('POST', `/sessions/${remoteId}/recap`, { records });
      if (r.status !== 'preparing') throw new Error('server did not schedule the next lesson');
      return waitLesson(remoteId, number, onStage);
    },
  };
}
