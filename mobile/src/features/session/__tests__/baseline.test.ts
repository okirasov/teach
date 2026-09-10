import { isBaselineCheck } from '../baseline';
import type { LessonStep } from '@/domain/types';

const choice = (correct: number): LessonStep => ({ type: 'choice', prompt: '', options: ['a', 'b'], correct, explain: '', recTitle: '', recNote: '' });
const input = (tokens: string[][]): LessonStep => ({ type: 'input', prompt: '', placeholder: '', answer: '', tokens, explain: '', recTitle: '', recNote: '' });

describe('isBaselineCheck', () => {
  it('marks only real checks of a diagnostic lesson', () => {
    expect(isBaselineCheck({ diagnostic: true }, choice(1))).toBe(true);
    expect(isBaselineCheck({ diagnostic: true }, choice(-1))).toBe(false);
    expect(isBaselineCheck({ diagnostic: true }, input([]))).toBe(false);
    expect(isBaselineCheck({ diagnostic: true }, input([['ciao']]))).toBe(true);
  });
  it('never marks steps of a regular lesson', () => {
    expect(isBaselineCheck({}, choice(1))).toBe(false);
    expect(isBaselineCheck({ diagnostic: false }, input([['ciao']]))).toBe(false);
  });
});
