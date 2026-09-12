import { buddyStateOf, REACTIONS, type BuddyInput } from '../buddyState';

const base: BuddyInput = { stepType: 'free', checked: false, viewingPast: false, rec: false, speaking: false, grading: false, tone: null };

describe('buddyStateOf', () => {
  it('reads on explain steps and on past steps', () => {
    expect(buddyStateOf({ ...base, stepType: 'explain' })).toBe('reading');
    expect(buddyStateOf({ ...base, checked: true, tone: 'mint', viewingPast: true })).toBe('reading');
  });
  it('waits on an unchecked practice step', () => {
    expect(buddyStateOf(base)).toBe('waiting');
    expect(buddyStateOf({ ...base, stepType: 'choice' })).toBe('waiting');
  });
  it('maps flags to listening, speaking, thinking', () => {
    expect(buddyStateOf({ ...base, rec: true })).toBe('listening');
    expect(buddyStateOf({ ...base, speaking: true })).toBe('speaking');
    expect(buddyStateOf({ ...base, grading: true })).toBe('thinking');
  });
  it('maps the feedback tone to a reaction', () => {
    expect(buddyStateOf({ ...base, checked: true, tone: 'mint' })).toBe('right');
    expect(buddyStateOf({ ...base, checked: true, tone: 'amber' })).toBe('partial');
    expect(buddyStateOf({ ...base, checked: true, tone: 'err' })).toBe('wrong');
  });
  it('falls back to waiting when checked without a tone', () => {
    expect(buddyStateOf({ ...base, checked: true })).toBe('waiting');
  });
  it('applies priorities: listening > speaking > thinking > reaction > reading', () => {
    expect(buddyStateOf({ ...base, rec: true, speaking: true, grading: true, checked: true, tone: 'err' })).toBe('listening');
    expect(buddyStateOf({ ...base, speaking: true, grading: true, checked: true, tone: 'err' })).toBe('speaking');
    expect(buddyStateOf({ ...base, grading: true, checked: true, tone: 'err' })).toBe('thinking');
    expect(buddyStateOf({ ...base, speaking: true, checked: true, tone: 'mint' })).toBe('speaking');
    expect(buddyStateOf({ ...base, speaking: true, stepType: 'explain' })).toBe('speaking');
    expect(buddyStateOf({ ...base, speaking: true, viewingPast: true, checked: true, tone: 'mint' })).toBe('speaking');
  });
  it('lists reactions', () => {
    expect([...REACTIONS].sort()).toEqual(['partial', 'right', 'wrong']);
  });
});
