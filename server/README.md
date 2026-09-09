# Teach.Api — сервер-оркестратор

.NET 10, минимальные API, EF Core + SQLite (dev). Единственная дверь клиента к генерации контента:
клиент не держит ключей модели и не планирует обучение (бриф §5.1). Контракт — `docs/ai-content.md`.

## Запуск

```bash
cd server/Teach.Api
ASPNETCORE_URLS=http://0.0.0.0:5180 dotnet run --no-launch-profile
```

- `ANTHROPIC_API_KEY` задан → модель Claude (`Teach:Model=auto`); нет ключа → заглушка с данными прототипа.
  Принудительно: `Teach__Model=claude|stub`.
- `Teach__ApiToken` — общий bearer-токен: все запросы, кроме `/health`, требуют `Authorization: Bearer <токен>`.
  Пустой токен = открытый API, допустимо только локально.
- `Teach__Db` — строка подключения SQLite (по умолчанию `Data Source=teach.db`).
- `Teach__StageDelayMs` — пауза между этапами подготовки, только чтобы этапы были видны на карточке.
- `GET /health` показывает активную модель и версию промптов.

Тесты: `dotnet test server/Teach.slnx`.

## Облако

`Teach.Api/Dockerfile` — образ на `mcr.microsoft.com/dotnet/aspnet:10.0`, порт 8080, база на томе `/data`.
`server/fly.toml` — конфигурация Fly.io: том `teach_data`, HTTPS, health-check. Порядок:

```bash
cd server && fly launch --copy-config --no-deploy
fly volumes create teach_data --size 1
fly secrets set ANTHROPIC_API_KEY=... Teach__ApiToken=$(openssl rand -hex 24)
fly deploy && curl https://teach-api.fly.dev/health
```

Клиент собирается с `EXPO_PUBLIC_CONTENT_URL=https://teach-api.fly.dev` и `EXPO_PUBLIC_CONTENT_TOKEN=<тот же токен>`.

Схема БД создаётся через `EnsureCreated`, миграций пока нет: при изменении моделей dev-базу `teach.db` нужно удалить.

## Как устроено

- `Contracts/` — DTO, зеркало `mobile/src/content/types.ts`.
- `Domain/Lesson.cs` — модель урока с дискриминатором `type`; `LessonValidator` — смысловая проверка поверх схемы
  (варианты, перестановки, критерии, записи об усвоенном, бюджет текста по длительности). Не прошло — повтор генерации, до `MaxAttempts`.
- Схема структурированного вывода урока компактная: плоский шаг из 13 полей, вложенные массивы свёрнуты в строки
  (полная схема отвергается API как `Schema is too complex`). Таблица соответствия — `docs/ai-content.md`, «Контракт урока».
- `Model/ILessonModel` — провайдер модели. `ClaudeLessonModel`: Anthropic SDK, `claude-opus-5` для уроков с адаптивным thinking,
  структурированный вывод по JSON-схеме, кэш промпта на методике и контексте предмета, web search для источников;
  `claude-haiku-4-5` для оценки свободных ответов. `StubLessonModel`: данные прототипа.
- `Model/Prompts.cs` — версионированные промпты; версия пишется в урок.
- `Jobs/LessonWorker` — фоновая очередь уроков: источники → отбор → генерация (диагностика для урока 1,
  дальше урок N по плану и записям об усвоенном) → валидация → `ready`; история уроков в таблице `Lessons`.
- `Jobs/SourcesJobs` — фоновый поиск источников с опросом статуса (web search дольше таймаута HTTP на телефоне).
- `Endpoints/ContentEndpoints` — `/subjects/focus`, `/subjects/sources` (+ `GET …/{jobId}`), `/subjects/plan`,
  `POST /subjects`, `GET /subjects/{id}/lesson` (с номером урока), `POST /sessions/{id}/recap` (записи + следующий урок),
  `POST /grade/free`. Контракт и поведение — `docs/ai-content.md`.

Подключение клиента: `EXPO_PUBLIC_CONTENT_URL=http://<host>:5180` (на устройстве — IP Mac в той же сети).
Реальная модель прогнана 2026-09-09: фокусы (5 с), источники с web search (~30 с при `effort: low`, 2 запроса), план (6 с),
оценка ответа на Haiku (1.4 с), стартовая диагностика (20 с) и урок 2 по записям разбора (18 с) — оба валидны с первой попытки.
Сырой ответ модели пишется в лог на уровне Debug.
