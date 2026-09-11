import type { ReviewCard } from '@/domain/reviewCard';
import type { PracticeStep } from '@/domain/types';
import { buildReviewLesson } from '../buildReviewLesson';

const step = (prompt: string) => ({ type: 'choice', prompt, options: ['a', 'b'], correct: 0, explain: '', recTitle: '', recNote: '' }) as PracticeStep;

const card = (ref: ReviewCard['ref'], id = 'c1'): ReviewCard => ({
  id, subjectId: 's1', subjectName: 'S', title: 't', note: '', source: '', createdAt: 0, fsrs: {} as ReviewCard['fsrs'], ref,
});

describe('вопрос в повторах', () => {
  it('задаётся сохранённый вопрос, а не шаг текущего урока предмета', () => {
    const old = step('вопрос урока 1');
    const plan = buildReviewLesson([card({ subjectId: 's1', step: 1, lessonNumber: 1, snapshot: old })], () => step('вопрос урока 2'), 'Повторы', 0);
    expect(plan.lesson.steps[0]).toBe(old);
  });

  it('без снимка ищется по номеру урока из ссылки', () => {
    const seen: unknown[] = [];
    buildReviewLesson([card({ subjectId: 's1', step: 2, lessonNumber: 3 }), card({ subjectId: 's1', step: 1 }, 'c2')], (sid, st, n) => {
      seen.push([sid, st, n]);
      return step('x');
    }, 'Повторы', 0);
    expect(seen).toEqual([['s1', 2, 3], ['s1', 1, undefined]]);
  });
});
