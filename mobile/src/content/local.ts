import { detectLanguage } from '@/domain/languages';
import { customLesson, topicKind } from '@/domain/seed';
import type { Lesson, TopicKind } from '@/domain/types';
import type { ContentService, FocusOption, PlanStage, PrepStage, ReferenceIn, SourceCandidate } from './types';

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

/** Короткое имя: язык предмета или первые три слова темы. */
export function shortTitle(topic: string): string {
  const t = topic.trim();
  const lang = detectLanguage(t);
  if (lang) return lang.ru;
  // До трёх слов и до 24 символов, слова не режем.
  let s = '';
  for (const w of t.split(/\s+/).slice(0, 3)) {
    const next = s ? `${s} ${w}` : w;
    if (next.length > 24) break;
    s = next;
  }
  if (!s) s = t.slice(0, 24).trimEnd();
  return s ? s[0].toUpperCase() + s.slice(1) : 'Предмет';
}

/** Глоссарий заглушки: записи об усвоенном урока. */
export function stubGlossary(lesson: Lesson, number: number): ReferenceIn[] {
  const rows = lesson.steps.flatMap((s) => (s.type === 'explain' ? [] : [{ k: s.recTitle, v: s.recNote }]));
  return [{ id: 'glossary', group: 'Глоссарий', title: `Термины · ${lesson.name}`, updatedAfter: number, rows }];
}

/** Следующий урок заглушки: каркас темы, отталкиваясь от последней ошибки разбора. */
export function stubNextLesson(number: number, records: { title: string; ok: boolean }[]): Lesson {
  const lastMiss = [...records].reverse().find((r) => !r.ok)?.title ?? 'первые термины';
  return {
    name: 'Предмет',
    level: 'этап 01',
    lessonTitle: `Урок ${number} · Каркас темы`,
    steps: [
      { type: 'explain', why: 'миссия · по плану', title: 'Карта темы',
        paras: [`Каркас темы — три-четыре термина, через которые описывается всё остальное. Прошлый разбор показал слабое место: «${lastMiss}». Начинаем с него.`,
                'Один урок — одна победа: сегодня только карта, без деталей.'],
        example: 'Термин без места на карте забывается через день; термин с местом — держится неделями.',
        source: 'Ваш план · этап 01 — каркас темы' },
      { type: 'choice', prompt: 'С чего начинается каркас темы?', options: ['С самых частых терминов', 'С самых сложных случаев', 'С исторической справки'], correct: 0,
        explain: 'Каркас строится от частого к редкому.', recTitle: 'Каркас — от частого к редкому', recNote: 'Без частых терминов сложное не к чему привязать.' },
      { type: 'free', prompt: 'Назовите три термина темы и по одной фразе к каждому.', placeholder: 'Три термина и по фразе',
        criteria: [{ t: 'Названы три термина', keys: ['1', '2', '3', 'три'] }, { t: 'К каждому есть фраза', keys: ['это', 'значит', ':'] }],
        explain: 'Термины с фразами — первая строка вашего справочника.', recTitle: 'Карта темы своими словами', recNote: 'По формулировкам видно, что понято.' },
    ],
  };
}

/** Заглушка прототипа: данные по типу темы, подготовка — таймер 3 × 1.8 с. */
export function createLocalContentService(opts: { stageMs?: number; planLater?: string } = {}): ContentService {
  const stageMs = opts.stageMs ?? PREP_STAGE_MS;
  const stages = (onStage: (s: PrepStage) => void) =>
    new Promise<void>((resolve) => {
      let stage = 0;
      onStage(0);
      const timer = setInterval(() => {
        stage += 1;
        if (stage >= 3) {
          clearInterval(timer);
          resolve();
          return;
        }
        onStage(stage as PrepStage);
      }, stageMs);
    });
  return {
    async suggestTitle(topic) {
      return shortTitle(topic);
    },
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
      return stages(onStage).then(() => {
        const lesson = customLesson(draft.title ?? draft.topic, draft.mission);
        return { lesson, references: stubGlossary(lesson, 1) };
      });
    },
    async prefetchNextLesson() {
      /* у заглушки генерация мгновенная */
    },
    async gradeFree(criteria, text) {
      // Заглушка повторяет офлайн-проверку по ключевым словам.
      const t = text.toLowerCase();
      return criteria.map((c) => c.keys.some((k) => t.includes(k.toLowerCase())));
    },
    resumeLesson(_remoteId, number, onStage) {
      return stages(onStage).then(() => {
        const lesson = stubNextLesson(number, []);
        return { lesson, references: stubGlossary(lesson, number) };
      });
    },
    prepareNextLesson(_remoteId, number, records, onStage) {
      return stages(onStage).then(() => {
        const lesson = stubNextLesson(number, records);
        return { lesson, references: stubGlossary(lesson, number) };
      });
    },
  };
}
