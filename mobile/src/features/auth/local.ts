import type { Provider, Session } from './types';

/**
 * Локальный вход для разработки: провайдер не сконфигурирован
 * (нет client id, Android без Apple, web) — сессия с локальным id.
 * В production-сборке недоступен.
 */
export function localDevSession(provider: Provider): Session {
  return { account: { id: `local-${provider}`, name: 'Олег', provider }, token: 'local-dev-token' };
}

/** EXPO_PUBLIC_AUTH_LOCAL=1 — dev-сборка входит локально сама, без провайдера (симулятор, автотесты). */
export function autoLocalSignIn(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_AUTH_LOCAL === '1';
}
