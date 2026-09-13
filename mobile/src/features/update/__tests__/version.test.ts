import { isNewer } from '../version';

describe('isNewer', () => {
  it('compares build numbers as integers', () => {
    expect(isNewer('17', 18)).toBe(true);
    expect(isNewer('18', 18)).toBe(false);
    expect(isNewer('19', 18)).toBe(false);
    expect(isNewer(17, 18)).toBe(true);
  });
  it('stays quiet when either side is unknown', () => {
    expect(isNewer(undefined, 18)).toBe(false);
    expect(isNewer('abc', 18)).toBe(false);
    expect(isNewer('17', 0)).toBe(false);
    expect(isNewer('17', NaN)).toBe(false);
  });
});
