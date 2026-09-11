import { demoLessons } from '@/domain/seed';
import { currentDemoLesson, demoHasNext, getLesson, reviewStep, useProgress } from '../progress';

beforeEach(() => useProgress.setState(useProgress.getInitialState(), true));

describe('цепочка уроков демо', () => {
  it('идёт по порядку, открывает следующий урок сразу и останавливается на последнем', () => {
    const chain = demoLessons.en;
    expect(currentDemoLesson(useProgress.getState(), 'en')?.number).toBe(chain[0].number);
    for (let i = 1; i < chain.length; i += 1) {
      useProgress.getState().markDone('en', []);
      expect(demoHasNext(useProgress.getState(), 'en')).toBe(true);
      useProgress.getState().advanceDemo('en');
      expect(currentDemoLesson(useProgress.getState(), 'en')?.number).toBe(chain[i].number);
      expect(useProgress.getState().done.en).toBe(false);
      expect(getLesson(useProgress.getState(), 'en', 'Повторы')).toBe(chain[i].lesson);
    }
    expect(demoHasNext(useProgress.getState(), 'en')).toBe(false);
    useProgress.getState().advanceDemo('en');
    expect(currentDemoLesson(useProgress.getState(), 'en')?.number).toBe(chain[chain.length - 1].number);
  });

  it('старая карточка демо без номера урока берёт шаг из первого урока цепочки', () => {
    useProgress.getState().advanceDemo('en');
    expect(reviewStep(useProgress.getState(), 'en', 1, undefined, 'Повторы')).toBe(demoLessons.en[0].lesson.steps[1]);
  });
});
