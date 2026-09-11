import { useSession } from '../session';

describe('«Сомневаюсь»', () => {
  it('is a toggle: an accidental tap is undone by tapping again', () => {
    useSession.getState().end();
    useSession.getState().doubt(2);
    expect(useSession.getState().doubts[2]).toBe(true);
    useSession.getState().doubt(2);
    expect(useSession.getState().doubts[2]).toBe(false);
  });
});
