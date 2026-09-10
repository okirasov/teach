import type { FreeStep, InputStep, Lesson, LessonStep, PracticeStep } from '@/domain/types';

/** Чистая логика сессии — без React и сторов, чтобы тестировать отдельно. */

/** Ответ на один шаг: живой у текущего, замороженный у пройденных. */
export interface StepAnswer {
  sel: number | null;
  ordSel: number[];
  input: string;
  checked: boolean;
}

const EMPTY_ANSWER: StepAnswer = { sel: null, ordSel: [], input: '', checked: false };

export interface SessionState {
  subjectId: string;
  lesson: Lesson;
  /** Активный шаг — самый дальний достигнутый. */
  step: number;
  /** Показанный шаг: свайпом можно вернуться к пройденным (view < step), вперёд дальше активного нельзя. */
  view: number;
  /** Ответы пройденных шагов по индексу шага (answers[i] для i < step). */
  answers: StepAnswer[];
  /** Выбранный вариант (choice). */
  sel: number | null;
  /** Порядок нажатых элементов (order). */
  ordSel: number[];
  input: string;
  checked: boolean;
  /** Результат каждого практического шага в порядке прохождения. */
  results: boolean[];
  /** Для сессии повторов: id карточки на каждый практический шаг. */
  cardIds?: string[];
}

export function startSession(subjectId: string, lesson: Lesson, cardIds?: string[]): SessionState {
  return { subjectId, lesson, step: 0, view: 0, answers: [], sel: null, ordSel: [], input: '', checked: false, results: [], cardIds };
}

export function currentStep(s: SessionState): LessonStep {
  return s.lesson.steps[s.step];
}

/** Шаг на экране (может быть пройденным). */
export function viewedStep(s: SessionState): LessonStep {
  return s.lesson.steps[s.view];
}

export function isViewingPast(s: SessionState): boolean {
  return s.view < s.step;
}

export function answerAt(s: SessionState, i: number): StepAnswer {
  if (i === s.step) return { sel: s.sel, ordSel: s.ordSel, input: s.input, checked: s.checked };
  return s.answers[i] ?? EMPTY_ANSWER;
}

/** Свайп назад: к предыдущему шагу, вплоть до первого. */
export function goBack(s: SessionState): SessionState {
  return s.view > 0 ? { ...s, view: s.view - 1 } : s;
}

/** Свайп вперёд: по пройденным шагам до активного; с активного — только если он отвечен (как «Дальше»), но не в разбор. */
export function goForward(s: SessionState): SessionState {
  if (isViewingPast(s)) return { ...s, view: s.view + 1 };
  const step = currentStep(s);
  if ((step.type === 'explain' || s.checked) && !isLastStep(s)) return primary(s).state;
  return s;
}

export function isLastStep(s: SessionState): boolean {
  return s.step + 1 >= s.lesson.steps.length;
}

export function practiceSteps(lesson: Lesson): PracticeStep[] {
  return lesson.steps.filter((st): st is PracticeStep => st.type !== 'explain');
}

/** Какие критерии свободного ответа встретились в тексте. */
export function critHits(step: FreeStep, input: string): boolean[] {
  const txt = input.toLowerCase();
  return step.criteria.map((c) => c.keys.some((k) => txt.includes(k)));
}

/** Проверка ввода по группам токенов; пустой список токенов принимает любой текст. */
export function inputMatches(step: InputStep, input: string): boolean {
  const t = input.toLowerCase().replace(/[’']/g, "'");
  return step.tokens.every((group) => group.some((v) => t.includes(v)));
}

export function evaluateStep(step: LessonStep, a: Pick<StepAnswer, 'sel' | 'ordSel' | 'input'>): boolean {
  switch (step.type) {
    case 'explain':
      return true;
    case 'choice':
      return step.correct === -1 ? true : a.sel === step.correct;
    case 'order':
      return a.ordSel.length === step.correct.length && a.ordSel.every((v, i) => v === step.correct[i]);
    case 'free': {
      const h = critHits(step, a.input);
      return h.length > 0 && h.every(Boolean);
    }
    case 'input':
      return inputMatches(step, a.input);
  }
}

export function evaluate(s: SessionState): boolean {
  return evaluateStep(currentStep(s), s);
}

/** Можно ли нажать основную кнопку (иначе она в состоянии --dis). */
export function canProceed(s: SessionState): boolean {
  if (isViewingPast(s)) return true;
  const step = currentStep(s);
  if (step.type === 'explain' || s.checked) return true;
  if (step.type === 'choice') return s.sel !== null;
  if (step.type === 'order') return s.ordSel.length === step.items.length;
  return s.input.trim().length > 0;
}

export type PrimaryAction = 'toPractice' | 'answer' | 'next' | 'toRecap' | 'toCurrent';

export function primaryAction(s: SessionState): PrimaryAction {
  if (isViewingPast(s)) return 'toCurrent';
  const step = currentStep(s);
  if (step.type === 'explain') return isLastStep(s) ? 'toRecap' : 'toPractice';
  if (!s.checked) return 'answer';
  return isLastStep(s) ? 'toRecap' : 'next';
}

export function select(s: SessionState, i: number): SessionState {
  if (s.checked || isViewingPast(s)) return s;
  return { ...s, sel: i };
}

export function toggleOrder(s: SessionState, i: number): SessionState {
  if (s.checked || isViewingPast(s)) return s;
  const picked = s.ordSel.includes(i);
  return { ...s, ordSel: picked ? s.ordSel.filter((x) => x !== i) : [...s.ordSel, i] };
}

export function setInput(s: SessionState, input: string): SessionState {
  if (s.checked || isViewingPast(s)) return s;
  return { ...s, input };
}

/** Основная кнопка: Ответить → фиксирует попытку; Дальше → следующий шаг; К разбору → finished. */
export function primary(s: SessionState): { state: SessionState; finished: boolean } {
  if (!canProceed(s)) return { state: s, finished: false };
  // С пройденного шага кнопка возвращает к активному.
  if (isViewingPast(s)) return { state: { ...s, view: s.step }, finished: false };
  const step = currentStep(s);
  if (step.type !== 'explain' && !s.checked) {
    return { state: { ...s, checked: true, results: [...s.results, evaluate(s)] }, finished: false };
  }
  if (isLastStep(s)) return { state: s, finished: true };
  const answers = [...s.answers];
  answers[s.step] = answerAt(s, s.step);
  return { state: { ...s, answers, step: s.step + 1, view: s.step + 1, sel: null, ordSel: [], input: '', checked: false }, finished: false };
}

export interface RecapRecord {
  title: string;
  note: string;
  ok: boolean;
  /** Индекс шага в уроке — ссылка, по которой вопрос можно задать снова. */
  stepIndex: number;
  /** Карточка, если сессия была повтором. */
  cardId?: string;
}

/** Записи для разбора: каждая практика → запись + результат. */
export function recapRecords(s: SessionState): RecapRecord[] {
  const out: RecapRecord[] = [];
  s.lesson.steps.forEach((st, stepIndex) => {
    if (st.type === 'explain') return;
    const i = out.length;
    out.push({ title: st.recTitle, note: st.recNote, ok: !!s.results[i], stepIndex, cardId: s.cardIds?.[i] });
  });
  return out;
}
