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
- `Teach__Db` — строка подключения SQLite (по умолчанию `Data Source=teach.db`).
- `Teach__StageDelayMs` — пауза между этапами подготовки, только чтобы этапы были видны на карточке.
- `GET /health` показывает активную модель и версию промптов.

Тесты: `dotnet test server/Teach.slnx`.

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
- `Jobs/LessonWorker` — фоновая очередь: источники → отбор → генерация диагностики → валидация → `ready`.
- `Endpoints/ContentEndpoints` — `/subjects/focus`, `/subjects/sources`, `/subjects/plan`, `POST /subjects`,
  `GET /subjects/{id}/lesson`, `POST /sessions/{id}/recap`, `POST /grade/free`.

Подключение клиента: `EXPO_PUBLIC_CONTENT_URL=http://<host>:5180` (на устройстве — IP Mac в той же сети).
Реальная модель прогнана 2026-09-09: фокусы, источники с web search, план, оценка ответа и стартовая диагностика (20 с, валидна с первой попытки). Сырой ответ модели пишется в лог на уровне Debug.
