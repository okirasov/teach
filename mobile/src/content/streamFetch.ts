import { fetch as expoFetch } from 'expo/fetch';

/**
 * fetch со стримингом тела ответа (response.body как ReadableStream): у RN-fetch его нет,
 * у expo/fetch есть на iOS, Android и web. Вынесен отдельно, чтобы jest подменял через fetchFn.
 */
export const streamFetch = expoFetch as unknown as typeof fetch;
