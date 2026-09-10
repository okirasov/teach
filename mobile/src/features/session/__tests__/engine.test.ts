import { customLesson, seedLessons } from '@/domain/seed';
import type { FreeStep } from '@/domain/types';
import {
  answerAt,
  canProceed,
  critHits,
  evaluate,
  goBack,
  goForward,
  isViewingPast,
  primary,
  primaryAction,
  recapRecords,
  restoreSession,
  snapshot,
  select,
  setInput,
  startSession,
  toggleOrder,
} from '../engine';

describe('session engine · english lesson (explain → choice → input)', () => {
  it('walks the CTA chain: К практике → Ответить → Дальше → Ответить → К разбору', () => {
    let s = startSession('en', seedLessons.en);
    expect(primaryAction(s)).toBe('toPractice');
    expect(canProceed(s)).toBe(true);
    s = primary(s).state;
    expect(s.step).toBe(1);

    expect(canProceed(s)).toBe(false);
    expect(primary(s).state).toBe(s); // disabled button does nothing
    s = select(s, 1);
    expect(primaryAction(s)).toBe('answer');
    s = primary(s).state;
    expect(s.checked).toBe(true);
    expect(s.results).toEqual([true]);
    expect(select(s, 0).sel).toBe(1); // locked after check
    expect(primaryAction(s)).toBe('next');
    s = primary(s).state;
    expect(s.step).toBe(2);
    expect(s.checked).toBe(false);

    s = setInput(s, "If I were you, I wouldn't rush");
    expect(canProceed(s)).toBe(true);
    s = primary(s).state;
    expect(s.results).toEqual([true, true]);
    expect(primaryAction(s)).toBe('toRecap');
    const r = primary(s);
    expect(r.finished).toBe(true);
    expect(recapRecords(r.state)).toEqual([
      { title: 'После if не бывает would', note: expect.any(String), ok: true, stepIndex: 1, cardId: undefined },
      { title: 'Рамка совета If I were you…', note: expect.any(String), ok: true, stepIndex: 2, cardId: undefined },
    ]);
  });

  it('marks a wrong choice and a wrong input as failures', () => {
    let s = primary(startSession('en', seedLessons.en)).state;
    s = primary(select(s, 2)).state;
    expect(s.results).toEqual([false]);
    s = primary(s).state;
    s = primary(setInput(s, 'I would not rush')).state; // missing "if i were"
    expect(s.results).toEqual([false, false]);
  });

  it('input tokens are case-insensitive and normalise apostrophes', () => {
    let s = primary(startSession('en', seedLessons.en)).state;
    s = primary(select(s, 1)).state;
    s = primary(s).state;
    s = setInput(s, 'IF I WERE you I WOULDN’T rush');
    expect(evaluate(s)).toBe(true);
  });
});

describe('session engine · history lesson (order, free)', () => {
  it('order step needs every item picked and in the right sequence', () => {
    let s = primary(startSession('hist', seedLessons.hist)).state;
    s = toggleOrder(s, 1);
    s = toggleOrder(s, 0);
    expect(canProceed(s)).toBe(false);
    s = toggleOrder(s, 3);
    s = toggleOrder(s, 2);
    expect(canProceed(s)).toBe(true);
    expect(evaluate(s)).toBe(true);
    s = toggleOrder(s, 2); // unpick
    expect(s.ordSel).toEqual([1, 0, 3]);
    s = toggleOrder(s, 2);
    s = primary(s).state;
    expect(s.results).toEqual([true]);
  });

  it('free step scores criteria by keywords', () => {
    let s = primary(startSession('hist', seedLessons.hist)).state;
    s = primary(toggleOrder(toggleOrder(toggleOrder(toggleOrder(s, 0), 1), 2), 3)).state; // wrong order
    s = primary(s).state;
    const step = s.lesson.steps[s.step] as FreeStep;
    s = setInput(s, 'Восток был богатым, Константинополь за стенами');
    expect(critHits(step, s.input)).toEqual([true, true, false]);
    expect(evaluate(s)).toBe(false);
    s = setInput(s, s.input + ', а варвары били по Западу');
    expect(evaluate(s)).toBe(true);
  });
});

describe('session engine · diagnostic lesson', () => {
  it('calibration choice and empty-token input are always accepted', () => {
    let s = primary(startSession('custom', customLesson('SQL', 'отчёты'))).state;
    s = primary(select(s, 0)).state;
    expect(s.results).toEqual([true]);
    s = primary(s).state;
    s = primary(setInput(s, 'что-то знаю')).state;
    expect(s.results).toEqual([true, true]);
  });
});

describe('session engine · browsing past steps', () => {
  it('freezes answers of passed steps, swipes back and forward, and never past the active unanswered step', () => {
    const lesson = seedLessons.en;
    let s = startSession('en', lesson);
    s = primary(s).state; // explain → choice
    s = select(s, 1);
    s = primary(s).state; // answered
    s = primary(s).state; // → input (active, unanswered)
    expect(s.step).toBe(2);
    expect(s.view).toBe(2);
    expect(goForward(s).view).toBe(2); // вперёд с неотвеченного нельзя

    s = goBack(s);
    expect(s.view).toBe(1);
    expect(isViewingPast(s)).toBe(true);
    expect(answerAt(s, 1)).toEqual({ sel: 1, ordSel: [], input: '', checked: true });
    expect(primaryAction(s)).toBe('toCurrent');
    expect(select(s, 0)).toBe(s); // пройденный шаг не редактируется
    expect(setInput(s, 'x')).toBe(s);

    s = goBack(s);
    expect(s.view).toBe(0);
    expect(goBack(s).view).toBe(0);
    s = goForward(s);
    expect(s.view).toBe(1);
    s = primary(s).state; // кнопка «К текущему шагу»
    expect(s.view).toBe(2);
    expect(s.step).toBe(2);
    // ответы на активном шаге живые
    s = setInput(s, 'had');
    expect(answerAt(s, 2).input).toBe('had');
  });

  it('swipe forward on an answered active step behaves like «Дальше», but not into the recap', () => {
    const lesson = seedLessons.en;
    let s = startSession('en', lesson);
    s = goForward(s); // explain → practice
    expect(s.step).toBe(1);
    s = select(s, 1);
    expect(goForward(s).step).toBe(1); // не отвечено
    s = primary(s).state;
    s = goForward(s);
    expect(s.step).toBe(2);
    s = setInput(s, 'had');
    s = primary(s).state; // answered, last step
    expect(goForward(s).step).toBe(2); // в разбор только кнопкой
    expect(primary(s).finished).toBe(true);
  });
});

describe('session engine · resume after closing', () => {
  it('a snapshot restores the same lesson at the active step with frozen answers, and rejects another lesson', () => {
    const lesson = seedLessons.en;
    let s = startSession('en', lesson);
    s = primary(s).state;
    s = select(s, 1);
    s = primary(s).state;
    s = primary(s).state; // active: input step
    s = setInput(s, 'ha');
    const saved = snapshot(s);
    const r = restoreSession('en', lesson, saved)!;
    expect(r.step).toBe(2);
    expect(r.view).toBe(2);
    expect(r.input).toBe('ha');
    expect(answerAt(r, 1)).toEqual({ sel: 1, ordSel: [], input: '', checked: true });
    expect(r.results).toEqual([true]);
    expect(restoreSession('hist', seedLessons.hist, saved)).toBeNull();
    expect(restoreSession('en', lesson, undefined)).toBeNull();
    // повторы: другой набор карточек — заново
    expect(restoreSession('review', lesson, { ...saved, cardIds: ['a'] }, ['b'])).toBeNull();
  });
});
