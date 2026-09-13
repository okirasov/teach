/**
 * Состояние бадди в сессии (spec: docs/superpowers/specs/2026-09-12-buddy-dock-design.md).
 * Чистая функция над уже существующими флагами сессии; приоритеты при наложении:
 * слушает > читает пример > думает > читайте (объяснение или пройденный шаг) > реакция > ваш ход.
 */
export type BuddyState = 'reading' | 'waiting' | 'listening' | 'speaking' | 'thinking' | 'right' | 'partial' | 'wrong' | 'accepted';

export type FeedbackTone = 'mint' | 'amber' | 'err';

export interface BuddyInput {
  stepType: 'explain' | 'choice' | 'input' | 'free' | 'order';
  checked: boolean;
  viewingPast: boolean;
  rec: boolean;
  speaking: boolean;
  grading: boolean;
  /** Тон фидбек-карточки после проверки; null, пока шаг не проверен. */
  tone: FeedbackTone | null;
  /**
   * Шаг без оценки: принимает любой ответ (калибровка, свободный рассказ) или это промах
   * на стартовой диагностике, где «ошибка не ошибка». После проверки док говорит «Принято».
   */
  neutral: boolean;
}

export const REACTIONS: ReadonlySet<BuddyState> = new Set<BuddyState>(['right', 'partial', 'wrong', 'accepted']);

const REACTION_OF: Record<FeedbackTone, BuddyState> = { mint: 'right', amber: 'partial', err: 'wrong' };

export function buddyStateOf(i: BuddyInput): BuddyState {
  if (i.rec) return 'listening';
  if (i.speaking) return 'speaking';
  if (i.grading) return 'thinking';
  if (i.viewingPast || i.stepType === 'explain') return 'reading';
  if (i.checked && i.neutral) return 'accepted';
  if (i.checked && i.tone) return REACTION_OF[i.tone];
  return 'waiting';
}
