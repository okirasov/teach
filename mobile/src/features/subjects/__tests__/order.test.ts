import { sortByOrder } from '../order';

describe('sortByOrder', () => {
  it('follows the given order and keeps unknown items last in their original order', () => {
    const items = ['x', 's1', 'en', 'y', 'speak'];
    expect(sortByOrder(items, (i) => i, ['en', 'speak', 's1'])).toEqual(['en', 'speak', 's1', 'x', 'y']);
  });
});
