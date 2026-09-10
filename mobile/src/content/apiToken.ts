import { secureStorage } from '@/features/auth/secureStorage';

/**
 * Токен доступа к серверу. Общий токен из сборки (EXPO_PUBLIC_CONTENT_TOKEN) — запасной:
 * им ходят сборки до входа. После входа по Apple сервер выдаёт токен, привязанный к аккаунту,
 * и дальше запросы идут с ним — предметы одного человека не видны другому.
 */
const KEY = 'teach.apiToken';

const buildToken = process.env.EXPO_PUBLIC_CONTENT_TOKEN?.trim() || undefined;

let current: string | undefined = buildToken;

/** Токен для заголовка Authorization. */
export function apiToken(): string | undefined {
  return current;
}

/** Читает сохранённый токен аккаунта при старте приложения. */
export async function hydrateApiToken(): Promise<void> {
  const saved = await secureStorage.get(KEY).catch(() => null);
  if (saved) current = saved;
}

export async function setApiToken(token: string): Promise<void> {
  current = token;
  await secureStorage.set(KEY, token).catch(() => {});
}

/** Выход: возвращаемся к общему токену сборки, аккаунтный удаляем. */
export async function clearApiToken(): Promise<void> {
  current = buildToken;
  await secureStorage.remove(KEY).catch(() => {});
}

/**
 * Меняет identityToken от Apple на токен сервера, привязанный к аккаунту.
 * Ошибка не блокирует вход: приложение продолжает работать с общим токеном сборки.
 */
export async function exchangeAppleToken(baseUrl: string, identityToken: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  if (!identityToken) return false;
  try {
    const res = await fetchFn(`${baseUrl.replace(/\/+$/, '')}/auth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identityToken }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { token?: string };
    if (!body?.token) return false;
    await setApiToken(body.token);
    return true;
  } catch {
    return false;
  }
}
