import type { Reference } from "../reference";
import type { Lesson, PlanStage } from "../types";

/**
 * Демо-предмет «Английский»: сгенерирован живым сервером 10 сентября 2026 (тема «Английский для собеседований»,
 * фокус «Рассказ о себе (Tell me about yourself)», миссия «проходить собеседования на английском»), план на пять этапов, урок 2 после стартовой
 * диагностики и глоссарий из неё. Статичен: следующих уроков у демо нет.
 */
export const focus = "Рассказ о себе (Tell me about yourself)";
export const mission = "проходить собеседования на английском";

export const plan: PlanStage[] = [
  {
    n: "01",
    t: "Каркас и термины",
    d: "Изучаем структуру ответа Present-Past-Future и ключевую лексику для самопрезентации на собеседовании",
  },
  {
    n: "02",
    t: "Формулируем настоящее и опыт",
    d: "Малыми шагами тренируемся кратко описывать текущую роль и ключевые достижения на английском",
  },
  {
    n: "03",
    t: "Связки и переход к цели",
    d: "Отрабатываем фразы-связки между прошлым опытом и будущими карьерными целями",
  },
  {
    n: "04",
    t: "Сборка целого рассказа",
    d: "Собираем цельный связный ответ Tell me about yourself длительностью 60-90 секунд",
  },
  {
    n: "05",
    t: "Применение под миссию",
    d: "Проходить собеседования на английском — отрабатываем рассказ о себе в формате реального интервью",
  },
];

export const lesson: Lesson = {
  name: "Английский",
  level: "Рассказ о себе (Tell me about yourself)",
  lessonTitle: "Урок 2 · Present — Past — Future",
  steps: [
    {
      type: "explain",
      why: "миссия · проходить собеседования на английском",
      title: "Present — Past — Future",
      paras: [
        "Ответ на «Tell me about yourself» — не пересказ резюме, а три блока. Present: кто вы сейчас и чем заняты. Past: 1–2 факта из опыта, которые нужны этой вакансии. Future: зачем вы здесь и что хотите делать дальше.",
        "Слова-опоры: background (опыт в целом), responsibilities (обязанности), achievements (результаты), strengths (сильные стороны). Всего 60–90 секунд — по 2–3 предложения на блок.",
      ],
      example:
        "Present: I'm a junior analyst at a retail company. Past: Before that, I spent two years in customer support, where I built reports. Future: Now I'm looking for a role where I can focus on data.",
      source:
        "Harvard Office of Career Services, «Resumes, CVs, Cover Letters and Interviews» — раздел Interviews",
    },
    {
      type: "order",
      prompt: "Расставьте фразы в порядке Present — Past — Future.",
      explain:
        "Сначала настоящее (кто вы сейчас), потом релевантное прошлое, затем цель и переход к вакансии. Финал — связка «поэтому я здесь».",
      recTitle: "Цель идёт последней, а не в начале",
      recNote:
        "Harvard: начинайте с текущей роли, а желание сменить направление и связка с вакансией закрывают ответ.",
      items: [
        "I'm currently a project coordinator at a logistics firm.",
        "Before that, I worked three years in operations, managing supplier reports.",
        "That's why I'm interested in this analyst role on your team.",
        "I'd like to move into data analysis full-time.",
      ],
      correct: [0, 1, 3, 2],
    },
    {
      type: "choice",
      prompt: "Как сказать «мой опыт — в поддержке клиентов» на собеседовании?",
      explain:
        "Background — профессиональный опыт и образование в целом. Biography/history/past — калька, звучит как рассказ о жизни, а не о работе.",
      recTitle: "«Опыт» ≠ biography",
      recNote:
        "Cambridge: background — общий профессиональный фон, experience in — конкретный опыт, achievements — результаты.",
      options: [
        "My background is in customer support.",
        "My biography is in customer support.",
        "My history is in customer support.",
        "My past is in customer support.",
      ],
      correct: 0,
    },
    {
      type: "input",
      prompt:
        "Напишите одно предложение о себе сейчас: роль + где. Без прошлого и без цели.",
      explain:
        "Первый блок — только настоящее: «I'm a QA engineer at a fintech startup». Не начинайте с года рождения или всей карьеры.",
      recTitle: "Present — одна фраза, не абзац",
      recNote:
        "BLS: отвечайте по делу. Одно предложение о текущей роли задаёт рамку, детали уйдут в блок Past.",
      placeholder: "Наберите ответ…",
      tokens: [
        ["i'm", "i am", "im"],
        ["at", "in", "for", "as"],
      ],
      answer: "I'm a marketing specialist at a small e-commerce company.",
    },
  ],
};

export const references: Reference[] = [
  {
    id: "en-gloss",
    subjectId: "en",
    subjectName: "Английский",
    group: "Глоссарий",
    title: "Термины · Английский",
    updatedAfter: 2,
    rows: [
      {
        k: "Tell me about yourself",
        v: "Стандартный вопрос на собеседовании, требующий 60–90-секундного ответа о себе по структуре: настоящее → прошлое → цель",
        weak: false,
      },
      {
        k: "Present → Past → Future",
        v: "Каркас самопрезентации: текущая роль, релевантный опыт, профессиональная цель, связанные с вакансией",
        weak: false,
      },
      {
        k: "Диагностика",
        v: "Первоначальный тест уровня владения ответом на собеседовании по реальным словам и выбору, а не по ощущениям",
        weak: false,
      },
      {
        k: "Самооценка ≠ уровень",
        v: "Уверенность в речи часто отличается от реальных способностей под давлением, ориентир — по записям, не по самоощущению",
        weak: false,
      },
      {
        k: "Present",
        v: "Первый блок ответа о себе: текущая должность и место работы в одном-двух предложениях, без истории и целей (пример: I'm a QA engineer at a fintech startup)",
        weak: false,
      },
      {
        k: "Past",
        v: "Второй блок: 1–2 конкретных факта из опыта, релевантных для вакансии, с результатами или обязанностями (пример: I spent two years in customer support, where I built reports)",
        weak: false,
      },
      {
        k: "Future",
        v: "Третий блок: причина ухода с текущей роли, желаемое направление и связка с вакансией, завершающая ответ (пример: Now I'm looking for a role where I can focus on data)",
        weak: false,
      },
      {
        k: "Background",
        v: "Общий профессиональный фон: образование и совокупный опыт в целом, на который опираются при описании Past",
        weak: false,
      },
      {
        k: "Achievements",
        v: "Конкретные результаты и достижения из прошлого опыта, которые доказывают компетенцию для новой вакансии",
        weak: false,
      },
    ],
  },
];
