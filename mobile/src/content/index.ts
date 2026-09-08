import { createLocalContentService } from './local';
import type { ContentService } from './types';

export * from './types';

/**
 * Активный сервис контента. Сервер-оркестратор (бриф §5) подключается здесь:
 * реализация ContentService поверх HTTP, тот же интерфейс для экранов.
 */
export const content: ContentService = createLocalContentService();
