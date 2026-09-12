/**
 * Состояние бадди в сессии (spec: docs/superpowers/specs/2026-09-12-buddy-dock-design.md).
 * Чистая функция над уже существующими флагами сессии; приоритеты при наложении:
 * слушает > читает пример > думает > реакция > читайте > ваш ход.
 */
export type BuddyState = 'reading' | 'waiting' | 'listening' | 'speaking' | 'thinking' | 'right' | 'partial' | 'wrong';

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
}

export const REACTIONS: ReadonlySet<BuddyState> = new Set<BuddyState>(['right', 'partial', 'wrong']);

const REACTION_OF: Record<FeedbackTone, BuddyState> = { mint: 'right', amber: 'partial', err: 'wrong' };

export function buddyStateOf(i: BuddyInput): BuddyState {
  if (i.rec) return 'listening';
  if (i.speaking) return 'speaking';
  if (i.grading) return 'thinking';
  if (i.viewingPast || i.stepType === 'explain') return 'reading';
  if (i.checked && i.tone) return REACTION_OF[i.tone];
  return 'waiting';
}
