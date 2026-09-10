import { apiToken } from './apiToken';
import { createHttpContentService } from './http';
import { createLocalContentService } from './local';
import type { ContentService } from './types';

export * from './types';

/** Базовый адрес сервера-оркестратора (server/Teach.Api). Без него — локальная заглушка прототипа. */
export const contentUrl = process.env.EXPO_PUBLIC_CONTENT_URL?.trim() || null;

/**
 * Активный сервис контента. Сервер подключается через EXPO_PUBLIC_CONTENT_URL,
 * интерфейс для экранов тот же.
 */
export const content: ContentService = contentUrl
  ? createHttpContentService({ baseUrl: contentUrl, token: apiToken })
  : createLocalContentService();

export { apiToken, clearApiToken, exchangeAppleToken, hydrateApiToken, setApiToken } from './apiToken';
