import { checkForUpdate } from '../useUpdateNudge';

describe('checkForUpdate', () => {
  it('returns the newer build with its url', async () => {
    const svc = { latestApp: async () => ({ ios: { build: 18, url: 'itms-beta://' } }) };
    expect(await checkForUpdate(svc, '17')).toEqual({ build: 18, url: 'itms-beta://' });
  });
  it('returns null when nothing is newer, the stub knows nothing, or the network fails', async () => {
    expect(await checkForUpdate({ latestApp: async () => ({ ios: { build: 17, url: 'x' } }) }, '17')).toBeNull();
    expect(await checkForUpdate({ latestApp: async () => null }, '17')).toBeNull();
    expect(await checkForUpdate({ latestApp: async () => { throw new Error('offline'); } }, '17')).toBeNull();
  });
});
