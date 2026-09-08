import * as SecureStore from 'expo-secure-store';

import { useAuth } from '@/store/auth';
import { clearSession, loadSession, rememberedName, saveSession } from '../session';
import type { Session } from '../types';

jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => mem.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void mem.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void mem.delete(k)),
    __mem: mem,
  };
});

const mem = (SecureStore as unknown as { __mem: Map<string, string> }).__mem;
const session: Session = { account: { id: 'u1', name: 'Олег', provider: 'apple' }, token: 'tok' };

beforeEach(() => mem.clear());

describe('session storage', () => {
  it('round-trips a session and remembers the name per account', async () => {
    await saveSession(session);
    expect(await loadSession()).toEqual(session);
    expect(await rememberedName('u1')).toBe('Олег');
  });

  it('returns null for missing or corrupt data', async () => {
    expect(await loadSession()).toBeNull();
    mem.set('teach.session', '{not json');
    expect(await loadSession()).toBeNull();
    mem.set('teach.session', JSON.stringify({ account: {} }));
    expect(await loadSession()).toBeNull();
  });

  it('clearSession drops the token but keeps the remembered name', async () => {
    await saveSession(session);
    await clearSession();
    expect(await loadSession()).toBeNull();
    expect(await rememberedName('u1')).toBe('Олег');
  });
});

describe('auth store', () => {
  it('hydrates to signedOut when nothing is stored', async () => {
    await useAuth.getState().hydrate();
    expect(useAuth.getState().status).toBe('signedOut');
  });

  it('signIn persists and hydrate restores it; signOut resets to signedOut', async () => {
    await useAuth.getState().signIn(session);
    expect(useAuth.getState()).toMatchObject({ status: 'signedIn', account: session.account });

    useAuth.setState({ status: 'loading', account: null });
    await useAuth.getState().hydrate();
    expect(useAuth.getState()).toMatchObject({ status: 'signedIn', account: session.account });

    await useAuth.getState().signOut();
    expect(useAuth.getState()).toMatchObject({ status: 'signedOut', account: null });
    expect(mem.has('teach.session')).toBe(false);
  });
});
