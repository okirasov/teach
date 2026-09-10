import { REVIEW_ID } from '@/store/progress';
import { stepSubjectId } from '../stepSubject';

const cards = [
  { id: 'c1', subjectId: 'en' },
  { id: 'c2', subjectId: 'custom' },
];

describe('stepSubjectId', () => {
  it('returns the card subject for the current review step', () => {
    expect(stepSubjectId({ step: 0, cardIds: ['c1', 'c2'] }, cards, REVIEW_ID)).toBe('en');
    expect(stepSubjectId({ step: 1, cardIds: ['c1', 'c2'] }, cards, REVIEW_ID)).toBe('custom');
  });
  it('falls back to the session id outside reviews or when the card is unknown', () => {
    expect(stepSubjectId({ step: 0, cardIds: ['c1'] }, cards, 'hist')).toBe('hist');
    expect(stepSubjectId({ step: 0, cardIds: ['zzz'] }, cards, REVIEW_ID)).toBe(REVIEW_ID);
    expect(stepSubjectId(null, cards, REVIEW_ID)).toBe(REVIEW_ID);
  });
});
