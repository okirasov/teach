import { customLesson, topicKind } from '@/domain/seed';
import type { TopicKind } from '@/domain/types';
import type { ContentService, FocusOption, PlanStage, PrepStage, SourceCandidate } from './types';

/** Интервал между этапами подготовки в прототипе. */
export const PREP_STAGE_MS = 1800;

const focusByKind: Record<TopicKind, (topic: string) => FocusOption[]> = {
  human: () => [
    { t: 'Поздняя Античность', d: 'Рим, раздел империи, варвары — III–VI вв.' },
    { t: 'Революции Нового времени', d: 'Англия, Франция, Америка — механика перелома' },
    { t: 'XX век: мировые войны', d: 'причины, коалиции, последствия' },
  ],
  lang: () => [
    { t: 'Грамматика для речи', d: 'времена и конструкции, которые нужны в разговоре' },
    { t: 'Рабочий словарь', d: 'лексика вашей профессии' },
    { t: 'Аудирование и произношение', d: 'понимать на слух и быть понятым' },
  ],
  tech: () => [
    { t: 'Основы и синтаксис', d: 'база, без которой не пойти дальше' },
    { t: 'Практика на задачах', d: 'типовые сценарии из работы' },
    { t: 'Архитектура и оптимизация', d: 'почему так, а не иначе' },
  ],
  soft: () => [
    { t: 'Структура и аргументы', d: 'как строить мысль' },
    { t: 'Подача и голос', d: 'темп, паузы, уверенность' },
    { t: 'Работа с аудиторией', d: 'вопросы, возражения, внимание' },
  ],
  gen: (T) => [
    { t: T + ': основы', d: 'карта темы и ключевые понятия' },
    { t: T + ': практика', d: 'применение в типовых ситуациях' },
    { t: T + ': глубина', d: 'спорные места и детали' },
  ],
};

const sourcesByKind: Record<TopicKind, (focus: string) => Omit<SourceCandidate, 'id'>[]> = {
  human: (F) => [
    { t: 'Академическая монография — ' + F, m: 'рецензированная, с аппаратом ссылок', trust: 'high' },
    { t: 'Университетский учебник', m: 'структурный каркас периода', trust: 'high' },
    { t: 'Первоисточники: хроники, письма', m: 'взгляд современников — с поправкой на позицию', trust: 'mid' },
    { t: 'Научпоп и подкасты', m: 'живо, но упрощает', trust: 'low' },
  ],
  lang: (F) => [
    { t: 'Академическая грамматика — ' + F, m: 'нормативный источник', trust: 'high' },
    { t: 'Корпус живой речи', m: 'как говорят на самом деле', trust: 'high' },
    { t: 'Учебные курсы уровня', m: 'проверенные последовательности', trust: 'mid' },
    { t: 'Блоги и видео носителей', m: 'быстро, но без системы', trust: 'low' },
  ],
  tech: (F) => [
    { t: 'Официальная документация — ' + F, m: 'первоисточник · обновляется', trust: 'high' },
    { t: 'Университетский курс: введение', m: 'структурный каркас темы', trust: 'high' },
    { t: 'Разборы практиков', m: 'живые примеры, реальные задачи', trust: 'mid' },
    { t: 'Треды и подборки в соцсетях', m: 'быстро, но шумно', trust: 'low' },
  ],
  soft: (F) => [
    { t: 'Исследования по коммуникации — ' + F, m: 'что подтверждено экспериментами', trust: 'high' },
    { t: 'Классические руководства', m: 'проверенные десятилетиями рамки', trust: 'mid' },
    { t: 'Разборы выступлений', m: 'на реальных примерах', trust: 'mid' },
    { t: 'Мотивационный контент', m: 'вдохновляет, но не учит', trust: 'low' },
  ],
  gen: (F) => [
    { t: 'Академический обзор — ' + F, m: 'систематизация темы', trust: 'high' },
    { t: 'Базовый учебник', m: 'структурный каркас', trust: 'high' },
    { t: 'Практические разборы', m: 'примеры и кейсы', trust: 'mid' },
    { t: 'Подборки и треды', m: 'быстро, но шумно', trust: 'low' },
  ],
};

export function localPlan(mission: string, later: string): PlanStage[] {
  return [
    { n: '01', t: 'Каркас: термины и карта темы', d: 'глоссарий закладывается с первого урока' },
    { n: '02', t: 'Рабочие приёмы малыми шагами', d: 'один урок — одна победа, практика без подсказок' },
    { n: '03', t: 'Применение под вашу миссию', d: mission.trim() || later },
  ];
}

/** Заглушка прототипа: данные по типу темы, подготовка — таймер 3 × 1.8 с. */
export function createLocalContentService(opts: { stageMs?: number; planLater?: string } = {}): ContentService {
  const stageMs = opts.stageMs ?? PREP_STAGE_MS;
  return {
    async suggestFocus(topic) {
      return focusByKind[topicKind(topic)](topic || 'тема');
    },
    async findSources(topic, focus) {
      return sourcesByKind[topicKind(topic)](focus || topic || 'тема').map((s, i) => ({ ...s, id: `src-${i}` }));
    },
    async buildPlan(draft) {
      return localPlan(draft.mission, opts.planLater ?? 'уточним после первых сессий');
    },
    prepareFirstLesson(draft, onStage) {
      return new Promise((resolve) => {
        let stage = 0;
        onStage(0);
        const timer = setInterval(() => {
          stage += 1;
          if (stage >= 3) {
            clearInterval(timer);
            resolve(customLesson(draft.topic, draft.mission));
            return;
          }
          onStage(stage as PrepStage);
        }, stageMs);
      });
    },
  };
}
