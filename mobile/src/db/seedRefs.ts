import type { Reference, RefRow } from '@/domain/reference';

const r = (k: string, v: string, weak = false, sec?: string): RefRow => (sec ? { sec, k, v, weak } : { k, v, weak });

/** Справочники прототипа (refsData) — сеются один раз в пустую БД. */
export const prototypeRefs: Reference[] = [
  { id: 'tenses', subjectId: 'en', subjectName: 'Английский', group: 'Грамматика', title: 'Времена — сводная таблица', updatedAfter: 48, rows: [
    r('Present Simple', 'регулярность и факты: I test APIs every day.', false, 'Настоящее'),
    r('Present Continuous', 'процесс сейчас или ближайший план: am/is/are + V-ing.', false, 'Настоящее'),
    r('Present Perfect', 'связь с настоящим: have + V3 — I have lived here for 5 years.', true, 'Настоящее'),
    r('Present Perfect Continuous', 'длится до сих пор: have been + V-ing.', false, 'Настоящее'),
    r('Past Simple', 'закрытое время: yesterday, in 2020, last week.', false, 'Прошедшее'),
    r('Past Continuous', 'фон для события: I was reading when he called.', false, 'Прошедшее'),
    r('Past Simple vs Perfect', 'закрытое время → Simple; важен результат сейчас → Perfect.', true, 'Прошедшее'),
    r('will', 'решение в моменте, обещание, прогноз.', false, 'Будущее'),
    r('going to', 'намерение и план: I am going to refactor this.', false, 'Будущее'),
    r('Present Continuous (план)', 'договорённость с датой: We are meeting on Monday.', false, 'Будущее') ] },
  { id: 'cond', subjectId: 'en', subjectName: 'Английский', group: 'Грамматика', title: 'Conditionals — таблица форм', updatedAfter: 41, rows: [
    r('Zero', 'If + Present, Present — законы и привычки: If you heat ice, it melts.'),
    r('First', 'If + Present, will — реальное будущее: If it rains, I will stay.'),
    r('Second', 'If + Past, would — нереальное настоящее: If I were you, I would go.', true),
    r('Third', 'If + Past Perfect, would have — нереальное прошлое: If I had known…') ] },
  { id: 'modal', subjectId: 'en', subjectName: 'Английский', group: 'Грамматика', title: 'Модальные глаголы', updatedAfter: 36, rows: [
    r('must vs have to', 'must — внутренняя необходимость; have to — внешнее правило.'),
    r('should / ought to', 'совет, мягкое долженствование.'),
    r('can / could / be able to', 'способность; could — прошлое или вежливая просьба.'),
    r('might / may', 'вероятность; may — ещё и формальное разрешение.') ] },
  { id: 'interview', subjectId: 'en', subjectName: 'Английский', group: 'Цель', title: 'Рамки для собеседования', updatedAfter: 50, rows: [
    r('Опыт', 'I have been working on… for…; My role involved…'),
    r('Достижения', 'I led…, which resulted in… — результат всегда числом.'),
    r('Гипотетика', 'If I were to…, I would… — second conditional в ответах.'),
    r('Вопросы интервьюеру', 'Could you tell me more about…; What does success look like here?') ] },
  { id: 'phrasal', subjectId: 'en', subjectName: 'Английский', group: 'Цель', title: 'Фразовые глаголы — ваш набор', updatedAfter: 47, rows: [
    r('figure out', 'разобраться: We figured out the root cause.', true),
    r('follow up', 'вернуться с продолжением: I will follow up on this.'),
    r('point out', 'указать на: She pointed out a risk.', true),
    r('carry out', 'выполнить: carry out regression testing.') ] },
  { id: 'glen', subjectId: 'en', subjectName: 'Английский', group: 'Глоссарий', title: 'Термины · Английский', updatedAfter: 50, rows: [
    r('Second Conditional', 'нереальное условие о настоящем: If + Past, would + inf.'),
    r('Phrasal verb', 'глагол + частица с новым смыслом: figure out, follow up.'),
    r('Collocation', 'устойчивая пара слов: make a decision, а не do.') ] },
  { id: 'qa', subjectId: 'qa', subjectName: 'Quality Assurance', group: 'Тест-дизайн', title: 'Граничные значения — чеклист', updatedAfter: 12, rows: [
    r('1 · Края', 'Для диапазона [a; b] — тесты a−1, a, b, b+1.'),
    r('2 · Включительность', 'Уточнить, входят ли границы: «до 100» ≠ «по 100».', true),
    r('3 · Типы', 'Пустое значение, ноль, отрицательное, дробное, максимум типа.'),
    r('4 · Длины', 'Строки: пустая, минимальная, максимальная, максимальная+1.'),
    r('5 · Середина', 'Одно типичное значение — для контраста, не для покрытия.') ] },
  { id: 'equiv', subjectId: 'qa', subjectName: 'Quality Assurance', group: 'Тест-дизайн', title: 'Классы эквивалентности', updatedAfter: 9, rows: [
    r('Определение', 'группа значений, обрабатываемых одинаково — один тест на класс.'),
    r('Валидные и невалидные', 'на каждый невалидный класс — отдельный тест.'),
    r('Комбинации', 'невалидные классы не комбинировать — маскируют друг друга.') ] },
  { id: 'glqa', subjectId: 'qa', subjectName: 'Quality Assurance', group: 'Глоссарий', title: 'Термины · QA', updatedAfter: 12, rows: [
    r('Граничное значение', 'крайняя точка допустимого диапазона и её соседи.'),
    r('Эквивалентный класс', 'группа значений, которые код обрабатывает одинаково.'),
    r('Off-by-one', 'ошибка на единицу у края диапазона — главный улов граничных тестов.') ] },
  { id: 'romefall', subjectId: 'hist', subjectName: 'История', group: 'Хронология', title: 'Падение Западной империи — лента', updatedAfter: 22, rows: [
    r('235–284', 'Кризис III века: более 20 императоров, инфляция, потеря контроля над провинциями.', false, 'III век'),
    r('378', 'Адрианополь: готы разбивают римскую армию, погибает император Валент.', false, 'IV век'),
    r('395', 'Смерть Феодосия I — окончательный раздел на Запад и Восток.', true, 'IV век'),
    r('410', 'Аларих берёт Рим — первое разграбление за 800 лет.', true, 'V век'),
    r('455', 'Вандалы разоряют Рим — «вандализм» входит в язык.', false, 'V век'),
    r('476', 'Одоакр низлагает Ромула Августа — формальный конец Запада.', false, 'V век') ] },
  { id: 'romewhy', subjectId: 'hist', subjectName: 'История', group: 'Причины и следствия', title: 'Почему пал Рим — карта причин', updatedAfter: 22, rows: [
    r('Фискальная', 'армия дорожает, налоговая база сжимается — платить нечем.'),
    r('Военная', 'давление готов, вандалов, гуннов; армия всё больше из наёмников.'),
    r('Политическая', 'частая смена императоров, гражданские войны, слабая легитимность.', true),
    r('Контраргумент', 'Восток простоял ещё 1000 лет с теми же угрозами — одной причины нет.') ] },
  { id: 'romewho', subjectId: 'hist', subjectName: 'История', group: 'Персоны', title: 'Ключевые фигуры', updatedAfter: 20, rows: [
    r('Диоклетиан', '284–305 · тетрархия, реформы, конец кризиса III века.'),
    r('Феодосий I', '379–395 · последний правитель единой империи.'),
    r('Аларих', 'король вестготов, взял Рим в 410.'),
    r('Одоакр', 'военачальник, низложивший последнего западного императора.') ] },
  { id: 'romelens', subjectId: 'hist', subjectName: 'История', group: 'Цель', title: 'Оптика для новостей: признаки распада', updatedAfter: 22, rows: [
    r('Расходы > доходы', 'структурный дефицит на оборону/аппарат — первый римский признак.'),
    r('Кадровая карусель', 'частая смена власти без смены курса.'),
    r('Аутсорс силы', 'опора на наёмников/союзников, которые становятся хозяевами.') ] },
  { id: 'glhist', subjectId: 'hist', subjectName: 'История', group: 'Глоссарий', title: 'Термины · История', updatedAfter: 22, rows: [
    r('Тетрархия', 'правление четырёх: два августа и два цезаря (с 293).'),
    r('Федераты', 'варварские племена на службе Рима за землю и плату.'),
    r('Поздняя Античность', 'период ~III–VII вв., переход от античности к средневековью.') ] },
];
