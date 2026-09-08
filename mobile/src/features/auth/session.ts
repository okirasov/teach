import { secureStorage } from './secureStorage';
import type { Session } from './types';

const SESSION_KEY = 'teach.session';
/** Имя, которое Apple отдаёт только при первом входе — храним отдельно, чтобы не потерять после выхода. */
const NAME_KEY_PREFIX = 'teach.name.';

export async function loadSession(): Promise<Session | null> {
  const raw = await secureStorage.get(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.account?.id || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await secureStorage.set(SESSION_KEY, JSON.stringify(session));
  await secureStorage.set(NAME_KEY_PREFIX + session.account.id, session.account.name);
}

/** Выход сбрасывает только сессию (токен). Локальная БД и запомненные имена остаются. */
export async function clearSession(): Promise<void> {
  await secureStorage.remove(SESSION_KEY);
}

export async function rememberedName(accountId: string): Promise<string | null> {
  return secureStorage.get(NAME_KEY_PREFIX + accountId);
}
