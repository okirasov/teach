import type { ReviewCard } from '@/domain/reviewCard';
import { REVIEW_ID } from '@/store/progress';
import type { SessionState } from './engine';

/**
 * Предмет текущего шага. В сессии повторов шаги собраны из карточек разных предметов
 * (все шаги — практика, cardIds[i] ↔ шаг i), поэтому язык распознавания и озвучки,
 * а также настройки голоса берутся у предмета карточки, а не у «Повторов».
 */
export function stepSubjectId(s: Pick<SessionState, 'step' | 'cardIds'> | null, cards: Pick<ReviewCard, 'id' | 'subjectId'>[], id: string): string {
  if (id !== REVIEW_ID || !s?.cardIds) return id;
  const cardId = s.cardIds[s.step];
  return cards.find((c) => c.id === cardId)?.subjectId ?? id;
}
