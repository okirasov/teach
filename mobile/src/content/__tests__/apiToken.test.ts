const mockStore = new Map<string, string>();
jest.mock('@/features/auth/secureStorage', () => ({
  secureStorage: {
    get: async (k: string) => mockStore.get(k) ?? null,
    set: async (k: string, v: string) => void mockStore.set(k, v),
    remove: async (k: string) => void mockStore.delete(k),
  },
}));

import { apiToken, clearApiToken, exchangeAppleToken, hydrateApiToken, setApiToken } from '../apiToken';

beforeEach(async () => {
  mockStore.clear();
  await clearApiToken();
});

const fetchOk = (token: string) =>
  (async () => ({ ok: true, status: 200, json: async () => ({ token, ownerId: 'apple:sub-1' }) })) as unknown as typeof fetch;

describe('токен доступа к серверу', () => {
  it('обмен Apple-токена даёт токен аккаунта и сохраняет его', async () => {
    expect(await exchangeAppleToken('http://srv/', 'apple-jwt', fetchOk('acct-1'))).toBe(true);
    expect(apiToken()).toBe('acct-1');
    // Переживает перезапуск.
    await setApiToken('acct-1');
    await clearApiToken();
    mockStore.set('teach.apiToken', 'acct-1');
    await hydrateApiToken();
    expect(apiToken()).toBe('acct-1');
  });

  it('сбой обмена не ломает вход: остаётся токен сборки', async () => {
    const bad = (async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await exchangeAppleToken('http://srv', 'apple-jwt', bad)).toBe(false);
    const boom = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await exchangeAppleToken('http://srv', 'apple-jwt', boom)).toBe(false);
    expect(await exchangeAppleToken('http://srv', '', fetchOk('x'))).toBe(false);
  });

  it('выход убирает токен аккаунта', async () => {
    await setApiToken('acct-1');
    expect(apiToken()).toBe('acct-1');
    await clearApiToken();
    expect(apiToken()).toBeUndefined();
    expect(mockStore.has('teach.apiToken')).toBe(false);
  });
});
