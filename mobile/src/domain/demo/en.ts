import type { Reference } from "../reference";
import type { DemoLesson } from "../seed";
import type { PlanStage } from "../types";

/**
 * Демо-предмет «Английский»: сгенерирован живым сервером (тема «Английский для собеседований», фокус «Рассказ о себе»,
 * миссия «проходить собеседования на английском»). План на пять этапов и цепочка уроков 2–6 после стартовой диагностики:
 * разборы подавались с ошибкой в уроках 2 и 4, поэтому следующий урок разбирает её, а этап плана
 * сменяется после двух уверенных уроков. Статичен: дальше урока 6 демо не идёт.
 */
export const focus = "Рассказ о себе";
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

/** Цепочка статичных уроков демо. */
export const lessons: DemoLesson[] = [
  {
    number: 2,
    planStage: 0,
    lesson: {
      name: "Английский",
      level: "Рассказ о себе",
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
          prompt:
            "Как сказать «мой опыт — в поддержке клиентов» на собеседовании?",
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
    },
    references: [
      {
        id: "81984262-d2ec-4f41-9fa8-f3264cd06b61",
        group: "Глоссарий",
        title: "Термины · Английский",
        updatedAfter: 2,
        rows: [
          {
            k: "Tell me about yourself",
            v: "Стандартный вопрос на собеседовании, требующий 60–90-секундного ответа о себе по структуре: настоящее → прошлое → цель",
          },
          {
            k: "Present → Past → Future",
            v: "Каркас самопрезентации: текущая роль, релевантный опыт, профессиональная цель, связанные с вакансией",
          },
          {
            k: "Диагностика",
            v: "Первоначальный тест уровня владения ответом на собеседовании по реальным словам и выбору, а не по ощущениям",
          },
          {
            k: "Самооценка ≠ уровень",
            v: "Уверенность в речи часто отличается от реальных способностей под давлением, ориентир — по записям, не по самоощущению",
          },
          {
            k: "Present",
            v: "Первый блок ответа о себе: текущая должность и место работы в одном-двух предложениях, без истории и целей (пример: I'm a QA engineer at a fintech startup)",
          },
          {
            k: "Past",
            v: "Второй блок: 1–2 конкретных факта из опыта, релевантных для вакансии, с результатами или обязанностями (пример: I spent two years in customer support, where I built reports)",
          },
          {
            k: "Future",
            v: "Третий блок: причина ухода с текущей роли, желаемое направление и связка с вакансией, завершающая ответ (пример: Now I'm looking for a role where I can focus on data)",
          },
          {
            k: "Background",
            v: "Общий профессиональный фон: образование и совокупный опыт в целом, на который опираются при описании Past",
          },
          {
            k: "Achievements",
            v: "Конкретные результаты и достижения из прошлого опыта, которые доказывают компетенцию для новой вакансии",
          },
        ],
      },
    ],
  },
  {
    number: 3,
    planStage: 0,
    lesson: {
      name: "Английский",
      level: "Рассказ о себе",
      lessonTitle: "Урок 3 · Слова, которые держат каркас",
      steps: [
        {
          type: "explain",
          why: "миссия · проходить собеседования на английском",
          title: "Слова, которые держат каркас",
          paras: [
            "Каркас Present — Past — Future наполняется четырьмя словами. Background — общий профессиональный фон («в целом кто я»). Experience in — конкретный опыт в чём-то. Responsibilities — за что вы отвечали. Achievements — результат с цифрой или фактом.",
            "Present: одна фраза о текущей роли. Past: background + experience in + одно achievement, а не список обязанностей. Future: зачем вы здесь. Biography и duties — калька, в интервью звучат чужеродно.",
          ],
          example:
            "I'm a support specialist at Vento. I have a background in logistics and three years' experience in customer support; last year I cut response time by 30%. Now I'm looking for a QA role.",
          source:
            "Cambridge University Press, «Business Vocabulary in Use», units: job applications & interviews · доверие среднее",
        },
        {
          type: "choice",
          prompt:
            "Какая фраза — achievement (результат), а не фон и не обязанность?",
          explain:
            "Achievement — измеримый результат: reduced errors by 25%. Background — общий фон, was responsible for — обязанность, biography — калька, о человеке в книге.",
          recTitle: "Обязанность выглядит как достижение",
          recNote:
            "«Was responsible for» описывает процесс. Achievement — изменение с цифрой или сроком: increased, cut, launched.",
          options: [
            "I have a background in finance",
            "I was responsible for monthly reports",
            "I reduced errors by 25% in six months",
            "I have a biography in finance",
          ],
          correct: 2,
        },
        {
          type: "input",
          prompt:
            "Напишите блок Past о себе: общий фон + конкретный опыт. Одно предложение на английском.",
          explain:
            "Рабочая формула: I have a background in X and two years' experience in Y. Фон задаёт контекст, experience in — точку релевантности вакансии.",
          recTitle: "Past = фон + конкретика, не список мест работы",
          recNote:
            "Перечисление работодателей — пересказ резюме. Сожмите до background in + experience in, релевантных вакансии.",
          placeholder: "Наберите ответ…",
          tokens: [
            ["background"],
            ["experience in", "experience with"],
            ["i", "i'm", "i have"],
          ],
          answer:
            "I have a background in logistics and three years' experience in customer support.",
        },
        {
          type: "free",
          prompt:
            "Соберите свой ответ на «Tell me about yourself»: 4–5 предложений, Present — Past — Future.",
          explain:
            "Harvard: текущая роль → релевантный опыт → почему вы здесь. Без цели ответ выглядит как пересказ резюме; без цифры — как обязанности.",
          recTitle: "Цель в финале нужно назвать словами",
          recNote:
            "Слушатель не догадается сам. Закройте ответ фразой: that's why I'm interested in this role.",
          placeholder: "Ответьте развёрнуто — текстом или голосом",
          criteria: [
            {
              t: "Present — одна фраза о текущей роли",
              keys: ["I'm", "I work", "currently"],
            },
            {
              t: "Past — background и experience in",
              keys: ["background", "experience"],
            },
            {
              t: "Одно достижение с фактом или цифрой",
              keys: ["%", "by", "increased", "cut", "reduced", "launched"],
            },
            {
              t: "Future — связка с этой вакансией",
              keys: ["looking for", "that's why", "role", "position"],
            },
          ],
        },
      ],
    },
    references: [
      {
        id: "81984262-d2ec-4f41-9fa8-f3264cd06b61",
        group: "Глоссарий",
        title: "Термины · Английский",
        updatedAfter: 3,
        rows: [
          {
            k: "Tell me about yourself",
            v: "Стандартный вопрос на собеседовании, требующий 60–90-секундного ответа о себе по структуре: настоящее → прошлое → цель",
          },
          {
            k: "Present → Past → Future",
            v: "Каркас самопрезентации: текущая роль, релевантный опыт, профессиональная цель, связанные с вакансией",
          },
          {
            k: "Диагностика",
            v: "Первоначальный тест уровня владения ответом на собеседовании по реальным словам и выбору, а не по ощущениям",
          },
          {
            k: "Самооценка ≠ уровень",
            v: "Уверенность в речи часто отличается от реальных способностей под давлением, ориентир — по записям, не по самоощущению",
          },
          {
            k: "Present",
            v: "Первый блок ответа о себе: текущая должность и место работы в одном-двух предложениях, без истории и целей (пример: I'm a QA engineer at a fintech startup)",
          },
          {
            k: "Past",
            v: "Второй блок: 1–2 конкретных факта из опыта, релевантных для вакансии, с результатами или обязанностями (пример: I spent two years in customer support, where I built reports)",
          },
          {
            k: "Future",
            v: "Третий блок: причина ухода с текущей роли, желаемое направление и связка с вакансией, завершающая ответ (пример: Now I'm looking for a role where I can focus on data)",
          },
          {
            k: "Background",
            v: "Общий профессиональный фон: образование и совокупный опыт в целом, на который опираются при описании Past",
          },
          {
            k: "Achievements",
            v: "Конкретные результаты и достижения из прошлого опыта, которые доказывают компетенцию для новой вакансии",
          },
          {
            k: "Experience in",
            v: "Конкретный релевантный опыт в определённой области с указанием времени, связывающий прошлое с текущей вакансией",
          },
          {
            k: "Achievement",
            v: "Измеримый результат с цифрой, процентом или сроком (increased, cut, launched), отличаясь от обязанностей (was responsible for)",
          },
          {
            k: "Present — Past — Future",
            v: "Структура ответа на самопрезентацию: текущая роль → релевантный опыт с результатом → цель в новой должности",
          },
          {
            k: "Was responsible for",
            v: "Формулировка обязанностей и процессов, которая описывает функции, но не показывает конкретный результат или изменение",
          },
        ],
      },
    ],
  },
  {
    number: 4,
    planStage: 1,
    lesson: {
      name: "Английский",
      level: "Рассказ о себе",
      lessonTitle: "Урок 4 · Настоящее и достижение в двух фразах",
      steps: [
        {
          type: "explain",
          why: "миссия · проходить собеседования на английском",
          title: "Настоящее и достижение в двух фразах",
          paras: [
            "Первая фраза — кто вы сейчас: I'm a + роль + at + компания, и одно уточнение, что вы делаете. Этого достаточно, детали пойдут дальше.",
            "Вторая фраза — достижение, а не обязанность: глагол результата (increased, cut, launched, built) + цифра или срок. Слова-опоры: background in (общий фон), experience in (конкретный опыт), achievements (результаты).",
          ],
          example:
            "I'm a marketing specialist at Vega, working on email campaigns. Last year I launched a new newsletter and increased open rates by 18% in six months.",
          source:
            "Harvard Career Services, «Resumes, CVs, Cover Letters and Interviews»",
        },
        {
          type: "choice",
          prompt:
            "Какая фраза корректно соединяет общий фон и конкретный опыт?",
          explain:
            "Background in — профессиональный фон, experience in — конкретная область. Biography — жизнеописание, в интервью не используется; achievement — результат, а не область.",
          recTitle: "Background, experience in, achievements — разные слова",
          recNote:
            "Cambridge: background in + сфера, experience in + направление, achievements — результаты с цифрами. Biography сюда не подходит.",
          options: [
            "I have a background in finance and five years of experience in risk analysis.",
            "I have a biography in finance and five years of experience of risk analysis.",
            "My background is five years and my experience is finance.",
            "I have an achievement in finance for five years.",
          ],
          correct: 0,
        },
        {
          type: "input",
          prompt:
            "Напишите две фразы о себе: текущая роль (I'm a … at …) и одно достижение с глаголом результата и цифрой.",
          explain:
            "Рамка задаётся ролью, доверие — цифрой. Was responsible for описывает процесс; increased/cut/launched показывают изменение, которое можно проверить.",
          recTitle: "Достижение без глагола изменения звучит как обязанность",
          recNote:
            "BLS: отвечайте по делу с примерами результатов. Замените «I was responsible for reports» на «I cut reporting time by 30%».",
          placeholder: "Наберите ответ…",
          tokens: [
            ["i'm a", "i am a", "i work as"],
            ["at", "for", "in"],
            [
              "increased",
              "cut",
              "reduced",
              "launched",
              "built",
              "grew",
              "saved",
            ],
          ],
          answer:
            "I'm a data analyst at Nord Retail. Last quarter I cut reporting time by 30% by automating weekly reports.",
        },
        {
          type: "order",
          prompt:
            "Расставьте фразы в порядке ответа на «Tell me about yourself».",
          explain:
            "Harvard: настоящее — прошлое — цель. Роль задаёт рамку, фон и опыт объясняют её, достижение подкрепляет цифрой, цель закрывает ответ.",
          recTitle: "Достижение идёт после фона, а не первым",
          recNote:
            "Сначала кто вы сейчас, затем background/experience, потом результат как доказательство и только в конце — связка с вакансией.",
          items: [
            "I'm a project coordinator at a logistics company.",
            "I have a background in operations and experience in supplier management.",
            "Last year I cut delivery delays by 20%.",
            "That's why I'm interested in this role.",
          ],
          correct: [0, 1, 2, 3],
        },
      ],
    },
    references: [
      {
        id: "81984262-d2ec-4f41-9fa8-f3264cd06b61",
        group: "Глоссарий",
        title: "Термины · Английский",
        updatedAfter: 4,
        rows: [
          {
            k: "Tell me about yourself",
            v: "Стандартный вопрос на собеседовании, требующий 60–90-секундного ответа о себе по структуре: настоящее → прошлое → цель",
          },
          {
            k: "Present → Past → Future",
            v: "Каркас самопрезентации: текущая роль, релевантный опыт, профессиональная цель, связанные с вакансией",
          },
          {
            k: "Диагностика",
            v: "Первоначальный тест уровня владения ответом на собеседовании по реальным словам и выбору, а не по ощущениям",
          },
          {
            k: "Самооценка ≠ уровень",
            v: "Уверенность в речи часто отличается от реальных способностей под давлением, ориентир — по записям, не по самоощущению",
          },
          {
            k: "Present",
            v: "Первый блок ответа о себе: текущая должность и место работы в одном-двух предложениях, без истории и целей (пример: I'm a QA engineer at a fintech startup)",
          },
          {
            k: "Past",
            v: "Второй блок: 1–2 конкретных факта из опыта, релевантных для вакансии, с результатами или обязанностями (пример: I spent two years in customer support, where I built reports)",
          },
          {
            k: "Future",
            v: "Третий блок: причина ухода с текущей роли, желаемое направление и связка с вакансией, завершающая ответ (пример: Now I'm looking for a role where I can focus on data)",
          },
          {
            k: "Background",
            v: "Общий профессиональный фон: образование и совокупный опыт в целом, на который опираются при описании Past",
          },
          {
            k: "Achievements",
            v: "Конкретные результаты и достижения из прошлого опыта, которые доказывают компетенцию для новой вакансии",
          },
          {
            k: "Experience in",
            v: "Конкретный релевантный опыт в определённой области с указанием времени, связывающий прошлое с текущей вакансией",
          },
          {
            k: "Achievement",
            v: "Измеримый результат с цифрой, процентом или сроком (increased, cut, launched), отличаясь от обязанностей (was responsible for)",
          },
          {
            k: "Present — Past — Future",
            v: "Структура ответа на самопрезентацию: текущая роль → релевантный опыт с результатом → цель в новой должности",
          },
          {
            k: "Was responsible for",
            v: "Формулировка обязанностей и процессов, которая описывает функции, но не показывает конкретный результат или изменение",
          },
          {
            k: "I'm a + роль + at + компания",
            v: "структура представления текущей должности: название специальности, организация и одно уточнение о деятельности. Пример: I'm a marketing specialist at Vega, working on email campaigns",
          },
          {
            k: "Background in",
            v: "профессиональный фон, общая сфера компетенции без привязки к конкретной должности. Используется для описания основы опыта перед деталями",
          },
          {
            k: "Глагол результата",
            v: "действие показывает конкретное изменение (increased, cut, launched, built), а не процесс. Вместо was responsible for используйте глаголы с измеримым результатом",
          },
          {
            k: "Achievement + цифра",
            v: "достижение подкрепляется количеством, процентом или сроком для проверяемости. Пример: increased open rates by 18% in six months",
          },
        ],
      },
    ],
  },
  {
    number: 5,
    planStage: 1,
    lesson: {
      name: "Английский",
      level: "Рассказ о себе",
      lessonTitle: "Урок 5 · Три слова про опыт",
      steps: [
        {
          type: "explain",
          why: "миссия · проходить собеседования на английском",
          title: "Три слова про опыт",
          paras: [
            "Background in — общий профессиональный фон: сфера, где вы давно работаете. Experience in — конкретное направление или инструмент. Achievements — результаты с цифрой или сроком. Biography и history сюда не годятся: это про жизнь, а не про работу.",
            "Порядок в блоке Past: сначала фон одной фразой, потом точечный опыт под вакансию, потом одно достижение как доказательство.",
          ],
          example:
            "I have a background in retail analytics, with three years of experience in demand forecasting. Last year I cut stock-out losses by 18%.",
          source:
            "Cambridge University Press, «Business Vocabulary in Use», units по job applications и interviews · доверие среднее",
        },
        {
          type: "input",
          prompt:
            "Напишите две фразы о себе: общий профессиональный фон и конкретный опыт. Используйте точные слова из объяснения.",
          explain:
            "Background in задаёт сферу, experience in — конкретику под вакансию. Biography, history и life story звучат как рассказ о жизни, а не о работе.",
          recTitle: "Общий фон и конкретный опыт — разные конструкции",
          recNote:
            "Cambridge: background in + сфера, experience in + направление. Одно без другого оставляет либо туман, либо список задач.",
          placeholder: "Наберите ответ…",
          tokens: [["background in"], ["experience in", "experience with"]],
          answer:
            "I have a background in marketing, with two years of experience in email campaigns.",
        },
        {
          type: "choice",
          prompt: "Какая фраза — achievement, а не обязанность или фон?",
          explain:
            "Achievement — изменение с цифрой или сроком: cut, increased, launched. Responsible for и work in описывают процесс, background — фон.",
          recTitle: "Достижение требует глагола изменения и числа",
          recNote:
            "BLS: отвечайте примерами результатов. «Responsible for reports» — процесс; «cut the cycle from 5 days to 2» — результат.",
          options: [
            "I was responsible for the monthly reports",
            "I have a background in finance",
            "I cut the reporting cycle from 5 days to 2",
            "I work in a team of eight people",
          ],
          correct: 2,
        },
        {
          type: "free",
          prompt:
            "Напишите 3 предложения о себе: текущая роль, фон и опыт, одно достижение с цифрой. Без цели и без списка работодателей.",
          explain:
            "Harvard: настоящее — одна фраза, потом релевантный опыт, потом доказательство. Перечисление мест работы превращает ответ в пересказ резюме.",
          recTitle: "Порядок блоков важнее красивых слов",
          recNote:
            "Сначала кто вы сейчас, затем background/experience, потом результат. Достижение в начале звучит как хвастовство без контекста.",
          placeholder: "Ответьте развёрнуто — текстом или голосом",
          criteria: [
            {
              t: "Одна фраза о текущей роли",
              keys: ["I'm", "I work", "currently"],
            },
            {
              t: "Фон и конкретный опыт",
              keys: ["background in", "experience in"],
            },
            {
              t: "Одно достижение с цифрой",
              keys: ["increased", "cut", "launched", "by", "%"],
            },
          ],
        },
      ],
    },
    references: [
      {
        id: "81984262-d2ec-4f41-9fa8-f3264cd06b61",
        group: "Глоссарий",
        title: "Термины · Английский",
        updatedAfter: 5,
        rows: [
          {
            k: "Tell me about yourself",
            v: "Стандартный вопрос на собеседовании, требующий 60–90-секундного ответа о себе по структуре: настоящее → прошлое → цель",
          },
          {
            k: "Present → Past → Future",
            v: "Каркас самопрезентации: текущая роль, релевантный опыт, профессиональная цель, связанные с вакансией",
          },
          {
            k: "Диагностика",
            v: "Первоначальный тест уровня владения ответом на собеседовании по реальным словам и выбору, а не по ощущениям",
          },
          {
            k: "Самооценка ≠ уровень",
            v: "Уверенность в речи часто отличается от реальных способностей под давлением, ориентир — по записям, не по самоощущению",
          },
          {
            k: "Present",
            v: "Первый блок ответа о себе: текущая должность и место работы в одном-двух предложениях, без истории и целей (пример: I'm a QA engineer at a fintech startup)",
          },
          {
            k: "Past",
            v: "Второй блок: 1–2 конкретных факта из опыта, релевантных для вакансии, с результатами или обязанностями (пример: I spent two years in customer support, where I built reports)",
          },
          {
            k: "Future",
            v: "Третий блок: причина ухода с текущей роли, желаемое направление и связка с вакансией, завершающая ответ (пример: Now I'm looking for a role where I can focus on data)",
          },
          {
            k: "Background",
            v: "Общий профессиональный фон: образование и совокупный опыт в целом, на который опираются при описании Past",
          },
          {
            k: "Achievements",
            v: "Конкретные результаты и достижения из прошлого опыта, которые доказывают компетенцию для новой вакансии",
          },
          {
            k: "Experience in",
            v: "Конкретный релевантный опыт в определённой области с указанием времени, связывающий прошлое с текущей вакансией",
          },
          {
            k: "Achievement",
            v: "Измеримый результат с цифрой, процентом или сроком (increased, cut, launched), отличаясь от обязанностей (was responsible for)",
          },
          {
            k: "Present — Past — Future",
            v: "Структура ответа на самопрезентацию: текущая роль → релевантный опыт с результатом → цель в новой должности",
          },
          {
            k: "Was responsible for",
            v: "Формулировка обязанностей и процессов, которая описывает функции, но не показывает конкретный результат или изменение",
          },
          {
            k: "I'm a + роль + at + компания",
            v: "структура представления текущей должности: название специальности, организация и одно уточнение о деятельности. Пример: I'm a marketing specialist at Vega, working on email campaigns",
          },
          {
            k: "Background in",
            v: "профессиональный фон, общая сфера компетенции без привязки к конкретной должности. Используется для описания основы опыта перед деталями",
          },
          {
            k: "Глагол результата",
            v: "действие показывает конкретное изменение (increased, cut, launched, built), а не процесс. Вместо was responsible for используйте глаголы с измеримым результатом",
          },
          {
            k: "Achievement + цифра",
            v: "достижение подкрепляется количеством, процентом или сроком для проверяемости. Пример: increased open rates by 18% in six months",
          },
        ],
      },
    ],
  },
  {
    number: 6,
    planStage: 2,
    lesson: {
      name: "Английский",
      level: "Рассказ о себе",
      lessonTitle: "Урок 6 · Мост от опыта к цели",
      steps: [
        {
          type: "explain",
          why: "миссия · проходить собеседования на английском",
          title: "Мост от опыта к цели",
          paras: [
            "Финал ответа — не новая тема, а мост. Сначала опираетесь на уже сказанное: I've built a strong background in… / I have solid experience in… Потом переводите в будущее связкой: now I'm looking to…, I want to build on that and move into…, which is why I'm interested in this role.",
            "Мост держится на трёх словах: build on (опираться), move into (перейти в), which is why (поэтому). Без них цель звучит как отдельный абзац, не связанный с вашим опытом.",
          ],
          example:
            "I have experience in B2B sales, and I cut the deal cycle from 5 days to 2. Now I'm looking to build on that and move into key account management — which is why I'm interested in this role.",
          source:
            "BBC Learning English, English at Work · Job interviews · доверие среднее",
        },
        {
          type: "choice",
          prompt:
            "Опыт назван: «I have experience in reporting and I cut reporting time by 30%». Какая фраза корректно ведёт к цели?",
          explain:
            "Связка опирается на сказанное (build on that) и называет направление (move into analytics). Остальные варианты добавляют новые темы или звучат неуверенно и не связаны с вакансией.",
          recTitle: "Мост должен ссылаться на уже сказанное",
          recNote:
            "«Build on that» связывает цель с вашим опытом. Новый факт или «maybe I will change» рвёт логику и звучит неподготовленно.",
          options: [
            "I also know Excel and I like teamwork.",
            "Now I'm looking to build on that and move into analytics.",
            "My biography includes three companies in retail.",
            "In the future maybe I will change my profession.",
          ],
          correct: 1,
        },
        {
          type: "input",
          prompt:
            "Напишите одно предложение-связку: опереться на свой опыт, назвать направление и объяснить, почему вы здесь. 1 фраза на английском.",
          explain:
            "Рабочая формула: I want to build on my experience in X and move into Y, which is why I'm interested in this role. Три элемента: опора, направление, причина.",
          recTitle: "Связка — одно предложение из трёх частей",
          recNote:
            "Опора (build on), направление (move into), причина (which is why). Если выпадает причина, слушатель не понимает связи с вакансией.",
          placeholder: "Наберите ответ…",
          tokens: [
            ["build on", "building on"],
            ["move into", "moving into"],
            ["which is why", "that's why"],
          ],
          answer:
            "I want to build on my experience in reporting and move into data analytics, which is why I'm interested in this role.",
        },
        {
          type: "order",
          prompt: "Расставьте части финала ответа в правильном порядке.",
          explain:
            "Сначала общий фон, затем конкретный опыт, затем результат как доказательство, потом цель и только в конце — связка с вакансией.",
          recTitle: "Цель без доказательства звучит пусто",
          recNote:
            "Achievement идёт перед целью: он объясняет, почему переход реалистичен. Связка «which is why» всегда закрывает ответ.",
          items: [
            "I have a strong background in finance",
            "and experience in monthly reporting",
            "last year I cut reporting time by 30%",
            "now I'm looking to move into analytics",
            "which is why I'm interested in this role",
          ],
          correct: [0, 1, 2, 3, 4],
        },
      ],
    },
    references: [
      {
        id: "81984262-d2ec-4f41-9fa8-f3264cd06b61",
        group: "Глоссарий",
        title: "Термины · Английский",
        updatedAfter: 6,
        rows: [
          {
            k: "Tell me about yourself",
            v: "Стандартный вопрос на собеседовании, требующий 60–90-секундного ответа о себе по структуре: настоящее → прошлое → цель",
          },
          {
            k: "Present → Past → Future",
            v: "Каркас самопрезентации: текущая роль, релевантный опыт, профессиональная цель, связанные с вакансией",
          },
          {
            k: "Диагностика",
            v: "Первоначальный тест уровня владения ответом на собеседовании по реальным словам и выбору, а не по ощущениям",
          },
          {
            k: "Самооценка ≠ уровень",
            v: "Уверенность в речи часто отличается от реальных способностей под давлением, ориентир — по записям, не по самоощущению",
          },
          {
            k: "Present",
            v: "Первый блок ответа о себе: текущая должность и место работы в одном-двух предложениях, без истории и целей (пример: I'm a QA engineer at a fintech startup)",
          },
          {
            k: "Past",
            v: "Второй блок: 1–2 конкретных факта из опыта, релевантных для вакансии, с результатами или обязанностями (пример: I spent two years in customer support, where I built reports)",
          },
          {
            k: "Future",
            v: "Третий блок: причина ухода с текущей роли, желаемое направление и связка с вакансией, завершающая ответ (пример: Now I'm looking for a role where I can focus on data)",
          },
          {
            k: "Background",
            v: "Общий профессиональный фон: образование и совокупный опыт в целом, на который опираются при описании Past",
          },
          {
            k: "Achievements",
            v: "Конкретные результаты и достижения из прошлого опыта, которые доказывают компетенцию для новой вакансии",
          },
          {
            k: "Experience in",
            v: "Конкретный релевантный опыт в определённой области с указанием времени, связывающий прошлое с текущей вакансией",
          },
          {
            k: "Achievement",
            v: "Измеримый результат с цифрой, процентом или сроком (increased, cut, launched), отличаясь от обязанностей (was responsible for)",
          },
          {
            k: "Present — Past — Future",
            v: "Структура ответа на самопрезентацию: текущая роль → релевантный опыт с результатом → цель в новой должности",
          },
          {
            k: "Was responsible for",
            v: "Формулировка обязанностей и процессов, которая описывает функции, но не показывает конкретный результат или изменение",
          },
          {
            k: "I'm a + роль + at + компания",
            v: "структура представления текущей должности: название специальности, организация и одно уточнение о деятельности. Пример: I'm a marketing specialist at Vega, working on email campaigns",
          },
          {
            k: "Background in",
            v: "профессиональный фон, общая сфера компетенции без привязки к конкретной должности. Используется для описания основы опыта перед деталями",
          },
          {
            k: "Глагол результата",
            v: "действие показывает конкретное изменение (increased, cut, launched, built), а не процесс. Вместо was responsible for используйте глаголы с измеримым результатом",
          },
          {
            k: "Achievement + цифра",
            v: "достижение подкрепляется количеством, процентом или сроком для проверяемости. Пример: increased open rates by 18% in six months",
          },
          {
            k: "Build on that",
            v: "Опираться на уже имеющийся опыт при переходе к новой цели; создать логическую связь между прошлым и будущим",
          },
          {
            k: "Move into",
            v: "Перейти в новую область профессиональной деятельности, опираясь на накопленные навыки; например, из B2B sales в key account management",
          },
          {
            k: "Which is why",
            v: "Связующая фраза, которая объясняет причину заинтересованности в должности через логику развития карьеры; завершает мост от опыта к цели",
          },
          {
            k: "Мост от опыта к цели",
            v: "Трёхчастная структура ответа: опора на прошлый опыт (build on) → направление движения (move into) → причина заинтересованности (which is why)",
          },
          {
            k: "Achievement перед целью",
            v: "Конкретный результат или достижение (сокращение времени на 30%, увеличение продаж) должны идти до формулировки цели, чтобы доказать реалистичность перехода",
          },
        ],
      },
    ],
  },
];

/** Глоссарий после первого урока цепочки — засевается в справочники один раз на аккаунт. */
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
