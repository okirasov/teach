import type { ContentService } from '@/content';
import { memoryReviewsRepo } from '@/db/reviewsRepo';
import type { ReviewCard } from '@/domain/reviewCard';
import type { Lesson } from '@/domain/types';
import { useProgress } from '@/store/progress';
import { useReviews } from '@/store/reviews';
import { forgetRepairAttempts, repairLegacyCards } from '../repairCards';

const choice = (recTitle: string, prompt: string) => ({ type: 'choice' as const, prompt, options: ['a', 'b'], correct: 0, explain: '', recTitle, recNote: '' });
const explain = { type: 'explain' as const, why: '', title: 'e', paras: [], example: '', source: '' };
const L1: Lesson = { name: 'It', level: '', steps: [explain, choice('Самооценка ≠ уровень', 'q1-1'), choice('Знакомые слова — это уже опора', 'q1-2'), choice('Вежливое Lei идёт с 3-м лицом', 'q1-3')] };
const L2: Lesson = { name: 'It', level: '', steps: [explain, choice('Ciao кажется универсальным', 'q2-1'), choice('Встречный вопрос E tu? теряется', 'q2-2'), choice('Lei требует 3-го лица глагола', 'q2-3')] };
const card = (id: string, subjectId: string, title: string, ref: ReviewCard['ref']): ReviewCard => ({
  id, subjectId, subjectName: 'Итальянский', title, note: '', source: '', createdAt: 0, fsrs: {} as ReviewCard['fsrs'], ref,
});
const svc = (impl: Partial<ContentService>) => impl as ContentService;

beforeEach(async () => {
  forgetRepairAttempts();
  useProgress.setState(useProgress.getInitialState(), true);
  useProgress.setState({ subjects: { s1: { topic: 'Итальянский', focus: '', mission: '', ready: true, remoteId: 'r1', lessonNumber: 2, createdAt: 1 } } });
  useReviews.setState(useReviews.getInitialState(), true);
  await useReviews.getState().attach(memoryReviewsRepo([
    card('a', 's1', 'Ciao кажется универсальным', { subjectId: 's1', step: 1 }),
    card('b', 's1', 'Знакомые слова — это уже опора', { subjectId: 's1', step: 2 }),
    card('c', 's1', 'нигде не встречается', { subjectId: 's1', step: 3 }),
    card('d', 'en', 'демо', { subjectId: 'en', step: 1 }),
    card('e', 's1', 'уже новая', { subjectId: 's1', step: 1, lessonNumber: 2 }),
  ]));
});

describe('починка старых карточек повторов', () => {
  it('находит урок каждой старой карточки по заголовку записи и сохраняет вопрос', async () => {
    const history = jest.fn(async () => [{ number: 1, lesson: L1 }, { number: 2, lesson: L2 }]);
    expect(await repairLegacyCards(svc({ lessonHistory: history }))).toBe(2);
    const byId = Object.fromEntries(useReviews.getState().cards.map((c) => [c.id, c]));
    // Заголовок «a» старый код переписал уроком 2 — берём урок 2.
    expect(byId.a.ref).toMatchObject({ lessonNumber: 2, snapshot: L2.steps[1] });
    expect(byId.b.ref).toMatchObject({ lessonNumber: 1, snapshot: L1.steps[2] });
    expect(byId.c.ref).toEqual({ subjectId: 's1', step: 3 });
    expect(byId.d.ref).toEqual({ subjectId: 'en', step: 1 });
    expect(byId.e.ref).toEqual({ subjectId: 's1', step: 1, lessonNumber: 2 });
    expect(history).toHaveBeenCalledWith('r1');
    // Починка записана в базу, а повторный запуск сервер не спрашивает.
    const stored = await useReviews.getState().repo!.all();
    expect(stored.find((x) => x.id === 'b')!.ref).toMatchObject({ lessonNumber: 1 });
    await repairLegacyCards(svc({ lessonHistory: history }));
    expect(history).toHaveBeenCalledTimes(1);
  });

  it('сбой сети не помечает предмет: следующий запуск пробует снова', async () => {
    const failing = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await repairLegacyCards(svc({ lessonHistory: failing }))).toBe(0);
    await repairLegacyCards(svc({ lessonHistory: failing }));
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
