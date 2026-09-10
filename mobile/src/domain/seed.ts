import type { Reference } from './reference';
import type { Lesson, Mission, PlanStage, SubjectId, TopicKind } from './types';
import * as en from './demo/en';
import * as speak from './demo/speak';

/** Демо-предметы приложения: языковой и неязыковой, сгенерированы сервером и зашиты статично. */
export const DEMO_IDS: SubjectId[] = ['en', 'speak'];

export const seedLessons: Record<SubjectId, Lesson> = { en: en.lesson, speak: speak.lesson };
export const seedMissions: Record<SubjectId, Mission> = { en: { cur: en.mission, hist: [] }, speak: { cur: speak.mission, hist: [] } };
export const seedPlans: Record<SubjectId, PlanStage[]> = { en: en.plan, speak: speak.plan };
export const seedFocus: Record<SubjectId, string> = { en: en.focus, speak: speak.focus };
/** Глоссарии демо — засеваются в справочники один раз на аккаунт. */
export const seedRefs: Reference[] = [...en.references, ...speak.references];

export function topicKind(topic: string): TopicKind {
  const x = (topic || '').toLowerCase();
  if (/истор|history|философ|литерат|искусств/.test(x)) return 'human';
  if (/англ|испан|немец|франц|язык|english|spanish/.test(x)) return 'lang';
  if (/sql|python|js|qa|тест|програм|данн|devops|код/.test(x)) return 'tech';
  if (/выступ|перегов|менедж|лидер|продаж/.test(x)) return 'soft';
  return 'gen';
}

/** Урок повторов: собирается из карточек очереди (в прототипе — фиксированный). */
export function reviewLesson(name: string): Lesson {
  return { name, level: '', steps: [
    { type: 'choice', prompt: 'If she ___ here, she would help us.', options: ['was', 'were', 'would be'], correct: 1,
      explain: 'В условной части second conditional — were для всех лиц.',
      recTitle: 'were после if — для всех лиц', recNote: 'Интервал вырос: следующий повтор позже.' },
    { type: 'choice', prompt: 'Диапазон 10–99. Какие невалидные граничные значения?', options: ['9 и 100', '0 и 999', '10 и 99'], correct: 0,
      explain: '10 и 99 — валидные края; невалидные соседи — 9 и 100.',
      recTitle: 'Невалидные соседи границ', recNote: 'Пара «внутри и снаружи» для каждого края.' } ] };
}

/** Первый урок нового предмета — стартовая диагностика. */
export function customLesson(topic: string, mission: string): Lesson {
  return { name: topic, level: 'старт', steps: [
    { type: 'explain', why: 'миссия · ' + (mission || 'уточняется'), title: 'Стартовая диагностика',
      paras: ['Зона ближайшего развития считается из записей, а не из самооценки. Поэтому первый урок — не теория, а замер: два коротких задания покажут границу, с которой начнём.',
              'Ошибаться здесь полезно: каждая ошибка станет первой записью об усвоенном — памятью системы.'],
      example: 'Ответ «не знаю» — тоже данные: такая тема попадёт в каркас первого этапа плана.',
      source: 'Ваш план · этап 01 — каркас темы' },
    { type: 'choice', prompt: 'Насколько уверенно вы сейчас в теме «' + topic + '»?',
      options: ['Слышал(а), но не применял(а)', 'Применяю по шаблону', 'Могу объяснить другому'], correct: -1,
      explain: 'Это калибровка, а не экзамен: от ответа зависит, с какой ступени плана начнём.',
      recTitle: 'Стартовая уверенность', recNote: 'Сверим через несколько сессий — самооценка сдвигается.' },
    { type: 'input', prompt: 'Что уже знаете или умеете в «' + topic + '»? Пишите как есть.',
      placeholder: '2–3 фразы свободным текстом', tokens: [], answer: '',
      explain: 'Замер лёг в записи об усвоенном — первый полный урок построится от этой границы.',
      voice: 'знаю базовые вещи, применял пару раз на практике, системно не учил',
      recTitle: 'Карта того, что уже есть', recNote: 'Из этого считается зона ближайшего развития.' } ] };
}
