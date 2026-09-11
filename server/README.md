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
`Teach.Api/fly.toml` — конфигурация Fly.io: том `teach_data`, HTTPS, health-check, `kill_timeout` 160 с
под плавную остановку. Команды `fly` запускать из `server/Teach.Api` (там лежат Dockerfile и fly.toml). Порядок:

```bash
cd server/Teach.Api && fly apps create teach-tutor-api
fly volumes create teach_data --size 1
fly secrets set ANTHROPIC_API_KEY=... Teach__ApiToken=$(openssl rand -hex 24)
fly deploy && curl https://teach-tutor-api.fly.dev/health
```

Клиент собирается с `EXPO_PUBLIC_CONTENT_URL=https://teach-tutor-api.fly.dev` и `EXPO_PUBLIC_CONTENT_TOKEN=<тот же токен>`.

Доступ. Общий токен `Teach:ApiToken` остаётся: им ходят сборки до входа по Apple и он же админский — только он выдаёт и отзывает именные токены (`POST/GET/DELETE /admin/tokens`). Приложение после входа меняет Apple identityToken на токен аккаунта (`POST /auth/apple`, проверка подписи по ключам Apple, аудитория из `Teach:AppleAudience`), и предметы становятся видны только своему владельцу (`Subjects.OwnerId`, `GET /subjects` отдаёт свои). Предметы, созданные до этого, лежат у владельца `shared` и остаются доступны всем авторизованным: их и раньше видел каждый с общим токеном, а терять предметы тестировщиков при обновлении нельзя. Токены хранятся хешами (SHA-256), отзыв действует сразу и не трогает остальные.

Документация отдаётся сервером без токена: техническая страница `/docs/` (`wwwroot/docs/index.html`), функциональные требования `/docs/frd.html`, интерактивная справка API `/scalar` и описание `/openapi/v1.json` (Microsoft.AspNetCore.OpenApi + Scalar; сводки маршрутов заданы через `WithSummary`/`WithTags` в `ContentEndpoints`). Корень `/` перенаправляет на `/docs/`.

Деплой безопасен посреди генерации: по SIGINT воркер дорабатывает текущий урок при живом сервере
(замер на Fly: 22 с дожидания с ответами 200, затем ~10 с на перезапуск машины), незавершённые
предметы после старта ставятся в очередь заново. Логи: `fly logs --app teach-tutor-api`; копия базы
для разбора: `fly ssh sftp get /data/teach.db` и `/data/teach.db-wal` (в образе нет sqlite3).

Схема БД: `SchemaUpgrader` создаёт её в пустой базе и доводит существующую (новые таблицы и колонки из списка в коде), поэтому база на томе Fly переживает изменения моделей без ручных шагов. При добавлении колонки или таблицы дописать её в `SchemaUpgrader`.

## Как устроено

- `Contracts/` — DTO, зеркало `mobile/src/content/types.ts`.
- `Domain/StagePolicy.cs` — переход между этапами плана по результатам уроков (два уверенных урока подряд), страховка после шести уроков.
- `Domain/Lesson.cs` — модель урока с дискриминатором `type`; `LessonValidator` — смысловая проверка поверх схемы
  (варианты, перестановки, критерии, записи об усвоенном, бюджет текста по длительности). Не прошло — повтор генерации, до `MaxAttempts`.
- Схема структурированного вывода урока компактная: плоский шаг из 13 полей, вложенные массивы свёрнуты в строки
  (полная схема отвергается API как `Schema is too complex`). Таблица соответствия — `docs/ai-content.md`, «Контракт урока».
- `Model/ILessonModel` — провайдер модели. `ClaudeLessonModel`: Anthropic SDK, `claude-opus-5` для уроков и поиска источников с адаптивным thinking, `claude-sonnet-5` для фокусов, имени и плана,
  структурированный вывод по JSON-схеме, кэш промпта на методике и контексте предмета, web search для источников;
  `claude-haiku-4-5` для оценки свободных ответов. `StubLessonModel`: данные прототипа.
- `Model/Prompts.cs` — версионированные промпты; версия пишется в урок.
- `Jobs/LessonWorker` — фоновая очередь уроков: источники → отбор → генерация (диагностика для урока 1,
  дальше урок N по плану и записям об усвоенном) → валидация → `ready`; история уроков в таблице `Lessons`.
- `Jobs/SourcesJobs` — фоновый поиск источников с опросом статуса (web search дольше таймаута HTTP на телефоне).
- `Endpoints/ContentEndpoints` — `/subjects/focus`, `/subjects/sources` (+ `GET …/{jobId}`), `/subjects/plan`,
  `POST /subjects`, `GET /subjects/{id}/lesson` (с номером урока), `POST /sessions/{id}/recap` (записи + следующий урок),
  `GET /subjects/{id}/lessons` (все уроки предмета по номерам: по ним клиент восстанавливает вопросы старых карточек повторов),
  `POST /subjects/{id}/prefetch` (заготовка урока N+1, пока идёт урок N; используется при разборе, если этап не сменился и ≥ 50 % верных),
  плавная остановка (`DrainingLifetime`): после SIGINT/SIGTERM воркер дорабатывает текущий урок при живом сервере, потом хост останавливается (`Teach:ShutdownSeconds`, `kill_timeout` в fly.toml),
  `POST /grade/free`. Контракт и поведение — `docs/ai-content.md`.

Подключение клиента: `EXPO_PUBLIC_CONTENT_URL=http://<host>:5180` (на устройстве — IP Mac в той же сети).
Реальная модель прогнана 2026-09-09: фокусы (5 с), источники с web search (~30 с при `effort: low`, 2 запроса), план (6 с),
оценка ответа на Haiku (1.4 с), стартовая диагностика (20 с) и урок 2 по записям разбора (18 с) — оба валидны с первой попытки.
Сырой ответ модели пишется в лог на уровне Debug.
