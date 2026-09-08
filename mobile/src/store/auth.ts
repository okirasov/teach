import { create } from 'zustand';

import { clearSession, loadSession, saveSession } from '@/features/auth/session';
import type { Account, Session } from '@/features/auth/types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthState {
  status: AuthStatus;
  account: Account | null;
  /** Читает сессию из SecureStore при старте. */
  hydrate: () => Promise<void>;
  signIn: (session: Session) => Promise<void>;
  /** Сбрасывает только токен; локальная БД остаётся. */
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  account: null,
  hydrate: async () => {
    const session = await loadSession().catch(() => null);
    set(session ? { status: 'signedIn', account: session.account } : { status: 'signedOut', account: null });
  },
  signIn: async (session) => {
    await saveSession(session);
    set({ status: 'signedIn', account: session.account });
  },
  signOut: async () => {
    await clearSession();
    set({ status: 'signedOut', account: null });
  },
}));
