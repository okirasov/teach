import { create } from 'zustand';

import { clearApiToken, contentUrl, exchangeAppleToken, hydrateApiToken } from '@/content';
import { cancelReminders } from '@/features/reminders/notifications';
import { autoLocalSignIn, localDevSession } from '@/features/auth/local';
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
    // Токен аккаунта живёт рядом с сессией: подтягиваем до первых запросов к серверу.
    await hydrateApiToken();
    let session = await loadSession().catch(() => null);
    if (!session && autoLocalSignIn()) {
      session = localDevSession('apple');
      await saveSession(session).catch(() => {});
    }
    set(session ? { status: 'signedIn', account: session.account } : { status: 'signedOut', account: null });
  },
  signIn: async (session) => {
    await saveSession(session);
    // Токен, привязанный к аккаунту: без него предметы разных людей лежали бы под общим токеном.
    // Обмен не блокирует вход — при сбое остаётся общий токен сборки.
    if (contentUrl && session.account.provider === 'apple') await exchangeAppleToken(contentUrl, session.token);
    set({ status: 'signedIn', account: session.account });
  },
  signOut: async () => {
    await clearSession();
    await clearApiToken();
    await cancelReminders();
    set({ status: 'signedOut', account: null });
  },
}));
