import type { FreeStep, InputStep, Lesson, LessonStep, PracticeStep } from '@/domain/types';

/** Чистая логика сессии — без React и сторов, чтобы тестировать отдельно. */

export interface SessionState {
  subjectId: string;
  lesson: Lesson;
  step: number;
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
  return { subjectId, lesson, step: 0, sel: null, ordSel: [], input: '', checked: false, results: [], cardIds };
}

export function currentStep(s: SessionState): LessonStep {
  return s.lesson.steps[s.step];
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

export function evaluate(s: SessionState): boolean {
  const step = currentStep(s);
  switch (step.type) {
    case 'explain':
      return true;
    case 'choice':
      return step.correct === -1 ? true : s.sel === step.correct;
    case 'order':
      return s.ordSel.length === step.correct.length && s.ordSel.every((v, i) => v === step.correct[i]);
    case 'free': {
      const h = critHits(step, s.input);
      return h.length > 0 && h.every(Boolean);
    }
    case 'input':
      return inputMatches(step, s.input);
  }
}

/** Можно ли нажать основную кнопку (иначе она в состоянии --dis). */
export function canProceed(s: SessionState): boolean {
  const step = currentStep(s);
  if (step.type === 'explain' || s.checked) return true;
  if (step.type === 'choice') return s.sel !== null;
  if (step.type === 'order') return s.ordSel.length === step.items.length;
  return s.input.trim().length > 0;
}

export type PrimaryAction = 'toPractice' | 'answer' | 'next' | 'toRecap';

export function primaryAction(s: SessionState): PrimaryAction {
  const step = currentStep(s);
  if (step.type === 'explain') return isLastStep(s) ? 'toRecap' : 'toPractice';
  if (!s.checked) return 'answer';
  return isLastStep(s) ? 'toRecap' : 'next';
}

export function select(s: SessionState, i: number): SessionState {
  if (s.checked) return s;
  return { ...s, sel: i };
}

export function toggleOrder(s: SessionState, i: number): SessionState {
  if (s.checked) return s;
  const picked = s.ordSel.includes(i);
  return { ...s, ordSel: picked ? s.ordSel.filter((x) => x !== i) : [...s.ordSel, i] };
}

export function setInput(s: SessionState, input: string): SessionState {
  if (s.checked) return s;
  return { ...s, input };
}

/** Основная кнопка: Ответить → фиксирует попытку; Дальше → следующий шаг; К разбору → finished. */
export function primary(s: SessionState): { state: SessionState; finished: boolean } {
  if (!canProceed(s)) return { state: s, finished: false };
  const step = currentStep(s);
  if (step.type !== 'explain' && !s.checked) {
    return { state: { ...s, checked: true, results: [...s.results, evaluate(s)] }, finished: false };
  }
  if (isLastStep(s)) return { state: s, finished: true };
  return { state: { ...s, step: s.step + 1, sel: null, ordSel: [], input: '', checked: false }, finished: false };
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
