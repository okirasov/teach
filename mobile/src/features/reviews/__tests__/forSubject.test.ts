import { forSubject } from '../queue';

describe('forSubject', () => {
  it('returns only the cards of one subject, or all cards without an id', () => {
    const cards = [{ id: 'a', subjectId: 'en' }, { id: 'b', subjectId: 's1' }, { id: 'c', subjectId: 'en' }];
    expect(forSubject(cards, 'en').map((c) => c.id)).toEqual(['a', 'c']);
    expect(forSubject(cards)).toBe(cards);
  });
});
