import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef } from 'react';

import { AuthCancelled, googleClientIds, googleSessionFromToken, isGoogleConfigured, localDevSession } from './providers';
import type { Session } from './types';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google-вход через expo-auth-session. Без client id (переменные
 * EXPO_PUBLIC_GOOGLE_*_CLIENT_ID) в dev-сборке возвращает локальную сессию.
 */
export function useGoogleSignIn(): () => Promise<Session> {
  const configured = isGoogleConfigured();
  const [request, response, promptAsync] = Google.useAuthRequest(
    configured ? googleClientIds : { webClientId: 'unconfigured.apps.googleusercontent.com' },
  );
  const pending = useRef<{ resolve: (s: Session) => void; reject: (e: Error) => void } | null>(null);

  useEffect(() => {
    if (!response || !pending.current) return;
    const p = pending.current;
    pending.current = null;
    if (response.type === 'success' && response.authentication?.accessToken) {
      googleSessionFromToken(response.authentication.accessToken).then(p.resolve, p.reject);
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      p.reject(new AuthCancelled());
    } else {
      p.reject(new Error('google-auth-failed'));
    }
  }, [response]);

  return useCallback(async () => {
    if (!configured) {
      if (__DEV__) return localDevSession('google');
      throw new Error('google-unconfigured');
    }
    if (!request) throw new Error('google-not-ready');
    return new Promise<Session>((resolve, reject) => {
      pending.current = { resolve, reject };
      promptAsync().catch(reject);
    });
  }, [configured, request, promptAsync]);
}
