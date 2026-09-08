import type { Lesson } from '@/domain/types';
import type { ContentService, FocusOption, PlanStage, PrepStage, SourceCandidate, SubjectDraft } from './types';

/** Контракт сервера — docs/ai-content.md, server/Teach.Api. */
export interface HttpContentOptions {
  baseUrl: string;
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

type LessonStatus = { status: 'preparing' | 'failed'; stage: number | null } | { status: 'ready'; lesson: Lesson };

/** ContentService поверх HTTP-оркестратора. Ключей модели в клиенте нет. */
export function createHttpContentService(opts: HttpContentOptions): ContentService {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const pollMs = opts.pollMs ?? 3000;
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const f = opts.fetchFn ?? fetch;

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await f(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new ContentHttpError(res.status, `${method} ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    suggestFocus: (topic) => call<FocusOption[]>('POST', '/subjects/focus', { topic }),
    findSources: (topic, focus) => call<SourceCandidate[]>('POST', '/subjects/sources', { topic, focus }),
    buildPlan: (draft) => call<PlanStage[]>('POST', '/subjects/plan', draft),
    async prepareFirstLesson(draft: SubjectDraft, onStage) {
      const created = await call<{ subjectId: string; status: string }>('POST', '/subjects', draft);
      let lastStage = -1;
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const st = await call<LessonStatus>('GET', `/subjects/${created.subjectId}/lesson`);
        if (st.status === 'ready') {
          if (lastStage < 2) onStage(2);
          return st.lesson;
        }
        if (st.status === 'failed') throw new Error('lesson generation failed');
        const stage = Math.min(2, Math.max(0, st.stage ?? 0)) as PrepStage;
        if (stage !== lastStage) {
          lastStage = stage;
          onStage(stage);
        }
        if (Date.now() > deadline) throw new Error('lesson generation timed out');
        await new Promise((r) => setTimeout(r, pollMs));
      }
    },
  };
}
