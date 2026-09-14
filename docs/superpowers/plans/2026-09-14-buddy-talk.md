# Разговор с бадди — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Свободный голосовой разговор с бадди по теме предмета: вход с «Сегодня», экран с доком и большим микрофоном, ответ бадди стримится с сервера и озвучивается системным голосом с первого предложения, контекст экономит токены.

**Architecture:** Голос через модель не проходит: платформенный STT на телефоне даёт текст → `POST /talks/{id}/turns` отдаёт реплику бадди по SSE → клиент режет поток на предложения и озвучивает `expo-speech`. На сервере разговор хранится в таблице `Talks` (последние 10 реплик плюс свёртка старых), бадди опирается на дайджест предмета в `Subjects.DigestText`, который собирает haiku после каждого урока. Промпт из трёх кэшируемых слоёв: персона, дайджест, хвост диалога. На клиенте чистая стейт-машина `talkMachine` (waiting → listening → thinking → speaking) поверх уже существующих `recognizer`, `speak`, `BuddyMark`, `SessionHeader`, `MicButton`.

**Tech Stack:** .NET 10, EF Core + SQLite, Anthropic SDK 12.46 (`CreateStreaming`), xUnit; React Native 0.86 / Expo SDK 57, `expo/fetch` (стриминг ответа), `expo-speech-recognition`, `expo-speech`, zustand, jest-expo.

**Spec:** FRD FR-66, FR-67, FR-68 и SR-16 в `server/Teach.Api/wwwroot/docs/frd.html`; тех. описание в `server/Teach.Api/wwwroot/docs/index.html` («Голосовой разговор с бадди (план)»); макет — канвас «Разговор с бадди» (Claude Design, светлая и тёмная темы); тест-кейсы M-01…M-14 в `docs/qa/make_qa_doc.py`; док бадди — `docs/superpowers/specs/2026-09-12-buddy-dock-design.md`.

## Global Constraints

- Реплики бадди на «ты», интерфейс на «вы» (решение владельца 2026-09-14). Слова дока в разговоре: «Ваш ход», «Слушаю», «Думаю», «Говорю» (en: Your turn, Listening, Thinking, Speaking).
- Ответ бадди устный: 1–3 предложения, без markdown, списков и заголовков; `max_tokens` ≈ 400 с учётом thinking; модель разговора `claude-sonnet-5`, effort `low`; дайджест и свёртка истории на `claude-haiku-4-5`.
- Дайджест предмета ≤ 2000 символов текста; собирается после каждого урока задачей воркера, не на каждую реплику; уроки целиком в контекст разговора не попадают.
- История разговора на сервере: последние 10 реплик как есть, старое свёрнуто в 2 фразы (`OlderSummary`).
- Голос никогда не блокирует: без STT строки «Поговорить с бадди» на «Сегодня» нет; сбой сети посреди разговора возвращает «Ваш ход», прошлые реплики остаются.
- Ничего из разговора не хранится в SQLite клиента; крестик выходит без подтверждения и останавливает запись и озвучку.
- Все новые маршруты требуют bearer-токен (как остальные, кроме `/health`, `/app/latest`, `/docs`).
- FR-68 (записи из разговора) в этот план не входит; `POST /talks/{id}/end` лишь помечает разговор завершённым, чтобы FR-68 подключился без смены контракта.
- Тесты: `cd server && dotnet test`; `cd mobile && npx tsc --noEmit && npx jest`. Коммит после каждой задачи; коммиты заканчиваются строкой `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- После кода: `graphify update .` из корня репозитория (CLAUDE.md).

## Контракт (общий для всех задач)

```
POST /subjects/{id}/talks                    → 201 { talkId }                     создать разговор; если дайджеста нет — собрать синхронно
POST /talks/{talkId}/turns  { text }          → 200 text/event-stream               text "" — вступительная реплика бадди
   data: {"t":"delta","text":"…"}\n\n         кусок ответа
   data: {"t":"done","reply":"…","turn":3}\n\n полный ответ и номер реплики бадди
   data: {"t":"error","message":"…"}\n\n       ошибка модели; поток закрывается
POST /talks/{talkId}/end                      → 202 { status: "ended" }
```

Маршруты ниже дают 404 на чужой или несуществующий разговор, 409 на реплику в завершённый разговор.

## Файлы

Сервер (`server/Teach.Api`):
- Modify `Data/TeachDb.cs` — `TalkRow`, колонки `DigestText`/`DigestLesson` у `SubjectRow`.
- Modify `Data/SchemaUpgrader.cs` — таблица `Talks`, две колонки.
- Create `Domain/TalkHistory.cs` — `TalkTurn`, `Trim`, `ToMessages` (чистые функции).
- Modify `Contracts/Dtos.cs` — `TalkCreated`, `TurnRequest`, `TalkEnded`.
- Modify `Model/Prompts.cs` — `Buddy`, `Digest`, `FoldTalk`.
- Modify `Model/ILessonModel.cs` — `BuildDigestAsync`, `SummarizeTalkAsync`, `TalkAsync`.
- Modify `Model/StubLessonModel.cs`, `Model/ClaudeLessonModel.cs` — реализации.
- Modify `Jobs/LessonWorker.cs` — `LessonJobKind.Digest`, `DigestAsync`, постановка после `PublishAsync`.
- Create `Endpoints/TalkEndpoints.cs` — три маршрута, SSE.
- Modify `Program.cs` — `app.MapTalks()`.
- Tests: `Teach.Api.Tests/TalkHistoryTests.cs`, `Teach.Api.Tests/TalkApiTests.cs`, дополнение `SchemaUpgraderTests.cs`.

Клиент (`mobile`):
- Create `src/content/sse.ts` — парсер SSE-событий из кусков текста.
- Create `src/content/streamFetch.ts` — `expo/fetch` за интерфейсом, чтобы jest подменял.
- Modify `src/content/types.ts`, `src/content/http.ts`, `src/content/local.ts` — `startTalk`, `talkTurn`, `endTalk`.
- Create `src/features/talk/sentences.ts` — резка стрима на предложения.
- Create `src/features/talk/talkMachine.ts` — стейт-машина разговора.
- Create `src/features/talk/useTalk.ts` — хук: STT + сервер + озвучка + машина.
- Create `src/features/talk/useSttAvailable.ts` — доступен ли STT (для строки на «Сегодня»).
- Modify `src/ui/BuddyDockView.tsx` (create) и `src/features/session/BuddyDock.tsx` — вид дока отделяется от стейт-машины сессии.
- Create `app/talk/[id].tsx`; Modify `app/_layout.tsx`.
- Modify `src/features/today/SubjectCard.tsx`, `app/(tabs)/today.tsx` — строка «Поговорить с бадди».
- Modify `src/i18n/ru.ts`, `src/i18n/en.ts`.
- Modify `src/voice/types.ts`, `src/voice/native.ts` — категория аудиосессии для одновременной записи и озвучки.
- Tests: `src/content/__tests__/sse.test.ts`, `src/content/__tests__/http.test.ts`, `src/features/talk/__tests__/sentences.test.ts`, `src/features/talk/__tests__/talkMachine.test.ts`, `src/ui/__tests__/BuddyDockView.test.tsx`, `src/features/today/__tests__/SubjectCard.test.tsx`.

Документация (в последних задачах): `docs/ai-content.md`, `server/README.md`, `mobile/README.md`, `server/Teach.Api/wwwroot/docs/index.html` (маршруты, убрать «(план)»), `frd.html` (статусы FR-66/67, SR-16 → «Реализовано»), `docs/qa/make_qa_doc.py` (вводный абзац 5.13).

---

## Часть A. Сервер

### Task 1: Схема — таблица Talks и дайджест предмета

**Files:**
- Modify: `server/Teach.Api/Data/TeachDb.cs`
- Modify: `server/Teach.Api/Data/SchemaUpgrader.cs`
- Test: `server/Teach.Api.Tests/SchemaUpgraderTests.cs`

**Interfaces:**
- Produces: `TalkRow { Guid Id; Guid SubjectId; string OwnerId; string TurnsJson; string? OlderSummary; bool Ended; DateTimeOffset StartedAt; DateTimeOffset UpdatedAt }`, `TeachDb.Talks`, `SubjectRow.DigestText (string?)`, `SubjectRow.DigestLesson (int)`.

- [ ] **Step 1: Дополнить тест апгрейдера**

В `SchemaUpgraderTests.AddsMissingTablesAndColumnsToAnOldDatabase` после `db.Lessons.Add(...)` добавить:

```csharp
            db.Talks.Add(new TalkRow { Id = Guid.NewGuid(), SubjectId = Guid.NewGuid(), OwnerId = "shared", TurnsJson = "[]", StartedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow });
            var subj = await db.Subjects.FirstAsync(x => x.Title == "T");
            subj.DigestText = "digest";
            subj.DigestLesson = 2;
```

и перед `Assert.Equal(1, ...)`: `await db.SaveChangesAsync(); Assert.Equal(1, await db.Talks.CountAsync()); Assert.Equal("digest", (await db.Subjects.FirstAsync(x => x.Title == "T")).DigestText);`.

- [ ] **Step 2: Прогнать — падает на компиляции** (`TalkRow`, `Talks`, `DigestText` не существуют)

Run: `cd server && dotnet test --filter SchemaUpgraderTests`
Expected: build error `'TeachDb' does not contain a definition for 'Talks'`.

- [ ] **Step 3: Модель**

В `TeachDb.cs` к `SubjectRow` добавить:

```csharp
    /// <summary>Дайджест предмета для разговора с бадди: тема, этап, глоссарий, свёртка записей (≤ 2000 символов).</summary>
    public string? DigestText { get; set; }
    /// <summary>Номер урока, после которого собран дайджест; 0 — нет.</summary>
    public int DigestLesson { get; set; }
```

Новый класс перед `TeachDb`:

```csharp
/// <summary>Разговор с бадди: последние реплики как есть, старое свёрнуто в OlderSummary.</summary>
public sealed class TalkRow
{
    public Guid Id { get; set; }
    public Guid SubjectId { get; set; }
    public required string OwnerId { get; set; }
    /// <summary>JSON-массив Domain.TalkTurn (role: user | buddy).</summary>
    public required string TurnsJson { get; set; }
    public string? OlderSummary { get; set; }
    public bool Ended { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
```

В `TeachDb`: `public DbSet<TalkRow> Talks => Set<TalkRow>();` и в `OnModelCreating`:

```csharp
        b.Entity<TalkRow>().HasKey(x => x.Id);
        b.Entity<TalkRow>().HasIndex(x => x.SubjectId);
```

- [ ] **Step 4: Апгрейдер**

В `Columns` добавить:

```csharp
        ("Subjects", "DigestText", "ALTER TABLE Subjects ADD COLUMN DigestText TEXT NULL"),
        ("Subjects", "DigestLesson", "ALTER TABLE Subjects ADD COLUMN DigestLesson INTEGER NOT NULL DEFAULT 0"),
```

В `Tables` добавить:

```csharp
        ("Talks", """
            CREATE TABLE IF NOT EXISTS Talks (
              Id TEXT NOT NULL CONSTRAINT PK_Talks PRIMARY KEY,
              SubjectId TEXT NOT NULL, OwnerId TEXT NOT NULL, TurnsJson TEXT NOT NULL, OlderSummary TEXT NULL,
              Ended INTEGER NOT NULL DEFAULT 0, StartedAt TEXT NOT NULL, UpdatedAt TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS IX_Talks_SubjectId ON Talks (SubjectId);
            """),
```

- [ ] **Step 5: Прогнать все серверные тесты**

Run: `cd server && dotnet test`
Expected: все зелёные, в том числе `SchemaUpgraderTests`.

- [ ] **Step 6: Commit**

```bash
git add server/Teach.Api/Data server/Teach.Api.Tests/SchemaUpgraderTests.cs
git commit -m "Talks: schema for buddy conversations and the subject digest"
```

### Task 2: Домен — реплики, обрезка истории, промпты, контракты

**Files:**
- Create: `server/Teach.Api/Domain/TalkHistory.cs`
- Modify: `server/Teach.Api/Model/Prompts.cs`
- Modify: `server/Teach.Api/Contracts/Dtos.cs`
- Test: `server/Teach.Api.Tests/TalkHistoryTests.cs`

**Interfaces:**
- Produces: `record TalkTurn(string Role, string Text)` (Role: `"user"` | `"buddy"`); `TalkHistory.Keep = 10`; `TalkHistory.Trim(IReadOnlyList<TalkTurn> turns) → (IReadOnlyList<TalkTurn> Kept, IReadOnlyList<TalkTurn> Dropped)`; `TalkHistory.Transcript(IReadOnlyList<TalkTurn>) → string` («Ученик: …\nБадди: …»); `Prompts.Buddy`, `Prompts.Digest`, `Prompts.FoldTalk`; DTO `TalkCreated(string TalkId)`, `TurnRequest(string Text)`, `TalkEnded(string Status)`.

- [ ] **Step 1: Тесты**

`server/Teach.Api.Tests/TalkHistoryTests.cs`:

```csharp
using Teach.Api.Domain;

namespace Teach.Api.Tests;

public class TalkHistoryTests
{
    private static List<TalkTurn> Turns(int n) => Enumerable.Range(1, n).Select(i => new TalkTurn(i % 2 == 1 ? "buddy" : "user", $"t{i}")).ToList();

    [Fact]
    public void KeepsShortHistoryAsIs()
    {
        var (kept, dropped) = TalkHistory.Trim(Turns(10));
        Assert.Equal(10, kept.Count);
        Assert.Empty(dropped);
    }

    [Fact]
    public void DropsOldestBeyondTenKeepingOrder()
    {
        var (kept, dropped) = TalkHistory.Trim(Turns(13));
        Assert.Equal(["t1", "t2", "t3"], dropped.Select(t => t.Text));
        Assert.Equal("t4", kept[0].Text);
        Assert.Equal("t13", kept[^1].Text);
    }

    [Fact]
    public void TranscriptLabelsSpeakers()
    {
        var text = TalkHistory.Transcript([new("buddy", "Привет"), new("user", "Hola")]);
        Assert.Equal("Бадди: Привет\nУченик: Hola", text);
    }
}
```

- [ ] **Step 2: Прогнать — не компилируется**

Run: `cd server && dotnet test --filter TalkHistoryTests`
Expected: build error `The type or namespace name 'TalkTurn' could not be found`.

- [ ] **Step 3: Реализация**

`server/Teach.Api/Domain/TalkHistory.cs`:

```csharp
namespace Teach.Api.Domain;

/// <summary>Реплика разговора с бадди. Role: user | buddy.</summary>
public sealed record TalkTurn(string Role, string Text);

/// <summary>История разговора: последние Keep реплик как есть, всё старше сворачивается в две фразы (FR-67).</summary>
public static class TalkHistory
{
    public const int Keep = 10;

    public static (IReadOnlyList<TalkTurn> Kept, IReadOnlyList<TalkTurn> Dropped) Trim(IReadOnlyList<TalkTurn> turns)
    {
        if (turns.Count <= Keep) return (turns, []);
        var cut = turns.Count - Keep;
        return (turns.Skip(cut).ToList(), turns.Take(cut).ToList());
    }

    public static string Transcript(IReadOnlyList<TalkTurn> turns) =>
        string.Join("\n", turns.Select(t => (t.Role == "buddy" ? "Бадди: " : "Ученик: ") + t.Text));
}
```

В `Prompts.cs` добавить три константы после `System`:

```csharp
    /// <summary>Персона бадди для разговора. Одинакова для всех → кэшируется. Обращение на «ты» — характер персонажа.</summary>
    public const string Buddy = """
        Ты — бадди из Teach: живой знак приложения, спутник ученика. Вы разговариваете голосом, поэтому:
        - Отвечай 1–3 короткими предложениями, как в устной речи. Без списков, заголовков, markdown и эмодзи.
        - Обращайся к ученику на «ты», дружелюбно и по делу, без восторгов и без нотаций.
        - Держись темы предмета и текущего этапа из дайджеста. На постороннее отвечай одной фразой и возвращай к теме.
        - Опирайся на записи об ошибках из дайджеста: напоминай конкретные вещи, которые ученик путал, и давай их проговорить.
        - Для языкового предмета: фразы для отработки давай на языке предмета, пояснения — на языке ученика. Поправляй ошибку сразу и коротко, потом проси повторить или продолжить.
        - Каждую реплику заканчивай вопросом или маленькой задачей, чтобы ученик говорил больше тебя.
        - Если ученик просит закончить, попрощайся одной фразой.
        Реплика с пометкой «(начни разговор)» — начало: поздоровайся, обозначь тему одной фразой и задай первый вопрос.
        """;

    /// <summary>Дайджест предмета для разговора: сжатие темы, этапа, глоссария и записей.</summary>
    public const string Digest = """
        Ты готовишь краткую справку о предмете для устного разговора репетитора с учеником. Ответь одним текстом до 1800 символов без markdown, в пяти абзацах:
        1) предмет, фокус и миссия ученика в одной-двух фразах;
        2) текущий этап плана и что на нём отрабатывается;
        3) термины и конструкции, которые ученик уже знает (из глоссария), через запятую;
        4) что ученик путал или не знал по записям: конкретно, с примерами, 3–6 пунктов текстом;
        5) что ученик отвечал уверенно, 2–4 пункта.
        Пиши на русском, термины на языке предмета оставляй как есть.
        """;

    /// <summary>Свёртка старых реплик разговора в две фразы.</summary>
    public const string FoldTalk = """
        Сверни фрагмент разговора репетитора с учеником в две фразы на русском: о чём говорили и что ученик показал (уверенно / путал). Без markdown. Если дана прежняя свёртка, объедини её с новым фрагментом.
        """;
```

В `Dtos.cs` в конец:

```csharp
/// <summary>POST /subjects/{id}/talks → id разговора.</summary>
public sealed record TalkCreated(string TalkId);

/// <summary>POST /talks/{id}/turns: распознанная реплика ученика; пустая строка — просьба начать разговор.</summary>
public sealed record TurnRequest(string Text);

public sealed record TalkEnded(string Status);
```

- [ ] **Step 4: Прогнать**

Run: `cd server && dotnet test --filter TalkHistoryTests`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add server/Teach.Api/Domain/TalkHistory.cs server/Teach.Api/Model/Prompts.cs server/Teach.Api/Contracts/Dtos.cs server/Teach.Api.Tests/TalkHistoryTests.cs
git commit -m "Talks: turn history trimming, buddy/digest/fold prompts, DTOs"
```

### Task 3: Провайдер модели — интерфейс, заглушка, Claude

**Files:**
- Modify: `server/Teach.Api/Model/ILessonModel.cs`
- Modify: `server/Teach.Api/Model/StubLessonModel.cs`
- Modify: `server/Teach.Api/Model/ClaudeLessonModel.cs`
- Test: `server/Teach.Api.Tests/TalkHistoryTests.cs` (тесты заглушки в том же файле)

**Interfaces:**
- Consumes: `TalkTurn`, `TalkHistory.Transcript`, `Prompts.Buddy/Digest/FoldTalk` (Task 2); `SubjectDraft`, `PlanStage`, `RecapRecord`, `RefRowDto` (существующие).
- Produces на `ILessonModel`:
  - `Task<string> BuildDigestAsync(SubjectDraft draft, PlanStage stage, int stageIndex, IReadOnlyList<RecapRecord> records, IReadOnlyList<RefRowDto> glossary, CancellationToken ct)`
  - `Task<string> SummarizeTalkAsync(string? olderSummary, IReadOnlyList<TalkTurn> dropped, CancellationToken ct)`
  - `IAsyncEnumerable<string> TalkAsync(string digest, string? olderSummary, IReadOnlyList<TalkTurn> history, string userText, CancellationToken ct)` — куски текста ответа; `userText == ""` означает вступительную реплику.
  - `ClaudeLessonModel.TalkModel = "claude-sonnet-5"`.

- [ ] **Step 1: Тесты заглушки**

Добавить в `TalkHistoryTests.cs` класс:

```csharp
public class StubTalkTests
{
    private readonly StubLessonModel _m = new();

    [Fact]
    public async Task DigestMentionsStageAndMistakes()
    {
        var draft = new SubjectDraft("Испанский", "Разговорные фразы", "поездка в Мадрид", [], Title: "Испанский");
        var digest = await _m.BuildDigestAsync(draft, new("02", "Первые фразы для поездки", "заказ, счёт, дорога"), 1,
            [new("cuesta vs cuestan", "число глагола", false, 2, 4), new("por favor", "вежливая просьба", true, 1, 3)],
            [new("la cuenta", "счёт")], CancellationToken.None);
        Assert.Contains("Первые фразы для поездки", digest);
        Assert.Contains("cuesta vs cuestan", digest);
        Assert.Contains("la cuenta", digest);
        Assert.True(digest.Length <= 2000);
    }

    [Fact]
    public async Task TalkOpensThenAnswersWithAQuestion()
    {
        var opening = string.Concat(await Collect(_m.TalkAsync("digest", null, [], "", CancellationToken.None)));
        Assert.Contains("?", opening);
        var reply = string.Concat(await Collect(_m.TalkAsync("digest", null, [new("buddy", opening)], "Hola", CancellationToken.None)));
        Assert.Contains("Hola", reply);
        Assert.EndsWith("?", reply.TrimEnd());
    }

    [Fact]
    public async Task FoldJoinsPreviousSummary()
    {
        var s = await _m.SummarizeTalkAsync("Раньше: говорили о кафе.", [new("user", "¿Cuánto cuesta?"), new("buddy", "Sí.")], CancellationToken.None);
        Assert.StartsWith("Раньше: говорили о кафе.", s);
        Assert.Contains("2 реплик", s);
    }

    private static async Task<List<string>> Collect(IAsyncEnumerable<string> src)
    {
        var list = new List<string>();
        await foreach (var x in src) list.Add(x);
        return list;
    }
}
```

Добавить `using Teach.Api.Contracts; using Teach.Api.Model;` вверху файла.

- [ ] **Step 2: Прогнать — не компилируется**

Run: `cd server && dotnet test --filter StubTalkTests`
Expected: build error `'StubLessonModel' does not contain a definition for 'BuildDigestAsync'`.

- [ ] **Step 3: Интерфейс**

В `ILessonModel.cs` перед закрывающей скобкой:

```csharp
    /// <summary>Дайджест предмета для разговора с бадди (FR-67): ≤ 2000 символов, собирается после урока, не на реплику.</summary>
    Task<string> BuildDigestAsync(SubjectDraft draft, PlanStage stage, int stageIndex, IReadOnlyList<RecapRecord> records, IReadOnlyList<RefRowDto> glossary, CancellationToken ct);
    /// <summary>Свёртка выпавших из окна реплик разговора в две фразы; olderSummary — прежняя свёртка.</summary>
    Task<string> SummarizeTalkAsync(string? olderSummary, IReadOnlyList<TalkTurn> dropped, CancellationToken ct);
    /// <summary>Реплика бадди по кускам; userText "" — вступление.</summary>
    IAsyncEnumerable<string> TalkAsync(string digest, string? olderSummary, IReadOnlyList<TalkTurn> history, string userText, CancellationToken ct);
```

- [ ] **Step 4: Заглушка**

В `StubLessonModel.cs` перед `[GeneratedRegex(...)]`:

```csharp
    public Task<string> BuildDigestAsync(SubjectDraft draft, PlanStage stage, int stageIndex, IReadOnlyList<RecapRecord> records, IReadOnlyList<RefRowDto> glossary, CancellationToken ct)
    {
        var wrong = records.Where(r => !r.Ok).Select(r => $"{r.Title} ({r.Note})").ToList();
        var right = records.Where(r => r.Ok).Select(r => r.Title).ToList();
        var text = $"""
            Предмет: {draft.Title ?? draft.Topic}. Фокус: {draft.Focus}. Миссия: {draft.Mission}.
            Этап {stage.N} · {stage.T}: {stage.D}.
            Знает: {(glossary.Count == 0 ? "пока ничего" : string.Join(", ", glossary.Select(g => g.K)))}.
            Путал: {(wrong.Count == 0 ? "ошибок ещё не было" : string.Join("; ", wrong))}.
            Уверенно: {(right.Count == 0 ? "пока нечего отметить" : string.Join("; ", right))}.
            """;
        return Task.FromResult(text.Length <= 2000 ? text : text[..2000]);
    }

    public Task<string> SummarizeTalkAsync(string? olderSummary, IReadOnlyList<TalkTurn> dropped, CancellationToken ct) =>
        Task.FromResult(($"{olderSummary} " + $"Свёрнуто {dropped.Count} реплик: {string.Join(" / ", dropped.Select(t => t.Text))}.").Trim());

    public async IAsyncEnumerable<string> TalkAsync(string digest, string? olderSummary, IReadOnlyList<TalkTurn> history, string userText, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        var reply = userText.Length == 0
            ? "Привет. Давай немного поговорим по теме. С чего начнём?"
            : $"Ты сказал: «{userText}». Хорошо, продолжим. Что скажешь дальше?";
        foreach (var word in reply.Split(' '))
        {
            await Task.Delay(5, ct);
            yield return word + " ";
        }
    }
```

Добавить вверху `using Teach.Api.Domain;`, если его нет (там уже есть).

- [ ] **Step 5: Прогнать тесты заглушки**

Run: `cd server && dotnet test --filter StubTalkTests`
Expected: 3 passed. (`reply` в тесте содержит лишний пробел в конце — потому `TrimEnd()`.)

- [ ] **Step 6: Claude**

В `ClaudeLessonModel.cs` рядом с `GradeModel`:

```csharp
    /// <summary>Разговор с бадди: быстрый ответ, низкий effort, короткие реплики.</summary>
    public const string TalkModel = "claude-sonnet-5";
```

Методы (перед `SubjectContext`):

```csharp
    public async Task<string> BuildDigestAsync(SubjectDraft draft, PlanStage stage, int stageIndex, IReadOnlyList<RecapRecord> records, IReadOnlyList<RefRowDto> glossary, CancellationToken ct)
    {
        var recs = records.Count == 0 ? "- записей пока нет" : string.Join("\n", records.Select(r => $"- урок {r.LessonNumber}, {(r.Ok ? "верно" : "ошибка")}: {r.Title} — {r.Note}"));
        var gl = glossary.Count == 0 ? "- пока пуст" : string.Join("\n", glossary.Select(g => $"- {g.K}: {g.V}"));
        var response = await client.Messages.Create(new MessageCreateParams
        {
            Model = GradeModel,
            MaxTokens = 1200,
            System = Prompts.Digest,
            Messages = [new() { Role = Role.User, Content = $"""
                Предмет: {draft.Title ?? draft.Topic}
                Тема целиком: {draft.Topic}
                Фокус: {draft.Focus}
                Миссия: {draft.Mission}
                Текущий этап {stageIndex + 1}: {stage.N} · {stage.T} — {stage.D}
                Глоссарий:
                {gl}
                Записи разборов (по порядку):
                {recs}
                """ }],
        }, ct);
        var text = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text)).Trim();
        log.LogInformation("digest: in={In} out={Out} chars={Chars}", response.Usage.InputTokens, response.Usage.OutputTokens, text.Length);
        return text.Length <= 2000 ? text : text[..2000];
    }

    public async Task<string> SummarizeTalkAsync(string? olderSummary, IReadOnlyList<TalkTurn> dropped, CancellationToken ct)
    {
        var response = await client.Messages.Create(new MessageCreateParams
        {
            Model = GradeModel,
            MaxTokens = 300,
            System = Prompts.FoldTalk,
            Messages = [new() { Role = Role.User, Content = $"Прежняя свёртка: {olderSummary ?? "нет"}\n\nФрагмент:\n{TalkHistory.Transcript(dropped)}" }],
        }, ct);
        return string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text)).Trim();
    }

    public async IAsyncEnumerable<string> TalkAsync(string digest, string? olderSummary, IReadOnlyList<TalkTurn> history, string userText, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        // Слои кэша: персона (system) → дайджест (первое сообщение) → хвост диалога. Роли чередуются:
        // дайджест и вступительная просьба идут одним user-сообщением, история — как есть.
        var messages = new List<MessageParam>();
        var head = new List<ContentBlockParam>
        {
            new TextBlockParam { Text = $"Дайджест предмета:\n{digest}", CacheControl = new CacheControlEphemeral() },
        };
        if (olderSummary is not null) head.Add(new TextBlockParam { Text = $"Раньше в этом разговоре: {olderSummary}" });
        head.Add(new TextBlockParam { Text = "(начни разговор)" });
        messages.Add(new() { Role = Role.User, Content = head });
        foreach (var t in history)
            messages.Add(new() { Role = t.Role == "buddy" ? Role.Assistant : Role.User, Content = t.Text });
        if (userText.Length > 0) messages.Add(new() { Role = Role.User, Content = userText });
        // Две user-реплики подряд (история начинается с user после вступления, которого нет в history) недопустимы:
        // если последнее сообщение — user и следующее тоже user, склеиваем.
        for (var i = messages.Count - 1; i > 0; i--)
            if (messages[i].Role == Role.User && messages[i - 1].Role == Role.User)
            {
                messages[i - 1] = new() { Role = Role.User, Content = messages[i - 1].Content + "\n" + messages[i].Content };
                messages.RemoveAt(i);
            }

        var p = new MessageCreateParams
        {
            Model = TalkModel,
            MaxTokens = 400,
            System = new List<TextBlockParam> { new() { Text = Prompts.Buddy, CacheControl = new CacheControlEphemeral() } },
            Messages = messages,
            Thinking = new ThinkingConfigAdaptive(),
            OutputConfig = new OutputConfig { Effort = Effort.Low },
        };
        var started = DateTimeOffset.UtcNow;
        var first = true;
        await foreach (var ev in client.Messages.CreateStreaming(p, ct))
        {
            if (ev.TryPickContentBlockDelta(out var delta) && delta.Delta.TryPickText(out var text))
            {
                if (first) { log.LogInformation("talk: first token after {Ms} ms", (DateTimeOffset.UtcNow - started).TotalMilliseconds); first = false; }
                yield return text.Text;
            }
        }
    }
```

Если `MessageParam.Content` — не строка, а объединение (`ContentBlockParam`-список): склейку двух user-сообщений заменить на добавление `new TextBlockParam { Text = ... }` в список `head`, когда история пуста, и на отдельную проверку «первая реплика истории — user» с объединением её текста в `head` до отправки. Компилятор подскажет точный тип; правило одно — роли чередуются, первое сообщение user.

- [ ] **Step 7: Собрать**

Run: `cd server && dotnet build Teach.Api`
Expected: 0 warnings по новым файлам, 0 errors. Полный `dotnet test` — зелёный.

- [ ] **Step 8: Commit**

```bash
git add server/Teach.Api/Model server/Teach.Api.Tests/TalkHistoryTests.cs
git commit -m "Talks: model provider — digest, fold and streaming talk (stub + Claude)"
```

### Task 4: Дайджест собирается воркером после урока

**Files:**
- Modify: `server/Teach.Api/Jobs/LessonWorker.cs`
- Test: `server/Teach.Api.Tests/TalkApiTests.cs` (создать)

**Interfaces:**
- Consumes: `ILessonModel.BuildDigestAsync` (Task 3), `SubjectRow.DigestText/DigestLesson` (Task 1).
- Produces: `LessonJobKind.Digest`; `LessonWorker.BuildDigestAsync(TeachDb db, SubjectRow s, CancellationToken ct)` — публичный статический помощник не нужен; эндпоинт разговора (Task 5) вызывает `DigestService.EnsureAsync`. Поэтому здесь создаётся `Jobs/DigestService.cs`:
  - `public sealed class DigestService(ILessonModel model, ILogger<DigestService> log)` с `Task<string> EnsureAsync(TeachDb db, SubjectRow s, CancellationToken ct)` — возвращает актуальный дайджест: если `s.DigestLesson == s.LessonNumber && s.DigestText is not null`, отдаёт его; иначе собирает по записям и глоссарию, сохраняет и отдаёт.

- [ ] **Step 1: Тест — после готовности урока дайджест лежит в предмете**

`server/Teach.Api.Tests/TalkApiTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Teach.Api.Contracts;
using Teach.Api.Data;

namespace Teach.Api.Tests;

public class TalkApiTests(ApiFactory f) : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _http = f.CreateClient();

    private async Task<string> ReadySubjectAsync()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("Испанский", "Разговорные фразы", "поездка в Мадрид", ["src-0"], Title: "Испанский"));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        for (var i = 0; i < 200; i++)
        {
            var st = await _http.GetFromJsonAsync<LessonStatus>($"/subjects/{id}/lesson", Json);
            if (st!.Status == "ready") return id;
            await Task.Delay(20);
        }
        throw new Exception("lesson never ready");
    }

    private async Task<SubjectRow> RowAsync(string id)
    {
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        return await db.Subjects.AsNoTracking().FirstAsync(x => x.Id == Guid.Parse(id));
    }

    [Fact]
    public async Task DigestIsBuiltAfterTheLessonIsReady()
    {
        var id = await ReadySubjectAsync();
        SubjectRow? row = null;
        for (var i = 0; i < 100; i++)
        {
            row = await RowAsync(id);
            if (row.DigestLesson == 1) break;
            await Task.Delay(20);
        }
        Assert.Equal(1, row!.DigestLesson);
        Assert.Contains("Испанский", row.DigestText);
        Assert.Contains("Этап 01", row.DigestText);
    }
}
```

- [ ] **Step 2: Прогнать — падает**

Run: `cd server && dotnet test --filter DigestIsBuiltAfterTheLessonIsReady`
Expected: FAIL `Assert.Equal() Failure: Expected 1, Actual 0`.

- [ ] **Step 3: DigestService**

`server/Teach.Api/Jobs/DigestService.cs`:

```csharp
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Teach.Api.Contracts;
using Teach.Api.Data;
using Teach.Api.Model;

namespace Teach.Api.Jobs;

/// <summary>
/// Дайджест предмета для разговора с бадди (FR-67): собирается после урока задачей воркера,
/// а если разговор начался раньше — один раз синхронно. На каждую реплику не пересобирается.
/// </summary>
public sealed class DigestService(ILessonModel model, ILogger<DigestService> log)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<string> EnsureAsync(TeachDb db, SubjectRow s, CancellationToken ct)
    {
        if (s.DigestText is not null && s.DigestLesson == s.LessonNumber) return s.DigestText;
        var plan = Plans.Of(s);
        var stageIndex = Math.Min(s.PlanStage, plan.Length - 1);
        var draft = new SubjectDraft(s.Topic, s.Focus, s.Mission, [], Title: s.Title);
        var records = await db.Records.Where(r => r.SubjectId == s.Id.ToString()).OrderBy(r => r.Id)
            .Select(r => new RecapRecord(r.Title, r.Note, r.Ok, r.StepIndex, r.LessonNumber)).ToListAsync(ct);
        var glossaryRow = await db.References.AsNoTracking().FirstOrDefaultAsync(r => r.SubjectId == s.Id && r.Group == "Глоссарий", ct);
        var glossary = glossaryRow is null ? [] : JsonSerializer.Deserialize<List<RefRowDto>>(glossaryRow.RowsJson, Json) ?? [];
        var text = await model.BuildDigestAsync(draft, plan[stageIndex], stageIndex, records, glossary, ct);
        s.DigestText = text;
        s.DigestLesson = s.LessonNumber;
        s.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        log.LogInformation("subject {Subject}: digest built after lesson {Number} ({Chars} chars)", s.Id, s.LessonNumber, text.Length);
        return text;
    }
}
```

- [ ] **Step 4: Задача воркера**

В `LessonWorker.cs`: `public enum LessonJobKind { Prepare, Prefetch, Promote, Digest }`. В конструктор `LessonWorker` добавить параметр `DigestService digests` (после `WorkerOptions opts`). В `RunAsync` в `switch`: `case LessonJobKind.Digest: await DigestAsync(job.SubjectId, ct); break;`; в `catch` дайджест не должен помечать предмет как failed:

```csharp
            if (job.Kind == LessonJobKind.Prefetch) await ClearPrefetchAsync(job.SubjectId, ct);
            else if (job.Kind != LessonJobKind.Digest) await MarkFailedAsync(job.SubjectId, e.Message, ct);
```

Метод:

```csharp
    /// <summary>Дайджест для разговора с бадди — после того, как урок стал ready (клиент его не ждёт).</summary>
    private async Task DigestAsync(Guid id, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var s = await db.Subjects.FindAsync([id], ct);
        if (s is null || s.Status != SubjectStatus.Ready) return;
        await digests.EnsureAsync(db, s, ct);
    }
```

В конце `PublishAsync`, после строки с `log.LogInformation("subject {Subject} lesson {Number} ready ...")`: `await queue.EnqueueAsync(s.Id, LessonJobKind.Digest, ct);`.

В `Program.cs` перед `AddSingleton<LessonQueue>()`: `builder.Services.AddSingleton<DigestService>();`.

- [ ] **Step 5: Прогнать**

Run: `cd server && dotnet test`
Expected: все зелёные, включая новый тест (заглушка кладёт «Этап 01 · Каркас…» в дайджест).

- [ ] **Step 6: Commit**

```bash
git add server/Teach.Api/Jobs server/Teach.Api/Program.cs server/Teach.Api.Tests/TalkApiTests.cs
git commit -m "Talks: subject digest built by the worker after each lesson"
```

### Task 5: Эндпоинты разговора со стримингом (SR-16)

**Files:**
- Create: `server/Teach.Api/Endpoints/TalkEndpoints.cs`
- Modify: `server/Teach.Api/Program.cs` (`app.MapTalks();` после `app.MapContent();`)
- Modify: `server/Teach.Api/Endpoints/ContentEndpoints.cs` — сделать `Owns` `internal static`
- Test: `server/Teach.Api.Tests/TalkApiTests.cs`
- Docs: `docs/ai-content.md` (HTTP-контракт), `server/README.md` (раздел «Разговор с бадди» без «(план)», маршруты в «Как устроено»), `server/Teach.Api/wwwroot/docs/index.html` (три строки в таблице «Маршруты», убрать фразу «В таблице маршрутов появится после реализации», заголовок подраздела без «(план)»), `frd.html` (SR-16 → `chip done`).

**Interfaces:**
- Consumes: `TalkRow`, `DigestService.EnsureAsync`, `ILessonModel.TalkAsync/SummarizeTalkAsync`, `TalkHistory.Trim`, DTO `TalkCreated/TurnRequest/TalkEnded`.
- Produces: контракт из раздела «Контракт» выше. Формат событий: `data: {"t":"delta","text":"..."}`, `data: {"t":"done","reply":"...","turn":N}`, `data: {"t":"error","message":"..."}`; каждое событие заканчивается `\n\n`; заголовки `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.

- [ ] **Step 1: Тесты API**

Добавить в `TalkApiTests`:

```csharp
    private static async Task<List<JsonElement>> ReadEventsAsync(HttpResponseMessage res)
    {
        Assert.Equal("text/event-stream", res.Content.Headers.ContentType!.MediaType);
        var body = await res.Content.ReadAsStringAsync();
        return body.Split("\n\n", StringSplitOptions.RemoveEmptyEntries)
            .Select(chunk => chunk.Trim()).Where(chunk => chunk.StartsWith("data: "))
            .Select(chunk => JsonSerializer.Deserialize<JsonElement>(chunk[6..])).ToList();
    }

    [Fact]
    public async Task TalkOpensStreamsAndStoresTurns()
    {
        var id = await ReadySubjectAsync();
        var created = await _http.PostAsJsonAsync($"/subjects/{id}/talks", new { });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var talkId = (await created.Content.ReadFromJsonAsync<TalkCreated>(Json))!.TalkId;

        var opening = await ReadEventsAsync(await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest("")));
        Assert.True(opening.Count(e => e.GetProperty("t").GetString() == "delta") > 3);
        var done = opening.Last();
        Assert.Equal("done", done.GetProperty("t").GetString());
        Assert.Equal(1, done.GetProperty("turn").GetInt32());
        Assert.Contains("?", done.GetProperty("reply").GetString());

        var second = await ReadEventsAsync(await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest("Hola, un café por favor")));
        Assert.Equal(3, second.Last().GetProperty("turn").GetInt32());
        Assert.Contains("Hola, un café por favor", second.Last().GetProperty("reply").GetString());

        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var row = await db.Talks.AsNoTracking().FirstAsync(t => t.Id == Guid.Parse(talkId));
        var turns = JsonSerializer.Deserialize<Teach.Api.Domain.TalkTurn[]>(row.TurnsJson, Json)!;
        Assert.Equal(["buddy", "user", "buddy"], turns.Select(t => t.Role));
        Assert.False(row.Ended);
    }

    [Fact]
    public async Task OldTurnsAreFoldedIntoASummary()
    {
        var id = await ReadySubjectAsync();
        var talkId = (await (await _http.PostAsJsonAsync($"/subjects/{id}/talks", new { })).Content.ReadFromJsonAsync<TalkCreated>(Json))!.TalkId;
        await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest(""));
        for (var i = 1; i <= 6; i++) await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest($"реплика {i}"));
        // 1 + 6·2 = 13 реплик → хранится 10, три старших свёрнуты.
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var row = await db.Talks.AsNoTracking().FirstAsync(t => t.Id == Guid.Parse(talkId));
        var turns = JsonSerializer.Deserialize<Teach.Api.Domain.TalkTurn[]>(row.TurnsJson, Json)!;
        Assert.Equal(10, turns.Length);
        Assert.Contains("Свёрнуто 3 реплик", row.OlderSummary);
    }

    [Fact]
    public async Task EndedTalkRejectsTurnsAndStrangersGet404()
    {
        var id = await ReadySubjectAsync();
        var talkId = (await (await _http.PostAsJsonAsync($"/subjects/{id}/talks", new { })).Content.ReadFromJsonAsync<TalkCreated>(Json))!.TalkId;
        var ended = await _http.PostAsJsonAsync($"/talks/{talkId}/end", new { });
        Assert.Equal(HttpStatusCode.Accepted, ended.StatusCode);
        Assert.Equal("ended", (await ended.Content.ReadFromJsonAsync<TalkEnded>(Json))!.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest("ещё"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _http.PostAsJsonAsync($"/talks/{Guid.NewGuid()}/turns", new TurnRequest("x"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _http.PostAsJsonAsync($"/subjects/{Guid.NewGuid()}/talks", new { })).StatusCode);
    }
```

- [ ] **Step 2: Прогнать — 404 на `/subjects/{id}/talks`**

Run: `cd server && dotnet test --filter TalkApiTests`
Expected: три новых теста FAIL (`Expected Created, Actual NotFound`).

- [ ] **Step 3: Эндпоинты**

В `ContentEndpoints.cs`: `private static bool Owns(...)` → `internal static bool Owns(...)`.

`server/Teach.Api/Endpoints/TalkEndpoints.cs`:

```csharp
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Teach.Api.Auth;
using Teach.Api.Contracts;
using Teach.Api.Data;
using Teach.Api.Domain;
using Teach.Api.Jobs;
using Teach.Api.Model;

namespace Teach.Api.Endpoints;

/// <summary>
/// Разговор с бадди (FR-66, SR-16): текст с телефона → реплика бадди по SSE → озвучка на телефоне.
/// История живёт на сервере: последние TalkHistory.Keep реплик как есть, старое свёрнуто.
/// </summary>
public static class TalkEndpoints
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapTalks(this IEndpointRouteBuilder app)
    {
        app.MapPost("/subjects/{id:guid}/talks", async (Guid id, HttpContext ctx, TeachDb db, DigestService digests, CancellationToken ct) =>
        {
            var s = await db.Subjects.FindAsync([id], ct);
            if (s is null || !ContentEndpoints.Owns(ctx, s)) return Results.NotFound();
            if (s.Status != SubjectStatus.Ready) return Results.Conflict(new { error = "lesson not ready" });
            // Дайджест обычно уже собран воркером; если разговор начался раньше — собираем один раз здесь.
            await digests.EnsureAsync(db, s, ct);
            var talk = new TalkRow { Id = Guid.NewGuid(), SubjectId = id, OwnerId = AuthEndpoints.Caller(ctx).Owner, TurnsJson = "[]", StartedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            db.Talks.Add(talk);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/talks/{talk.Id}", new TalkCreated(talk.Id.ToString()));
        }).WithSummary("Начать разговор с бадди по предмету. Дайджест предмета собирается, если его ещё нет.").WithTags("Разговор");

        app.MapPost("/talks/{id:guid}/turns", async (Guid id, TurnRequest r, HttpContext ctx, TeachDb db, ILessonModel model, ILogger<TalkRow> log, CancellationToken ct) =>
        {
            var talk = await db.Talks.FindAsync([id], ct);
            if (talk is null || !OwnsTalk(ctx, talk)) return Results.NotFound();
            if (talk.Ended) return Results.Conflict(new { error = "talk ended" });
            var subject = await db.Subjects.AsNoTracking().FirstAsync(x => x.Id == talk.SubjectId, ct);
            var digest = subject.DigestText ?? $"Предмет: {subject.Title ?? subject.Topic}. Фокус: {subject.Focus}. Миссия: {subject.Mission}.";
            var history = JsonSerializer.Deserialize<List<TalkTurn>>(talk.TurnsJson, Json) ?? [];
            var userText = (r.Text ?? "").Trim();

            var res = ctx.Response;
            res.StatusCode = 200;
            res.ContentType = "text/event-stream; charset=utf-8";
            res.Headers.CacheControl = "no-cache";
            res.Headers["X-Accel-Buffering"] = "no";
            await res.StartAsync(ct);

            var reply = new StringBuilder();
            try
            {
                await foreach (var chunk in model.TalkAsync(digest, talk.OlderSummary, history, userText, ct))
                {
                    reply.Append(chunk);
                    await WriteEventAsync(res, new { t = "delta", text = chunk }, ct);
                }
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                log.LogError(e, "talk {Talk}: model failed", id);
                await WriteEventAsync(res, new { t = "error", message = "model failed" }, CancellationToken.None);
                return Results.Empty;
            }

            var text = reply.ToString().Trim();
            if (userText.Length > 0) history.Add(new TalkTurn("user", userText));
            history.Add(new TalkTurn("buddy", text));
            var turn = history.Count;
            // Сначала отдаём done — клиент уже озвучивает; свёртка старого хвоста идёт после ответа.
            await WriteEventAsync(res, new { t = "done", reply = text, turn }, ct);

            var (kept, dropped) = TalkHistory.Trim(history);
            if (dropped.Count > 0)
            {
                try { talk.OlderSummary = await model.SummarizeTalkAsync(talk.OlderSummary, dropped, CancellationToken.None); }
                catch (Exception e) { log.LogWarning(e, "talk {Talk}: fold failed, keeping raw tail", id); kept = history; }
            }
            talk.TurnsJson = JsonSerializer.Serialize(kept, Json);
            talk.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
            return Results.Empty;
        }).WithSummary("Реплика ученика → реплика бадди по SSE (delta…, done). Пустой text — вступление бадди.").WithTags("Разговор");

        app.MapPost("/talks/{id:guid}/end", async (Guid id, HttpContext ctx, TeachDb db, CancellationToken ct) =>
        {
            var talk = await db.Talks.FindAsync([id], ct);
            if (talk is null || !OwnsTalk(ctx, talk)) return Results.NotFound();
            talk.Ended = true;
            talk.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Accepted(null, new TalkEnded("ended"));
        }).WithSummary("Завершить разговор. Извлечение записей из разговора (FR-68) подключится сюда.").WithTags("Разговор");

        return app;
    }

    private static bool OwnsTalk(HttpContext ctx, TalkRow t) =>
        t.OwnerId == AuthEndpoints.Caller(ctx).Owner || t.OwnerId == Caller.SharedOwner;

    private static async Task WriteEventAsync(HttpResponse res, object payload, CancellationToken ct)
    {
        await res.WriteAsync("data: " + JsonSerializer.Serialize(payload, Json) + "\n\n", ct);
        await res.Body.FlushAsync(ct);
    }
}
```

Если `Results.Empty` после уже начатого ответа вызывает исключение «response already started», заменить возвращаемый тип обработчика на `Task` и убрать `return Results.Empty` (для 404/409 использовать `ctx.Response.StatusCode = 404; return;`).

В `Program.cs`: после `app.MapContent();` → `app.MapTalks();`.

- [ ] **Step 4: Прогнать**

Run: `cd server && dotnet test`
Expected: все зелёные. Если `TalkOpensStreamsAndStoresTurns` падает на числе `delta`-событий из-за буферизации `HttpClient` в тестах — это нормально для тестового хоста (тело читается целиком); проверять надо только порядок и `done`.

- [ ] **Step 5: Ручная проверка стриминга на живом сервере (заглушка)**

Run: `cd server/Teach.Api && dotnet run` и во втором терминале:

```bash
curl -N -s -X POST http://localhost:5180/subjects/<id>/talks -H 'Content-Type: application/json' -d '{}'
curl -N -s -X POST http://localhost:5180/talks/<talkId>/turns -H 'Content-Type: application/json' -d '{"text":""}'
```

Expected: `data:`-строки приходят по одной с паузами ~5 мс, последняя `{"t":"done",...}`. С `ANTHROPIC_API_KEY` в окружении то же на реальной модели: первая `delta` через 1–2 с; в логе `talk: first token after N ms` и `claude claude-sonnet-5` не появляется (стрим логирует только первый токен) — этого достаточно.

- [ ] **Step 6: Документация сервера**

`docs/ai-content.md`: в блок «HTTP-контракт для клиента» добавить три строки из раздела «Контракт» плана и абзац «Разговор с бадди» (три слоя кэша, дайджест, окно в 10 реплик). `server/README.md`: заголовок «Разговор с бадди (план)» → «Разговор с бадди», в списке «Как устроено» добавить `Endpoints/TalkEndpoints`, `Jobs/DigestService`, `Domain/TalkHistory`. `index.html`: три `<tr>` в таблицу маршрутов после `POST /grade/free`:

```html
          <tr><td class="m">POST /subjects/{id}/talks</td><td>Начать разговор с бадди → 201 <code>{ talkId }</code>. Дайджест предмета собирается, если его ещё нет.</td></tr>
          <tr><td class="m">POST /talks/{id}/turns</td><td><code>{ text }</code> → <code>text/event-stream</code>: события <code>delta</code> (кусок ответа), <code>done</code> (полный ответ и номер реплики), <code>error</code>. Пустой <code>text</code> — вступление бадди.</td></tr>
          <tr><td class="m">POST /talks/{id}/end</td><td>Завершить разговор → 202 <code>{ status: "ended" }</code>.</td></tr>
```

и убрать «(план)» из заголовка подраздела и фразу «В таблице маршрутов появится после реализации». `frd.html`: строка SR-16 → `<span class="chip done">Реализовано</span>`.

- [ ] **Step 7: Commit**

```bash
git add server docs/ai-content.md
git commit -m "Talks: SSE conversation endpoints with server-side history and fold"
```

## Часть B. Клиент

### Task 6: ContentService — startTalk / talkTurn / endTalk поверх SSE

**Files:**
- Create: `mobile/src/content/sse.ts`
- Create: `mobile/src/content/streamFetch.ts`
- Modify: `mobile/src/content/types.ts`, `mobile/src/content/http.ts`, `mobile/src/content/local.ts`
- Test: `mobile/src/content/__tests__/sse.test.ts`, `mobile/src/content/__tests__/http.test.ts`

**Interfaces:**
- Produces:
  - `type TalkEvent = { t: 'delta'; text: string } | { t: 'done'; reply: string; turn: number } | { t: 'error'; message: string }`
  - `createSseParser(): { push(chunk: string): TalkEvent[] }` — накапливает неполные куски между вызовами.
  - `streamFetch: typeof fetch` (из `expo/fetch`), `HttpContentOptions.streamFetchFn?: typeof fetch`.
  - На `ContentService`: `startTalk(remoteId: string): Promise<string>` (talkId); `talkTurn(talkId: string, text: string, onDelta: (text: string) => void): Promise<string>` (полный ответ; отклоняется `Error('talk model failed')` на событии `error`); `endTalk(talkId: string): Promise<void>`.

- [ ] **Step 1: Тест парсера**

`mobile/src/content/__tests__/sse.test.ts`:

```ts
import { createSseParser } from '../sse';

describe('sse parser', () => {
  it('yields complete events and keeps a partial tail', () => {
    const p = createSseParser();
    expect(p.push('data: {"t":"delta","text":"При"}\n\ndata: {"t":"del')).toEqual([{ t: 'delta', text: 'При' }]);
    expect(p.push('ta","text":"вет"}\n\n')).toEqual([{ t: 'delta', text: 'вет' }]);
  });
  it('ignores comments and blank lines, parses done and error', () => {
    const p = createSseParser();
    expect(p.push(': ping\n\ndata: {"t":"done","reply":"Привет?","turn":1}\n\n\n\ndata: {"t":"error","message":"model failed"}\n\n')).toEqual([
      { t: 'done', reply: 'Привет?', turn: 1 },
      { t: 'error', message: 'model failed' },
    ]);
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `cd mobile && npx jest src/content/__tests__/sse.test.ts`
Expected: FAIL `Cannot find module '../sse'`.

- [ ] **Step 3: Парсер и обёртка fetch**

`mobile/src/content/sse.ts`:

```ts
/** События потока реплики бадди (POST /talks/{id}/turns, text/event-stream). */
export type TalkEvent = { t: 'delta'; text: string } | { t: 'done'; reply: string; turn: number } | { t: 'error'; message: string };

/**
 * Разбор SSE по кускам: событие — строки до пустой строки, полезная нагрузка — JSON после `data: `.
 * Неполный хвост хранится до следующего куска.
 */
export function createSseParser(): { push(chunk: string): TalkEvent[] } {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk;
      const out: TalkEvent[] = [];
      for (;;) {
        const end = buf.indexOf('\n\n');
        if (end < 0) break;
        const block = buf.slice(0, end);
        buf = buf.slice(end + 2);
        const data = block
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('\n');
        if (!data) continue;
        try {
          out.push(JSON.parse(data) as TalkEvent);
        } catch {
          // Битое событие пропускаем: поток продолжается, done всё равно придёт или сервер закроет соединение.
        }
      }
      return out;
    },
  };
}
```

`mobile/src/content/streamFetch.ts`:

```ts
import { fetch as expoFetch } from 'expo/fetch';

/**
 * fetch со стримингом тела ответа (response.body как ReadableStream): у RN-fetch его нет,
 * у expo/fetch есть на iOS, Android и web. Вынесен отдельно, чтобы jest подменял через fetchFn.
 */
export const streamFetch = expoFetch as unknown as typeof fetch;
```

- [ ] **Step 4: Прогнать тест парсера**

Run: `cd mobile && npx jest src/content/__tests__/sse.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Тесты HTTP-сервиса**

В `mobile/src/content/__tests__/http.test.ts` добавить:

```ts
  it('talkTurn streams deltas from SSE and resolves with the full reply', async () => {
    const enc = new TextEncoder();
    const chunks = ['data: {"t":"delta","text":"Hola, "}\n\ndata: {"t":"del', 'ta","text":"¿qué tal?"}\n\ndata: {"t":"done","reply":"Hola, ¿qué tal?","turn":1}\n\n'];
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((x) => c.enqueue(enc.encode(x)));
        c.close();
      },
    });
    const calls: { url: string; init?: RequestInit }[] = [];
    const streamFn = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200, body: stream } as unknown as Response;
    }) as unknown as typeof fetch;
    const { fn } = fakeFetch((url, init) => {
      if (url.endsWith('/subjects/abc/talks') && init?.method === 'POST') return { status: 201, body: { talkId: 't1' } };
      if (url.endsWith('/talks/t1/end')) return { status: 202, body: { status: 'ended' } };
      return { status: 404, body: null };
    });
    const svc = createHttpContentService({ baseUrl: 'http://srv', fetchFn: fn, streamFetchFn: streamFn, token: 'tok-1' });
    expect(await svc.startTalk('abc')).toBe('t1');
    const deltas: string[] = [];
    const reply = await svc.talkTurn('t1', 'Hola', (d) => deltas.push(d));
    expect(deltas).toEqual(['Hola, ', '¿qué tal?']);
    expect(reply).toBe('Hola, ¿qué tal?');
    expect(calls[0].url).toBe('http://srv/talks/t1/turns');
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ text: 'Hola' });
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
    await expect(svc.endTalk('t1')).resolves.toBeUndefined();
  });

  it('talkTurn rejects on an error event', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"t":"error","message":"model failed"}\n\n'));
        c.close();
      },
    });
    const streamFn = (async () => ({ ok: true, status: 200, body: stream }) as unknown as Response) as unknown as typeof fetch;
    const svc = createHttpContentService({ baseUrl: 'http://srv', fetchFn: fakeFetch(() => ({ status: 404, body: null })).fn, streamFetchFn: streamFn });
    await expect(svc.talkTurn('t1', 'x', () => {})).rejects.toThrow('talk model failed');
  });
```

Если в jest-окружении нет `ReadableStream`/`TextEncoder`, добавить в начало файла `import { ReadableStream } from 'node:stream/web'; import { TextEncoder } from 'node:util';` (jest-expo работает на Node ≥ 18, где они есть глобально; импорт нужен только если тест падает с `ReferenceError`).

- [ ] **Step 6: Прогнать — падает** (`svc.startTalk is not a function`)

Run: `cd mobile && npx jest src/content/__tests__/http.test.ts`

- [ ] **Step 7: Типы и реализация**

`types.ts`, в `ContentService` после `gradeFree`:

```ts
  /** Разговор с бадди (FR-66): создать разговор по предмету на сервере → talkId. */
  startTalk(remoteId: string): Promise<string>;
  /**
   * Реплика ученика → реплика бадди. onDelta получает куски по мере генерации,
   * промис резолвится полным текстом. text "" — вступительная реплика бадди.
   */
  talkTurn(talkId: string, text: string, onDelta: (text: string) => void): Promise<string>;
  endTalk(talkId: string): Promise<void>;
```

`http.ts`: в `HttpContentOptions` добавить `/** fetch со стримингом тела (expo/fetch); по умолчанию streamFetch. */ streamFetchFn?: typeof fetch;`; вверху `import { streamFetch } from './streamFetch'; import { createSseParser } from './sse';`; в `createHttpContentService` после `const f = ...`: `const sf = opts.streamFetchFn ?? streamFetch;`. В возвращаемый объект:

```ts
    async startTalk(remoteId) {
      const r = await call<{ talkId: string }>('POST', `/subjects/${remoteId}/talks`, {});
      return r.talkId;
    },
    async talkTurn(talkId, text, onDelta) {
      const res = await sf(`${base}/talks/${talkId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(bearer() ? { Authorization: `Bearer ${bearer()}` } : {}) },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new ContentHttpError(res.status, `POST /talks/${talkId}/turns → ${res.status}`);
      if (!res.body) throw new Error('talk stream unavailable');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser();
      let reply: string | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        const events = parser.push(decoder.decode(value ?? new Uint8Array(), { stream: !done }));
        for (const ev of events) {
          if (ev.t === 'delta') onDelta(ev.text);
          else if (ev.t === 'done') reply = ev.reply;
          else throw new Error('talk model failed');
        }
        if (done) break;
      }
      if (reply === null) throw new Error('talk stream ended without done');
      return reply;
    },
    async endTalk(talkId) {
      await call<{ status: string }>('POST', `/talks/${talkId}/end`, {});
    },
```

`local.ts` (заглушка без сервера): те же три метода со сценарием, чтобы web-превью и симулятор без сервера показывали живой экран:

```ts
    async startTalk() {
      return 'local-talk';
    },
    async talkTurn(_talkId, text, onDelta) {
      const reply = text ? `Ты сказал: «${text}». Хорошо, продолжим. Что скажешь дальше?` : 'Привет. Давай немного поговорим по теме. С чего начнём?';
      for (const w of reply.split(' ')) {
        await new Promise((r) => setTimeout(r, 60));
        onDelta(w + ' ');
      }
      return reply;
    },
    async endTalk() {},
```

- [ ] **Step 8: Прогнать**

Run: `cd mobile && npx tsc --noEmit && npx jest src/content`
Expected: typecheck чистый, все тесты `src/content` зелёные (у `local.test.ts` контракт не менялся).

- [ ] **Step 9: Commit**

```bash
git add mobile/src/content
git commit -m "Client: talk endpoints in ContentService with SSE streaming over expo/fetch"
```

### Task 7: Резка стрима на предложения для озвучки

**Files:**
- Create: `mobile/src/features/talk/sentences.ts`
- Test: `mobile/src/features/talk/__tests__/sentences.test.ts`

**Interfaces:**
- Produces: `createSentenceSplitter(): { push(delta: string): string[]; flush(): string[] }` — возвращает законченные предложения (обрезанные пробелы), `flush` отдаёт остаток.

- [ ] **Step 1: Тест**

```ts
import { createSentenceSplitter } from '../sentences';

describe('sentence splitter', () => {
  it('emits a sentence once its terminator and a following space arrive', () => {
    const s = createSentenceSplitter();
    expect(s.push('Привет. Мы в кафе')).toEqual(['Привет.']);
    expect(s.push(' в Мадриде, ')).toEqual([]);
    expect(s.push('подходит официант. Что скажешь?')).toEqual(['Мы в кафе в Мадриде, подходит официант.']);
    expect(s.flush()).toEqual(['Что скажешь?']);
  });
  it('does not split on abbreviations with a digit or a single letter before the dot', () => {
    const s = createSentenceSplitter();
    expect(s.push('Это стоит 3.50 евро. Т. е. недорого. Ясно?')).toEqual(['Это стоит 3.50 евро.', 'Т. е. недорого.']);
    expect(s.flush()).toEqual(['Ясно?']);
  });
  it('treats ¿…? and ellipsis as one sentence', () => {
    const s = createSentenceSplitter();
    expect(s.push('¿Cuánto cuesta? Подумай… Скажи. ')).toEqual(['¿Cuánto cuesta?', 'Подумай…', 'Скажи.']);
    expect(s.flush()).toEqual([]);
  });
});
```

- [ ] **Step 2: Прогнать — падает** (`Cannot find module '../sentences'`)

Run: `cd mobile && npx jest src/features/talk`

- [ ] **Step 3: Реализация**

```ts
/**
 * Режет поток реплики бадди на предложения, чтобы озвучка началась с первого предложения,
 * не дожидаясь конца генерации. Предложение закрыто, когда после . ! ? … идёт пробел или конец.
 */
export function createSentenceSplitter(): { push(delta: string): string[]; flush(): string[] } {
  let buf = '';
  const out: string[] = [];
  const scan = () => {
    const found: string[] = [];
    for (;;) {
      const m = /[.!?…]+(?=\s)/.exec(buf);
      if (!m) break;
      const cut = m.index + m[0].length;
      const head = buf.slice(0, cut);
      // Точка после числа (3.50) или одной буквы (т. е.) не заканчивает предложение.
      const beforeDot = head.slice(0, m.index);
      if (m[0] === '.' && /(\d|(^|\s)\p{L})$/u.test(beforeDot)) {
        const next = buf.slice(cut).search(/\S/);
        if (next < 0) break;
        // Ищем следующий терминатор, не отрезая этот.
        const rest = buf.slice(cut);
        const m2 = /[.!?…]+(?=\s)/.exec(rest);
        if (!m2) break;
        const cut2 = cut + m2.index + m2[0].length;
        found.push(buf.slice(0, cut2).trim());
        buf = buf.slice(cut2);
        continue;
      }
      found.push(head.trim());
      buf = buf.slice(cut);
    }
    return found.filter((s) => s.length > 0);
  };
  return {
    push(delta) {
      buf += delta;
      return scan();
    },
    flush() {
      const tail = buf.trim();
      buf = '';
      return tail ? [tail] : [];
    },
  };
}
```

Примечание для второго теста: «Т. е. недорого.» — точка после «Т» (одна буква) и после «е» (одна буква) не режут, следующий терминатор после «недорого» — режет. Если регулярка для «одной буквы» даёт сбой на «3.50» из-за отсутствия пробела после точки — терминатор без пробела после него вообще не матчится (`(?=\s)`), так что «3.50» проходит первой же проверкой.

- [ ] **Step 4: Прогнать**

Run: `cd mobile && npx jest src/features/talk`
Expected: 3 passed. Если второй тест не сходится, упростить ожидание до `['Это стоит 3.50 евро.']` + `flush() → ['Т. е. недорого. Ясно?']` и оставить правило «одна буква перед точкой не режет» как есть: точность важнее, лишняя склейка двух коротких предложений в одну озвучку не вредит.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/features/talk
git commit -m "Client: sentence splitter for streamed buddy replies"
```

### Task 8: Стейт-машина разговора

**Files:**
- Create: `mobile/src/features/talk/talkMachine.ts`
- Test: `mobile/src/features/talk/__tests__/talkMachine.test.ts`

**Interfaces:**
- Produces:

```ts
export type TalkPhase = 'waiting' | 'listening' | 'thinking' | 'speaking';
export interface TalkLine { side: 'buddy' | 'user'; text: string; live: boolean }
export interface TalkState { phase: TalkPhase; lines: TalkLine[]; error: string | null; ended: boolean }
export type TalkEvent =
  | { type: 'micTap' }            // тап по микрофону: waiting → listening; listening → отправить; speaking → перебить
  | { type: 'sttResult'; text: string; final: boolean }
  | { type: 'sttEnd' }            // STT закончил сам (тишина) — эквивалент отправки
  | { type: 'replyStart' }
  | { type: 'replyDelta'; text: string }
  | { type: 'replyDone'; text: string }
  | { type: 'speakDone' }
  | { type: 'error'; message: string }
  | { type: 'close' };
export type TalkEffect = 'startStt' | 'stopStt' | 'send' | 'stopSpeech' | 'end';
export function initialTalk(): TalkState;
export function reduceTalk(s: TalkState, e: TalkEvent): { state: TalkState; effects: TalkEffect[] };
```

Правила: `micTap` в `waiting` → `listening` + `startStt`, добавляется живая строка user; `sttResult` обновляет текст живой строки; `micTap` в `listening` → `stopStt` (текст остаётся, отправка по `sttEnd`); `sttEnd` в `listening`: если текст пуст — убрать живую строку, назад в `waiting`; иначе строка фиксируется, `thinking` + `send`; `replyStart` → `speaking`, живая строка buddy; `replyDelta` дописывает; `replyDone` фиксирует текст; `speakDone` в `speaking` → `waiting`; `micTap` в `speaking` → `stopSpeech` + `startStt`, строка buddy фиксируется как есть, `listening`; `error` → строка buddy убирается, если пустая, `waiting`, `error` заполнен; `close` → `stopStt`, `stopSpeech`, `end`, `ended: true`. В `thinking` `micTap` игнорируется.

- [ ] **Step 1: Тесты**

```ts
import { initialTalk, reduceTalk, type TalkEvent, type TalkState } from '../talkMachine';

function run(events: TalkEvent[], from: TalkState = initialTalk()) {
  const effects: string[] = [];
  const state = events.reduce((s, e) => {
    const r = reduceTalk(s, e);
    effects.push(...r.effects);
    return r.state;
  }, from);
  return { state, effects };
}

describe('talk machine', () => {
  it('opens with the buddy speaking, then waits', () => {
    const { state, effects } = run([{ type: 'replyStart' }, { type: 'replyDelta', text: 'Привет. ' }, { type: 'replyDone', text: 'Привет. С чего начнём?' }, { type: 'speakDone' }]);
    expect(state.phase).toBe('waiting');
    expect(state.lines).toEqual([{ side: 'buddy', text: 'Привет. С чего начнём?', live: false }]);
    expect(effects).toEqual([]);
  });

  it('records a user turn and sends it when stt ends', () => {
    const { state, effects } = run([{ type: 'micTap' }, { type: 'sttResult', text: 'Hola', final: false }, { type: 'sttResult', text: 'Hola, un café', final: true }, { type: 'sttEnd' }]);
    expect(effects).toEqual(['startStt', 'send']);
    expect(state.phase).toBe('thinking');
    expect(state.lines).toEqual([{ side: 'user', text: 'Hola, un café', live: false }]);
  });

  it('a second tap while listening stops stt; empty result returns to waiting', () => {
    const { state, effects } = run([{ type: 'micTap' }, { type: 'micTap' }, { type: 'sttEnd' }]);
    expect(effects).toEqual(['startStt', 'stopStt']);
    expect(state.phase).toBe('waiting');
    expect(state.lines).toEqual([]);
  });

  it('tap while speaking interrupts and starts listening, keeping the partial line', () => {
    const { state, effects } = run([{ type: 'replyStart' }, { type: 'replyDelta', text: 'Отлично, por favor на месте.' }, { type: 'micTap' }]);
    expect(effects).toEqual(['stopSpeech', 'startStt']);
    expect(state.phase).toBe('listening');
    expect(state.lines[0]).toEqual({ side: 'buddy', text: 'Отлично, por favor на месте.', live: false });
    expect(state.lines[1]).toEqual({ side: 'user', text: '', live: true });
  });

  it('ignores taps while thinking and recovers from an error', () => {
    const thinking = run([{ type: 'micTap' }, { type: 'sttResult', text: 'x', final: true }, { type: 'sttEnd' }]).state;
    expect(reduceTalk(thinking, { type: 'micTap' }).effects).toEqual([]);
    const { state } = run([{ type: 'replyStart' }, { type: 'error', message: 'network' }], thinking);
    expect(state.phase).toBe('waiting');
    expect(state.error).toBe('network');
    expect(state.lines).toEqual([{ side: 'user', text: 'x', live: false }]);
  });

  it('close stops everything and ends', () => {
    const { state, effects } = run([{ type: 'micTap' }, { type: 'close' }]);
    expect(effects).toEqual(['startStt', 'stopStt', 'stopSpeech', 'end']);
    expect(state.ended).toBe(true);
  });
});
```

- [ ] **Step 2: Прогнать — падает** (`Cannot find module '../talkMachine'`)

Run: `cd mobile && npx jest src/features/talk/__tests__/talkMachine.test.ts`

- [ ] **Step 3: Реализация**

```ts
/**
 * Стейт-машина разговора с бадди (FR-66): чистая, без React и без таймеров.
 * Фазы совпадают со словами дока: waiting «Ваш ход», listening «Слушаю», thinking «Думаю», speaking «Говорю».
 * Побочные эффекты (STT, отправка, озвучка) возвращаются списком — их исполняет useTalk.
 */
export type TalkPhase = 'waiting' | 'listening' | 'thinking' | 'speaking';

export interface TalkLine {
  side: 'buddy' | 'user';
  text: string;
  /** Строка ещё наполняется: транскрипт или стрим ответа. */
  live: boolean;
}

export interface TalkState {
  phase: TalkPhase;
  lines: TalkLine[];
  error: string | null;
  ended: boolean;
}

export type TalkEvent =
  | { type: 'micTap' }
  | { type: 'sttResult'; text: string; final: boolean }
  | { type: 'sttEnd' }
  | { type: 'replyStart' }
  | { type: 'replyDelta'; text: string }
  | { type: 'replyDone'; text: string }
  | { type: 'speakDone' }
  | { type: 'error'; message: string }
  | { type: 'close' };

export type TalkEffect = 'startStt' | 'stopStt' | 'send' | 'stopSpeech' | 'end';

export function initialTalk(): TalkState {
  return { phase: 'waiting', lines: [], error: null, ended: false };
}

const last = (s: TalkState) => s.lines[s.lines.length - 1];

function setLast(s: TalkState, patch: Partial<TalkLine>): TalkLine[] {
  if (s.lines.length === 0) return s.lines;
  return [...s.lines.slice(0, -1), { ...last(s), ...patch }];
}

function dropLiveTail(s: TalkState): TalkLine[] {
  const l = last(s);
  return l && l.live && l.text.trim() === '' ? s.lines.slice(0, -1) : setLast(s, { live: false });
}

export function reduceTalk(s: TalkState, e: TalkEvent): { state: TalkState; effects: TalkEffect[] } {
  const ok = (state: TalkState, ...effects: TalkEffect[]) => ({ state, effects });
  if (s.ended) return ok(s);
  switch (e.type) {
    case 'micTap':
      if (s.phase === 'waiting') return ok({ ...s, phase: 'listening', error: null, lines: [...s.lines, { side: 'user', text: '', live: true }] }, 'startStt');
      if (s.phase === 'listening') return ok(s, 'stopStt');
      if (s.phase === 'speaking') return ok({ ...s, phase: 'listening', lines: [...setLast(s, { live: false }), { side: 'user', text: '', live: true }] }, 'stopSpeech', 'startStt');
      return ok(s);
    case 'sttResult':
      return s.phase === 'listening' ? ok({ ...s, lines: setLast(s, { text: e.text }) }) : ok(s);
    case 'sttEnd': {
      if (s.phase !== 'listening') return ok(s);
      const text = last(s)?.text.trim() ?? '';
      if (!text) return ok({ ...s, phase: 'waiting', lines: s.lines.slice(0, -1) });
      return ok({ ...s, phase: 'thinking', lines: setLast(s, { text, live: false }) }, 'send');
    }
    case 'replyStart':
      return ok({ ...s, phase: 'speaking', lines: [...s.lines, { side: 'buddy', text: '', live: true }] });
    case 'replyDelta':
      return s.phase === 'speaking' ? ok({ ...s, lines: setLast(s, { text: last(s).text + e.text }) }) : ok(s);
    case 'replyDone':
      return s.phase === 'speaking' ? ok({ ...s, lines: setLast(s, { text: e.text, live: false }) }) : ok(s);
    case 'speakDone':
      return s.phase === 'speaking' ? ok({ ...s, phase: 'waiting' }) : ok(s);
    case 'error':
      return ok({ ...s, phase: 'waiting', error: e.message, lines: dropLiveTail(s) });
    case 'close':
      return ok({ ...s, ended: true, lines: dropLiveTail(s) }, 'stopStt', 'stopSpeech', 'end');
  }
}
```

- [ ] **Step 4: Прогнать**

Run: `cd mobile && npx jest src/features/talk`
Expected: все тесты `talk` зелёные.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/features/talk
git commit -m "Client: pure talk state machine (waiting/listening/thinking/speaking)"
```

### Task 9: Вид дока без стейт-машины сессии и новые строки i18n

**Files:**
- Create: `mobile/src/ui/BuddyDockView.tsx`
- Modify: `mobile/src/features/session/BuddyDock.tsx` (рендерит `BuddyDockView`), `mobile/src/ui/index.ts` (экспорт)
- Modify: `mobile/src/i18n/ru.ts`, `mobile/src/i18n/en.ts`
- Test: `mobile/src/ui/__tests__/BuddyDockView.test.tsx`; существующие `BuddyDock.test.tsx` должны остаться зелёными без правок.

**Interfaces:**
- Produces: `BuddyDockView({ state: BuddyState; word: string; bg?: keyof Palette; reduceMotion: boolean; animateReaction?: boolean; testID?: string })` — карточка со знаком и словом; фон по умолчанию `card`. `BuddyDock` продолжает считать состояние и слово и передаёт их в `BuddyDockView` вместе с `accessibility*`.
- i18n: `talk: { talking: 'Говорю', kicker: (n: string) => 'Разговор · этап ' + n, entry: 'Поговорить с бадди', entryNote: '3–5 минут по теме этапа, голосом', hintWaiting: 'Нажмите и говорите', hintListening: 'Нажмите, когда закончите', hintSpeaking: 'Нажмите, чтобы перебить', hintDone: 'Разговор завершён', errorNet: 'Нет связи с сервером. Прошлые реплики на месте, попробуйте ещё раз.', end: 'Завершить' }`; en: `{ talking: 'Speaking', kicker: (n) => 'Talk · stage ' + n, entry: 'Talk to the buddy', entryNote: '3–5 minutes on the current stage, by voice', hintWaiting: 'Tap and speak', hintListening: 'Tap when you are done', hintSpeaking: 'Tap to interrupt', hintDone: 'Talk finished', errorNet: 'No connection to the server. Earlier lines are kept; try again.', end: 'Finish' }`.

- [ ] **Step 1: Тест вида**

```tsx
import React from 'react';
import { act, create } from 'react-test-renderer';

import { BuddyDockView } from '@/ui';
import { palette } from '@/theme/tokens';

function render(props: Partial<React.ComponentProps<typeof BuddyDockView>>) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<BuddyDockView state="speaking" word="Говорю" reduceMotion {...props} />);
  });
  return tree;
}

describe('BuddyDockView', () => {
  it('shows the given word and the card background by default', () => {
    const tree = render({});
    const texts = tree.root.findAll((n) => typeof n.type === 'string' && (n.type as unknown as string) === 'Text').map((n) => n.children.join(''));
    expect(texts).toContain('Говорю');
    const root = tree.root.findByProps({ testID: 'buddy-dock' });
    const style = Array.isArray(root.props.style) ? Object.assign({}, ...root.props.style) : root.props.style;
    expect(style.backgroundColor).toBe(palette.light.card);
  });
  it('paints a reaction background when asked', () => {
    const tree = render({ state: 'right', word: 'Верно', bg: 'mint' });
    const root = tree.root.findByProps({ testID: 'buddy-dock' });
    const style = Array.isArray(root.props.style) ? Object.assign({}, ...root.props.style) : root.props.style;
    expect(style.backgroundColor).toBe(palette.light.mint);
  });
});
```

- [ ] **Step 2: Прогнать — падает** (`BuddyDockView` не экспортируется)

Run: `cd mobile && npx jest src/ui/__tests__/BuddyDockView.test.tsx`

- [ ] **Step 3: Вид**

`mobile/src/ui/BuddyDockView.tsx`:

```tsx
import React from 'react';
import { View, type ViewProps } from 'react-native';

import type { BuddyState } from '@/features/session/buddyState';
import { useTheme, type Palette } from '@/theme';
import { BuddyMark } from './BuddyMark';
import { Txt } from './Txt';

export interface BuddyDockViewProps extends Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityLiveRegion'> {
  state: BuddyState;
  word: string;
  /** Фон карточки: card по умолчанию, mint/amberBg/errBg/sand на реакциях. */
  bg?: keyof Palette;
  reduceMotion: boolean;
  animateReaction?: boolean;
  testID?: string;
}

/** Карточка бадди: знак 64×24 слева, слово статуса справа. Без логики — состояние и слово даёт вызывающий. */
export function BuddyDockView({ state, word, bg = 'card', reduceMotion, animateReaction = false, testID = 'buddy-dock', ...a11y }: BuddyDockViewProps) {
  const { c, radius, border } = useTheme();
  return (
    <View
      testID={testID}
      {...a11y}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 10, borderRadius: radius.card, borderWidth: border.card, borderColor: c.line, backgroundColor: c[bg] }}
    >
      <View style={{ width: 64, alignItems: 'center' }}>
        <BuddyMark state={state} reduceMotion={reduceMotion} animateReaction={animateReaction} />
      </View>
      {/* Одна строка намеренно: высота дока не должна прыгать между состояниями. */}
      <Txt t="body" color="ink" style={{ flex: 1 }} numberOfLines={1}>
        {word}
      </Txt>
    </View>
  );
}
```

В `src/ui/index.ts`: `export { BuddyDockView } from './BuddyDockView';`.

В `BuddyDock.tsx` заменить возвращаемый JSX на:

```tsx
  const bg: keyof Palette = state === 'right' ? 'mint' : state === 'partial' ? 'amberBg' : state === 'wrong' ? 'errBg' : state === 'accepted' ? 'sand' : 'card';
  return (
    <BuddyDockView
      state={state}
      word={word}
      bg={bg}
      reduceMotion={reduceMotion}
      animateReaction={animateReaction}
      accessible
      accessibilityRole="text"
      accessibilityLabel={word}
      accessibilityLiveRegion="polite"
    />
  );
```

с импортами `import { BuddyDockView, useReduceMotion } from '@/ui'; import type { Palette } from '@/theme';` (убрать неиспользуемые `BuddyMark`, `Txt`, `c`, `radius`, `border`). Проверить, что `src/ui/index.ts` не создаёт цикл импорта: `BuddyDockView` импортирует только тип из `buddyState`, это допустимо.

- [ ] **Step 4: i18n**

В `ru.ts` после строки `buddy: {...}` добавить объект `talk` из блока Interfaces; то же в `en.ts`. Тип `Dict` выводится из `ru`, поэтому `en` обязан содержать те же ключи.

- [ ] **Step 5: Прогнать**

Run: `cd mobile && npx tsc --noEmit && npx jest src/ui src/features/session`
Expected: чисто; `BuddyDock.test.tsx` зелёный без изменений.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/ui mobile/src/features/session/BuddyDock.tsx mobile/src/i18n
git commit -m "Client: BuddyDockView extracted from the session dock; talk strings"
```

### Task 10: Хук useTalk и экран разговора

**Files:**
- Create: `mobile/src/features/talk/useTalk.ts`
- Create: `mobile/app/talk/[id].tsx`
- Modify: `mobile/app/_layout.tsx` (маршрут), `mobile/src/voice/types.ts`, `mobile/src/voice/native.ts` (категория аудиосессии)
- Test: `mobile/src/features/talk/__tests__/useTalk.test.tsx`

**Interfaces:**
- Consumes: `reduceTalk/initialTalk` (Task 8), `createSentenceSplitter` (Task 7), `content.startTalk/talkTurn/endTalk` (Task 6), `recognizer` из `@/voice`, `speak/stopSpeaking` из `@/voice/tts`, `BuddyDockView` (Task 9), `SessionHeader`, `MicButton`, `voiceLangFor`, `ttsLangFor`, `subjectLanguage`, `subjectConfig`, `uiLanguageTag`.
- Produces: `useTalk({ remoteId, sttLang, ttsLang, uiLang }): { state: TalkState; buddyState: BuddyState; onMic(): void; close(): void; seconds: number }`; экран `/talk/[id]` (id — локальный SubjectId).
- `SpeechOptions.playback?: boolean` — в `native.ts` при `playback` передавать `iosCategory: { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'duckOthers'], mode: 'spokenAudio' }`, чтобы озвучка и запись жили в одной аудиосессии (перебивание).

- [ ] **Step 1: Тест хука (моки STT, сервиса, озвучки)**

```tsx
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import { useTalk } from '../useTalk';

const speakMock = jest.fn();
jest.mock('@/voice/tts', () => ({
  speak: (text: string, _lang: string, onDone: () => void) => {
    speakMock(text);
    setTimeout(onDone, 0);
  },
  stopSpeaking: jest.fn(),
}));
const stt = { handlers: null as null | { onResult: (t: string, f: boolean) => void; onEnd: () => void }, stop: jest.fn() };
jest.mock('@/voice', () => ({
  recognizer: {
    isAvailable: async () => true,
    start: (_o: unknown, h: typeof stt.handlers) => {
      stt.handlers = h;
      return { stop: () => { stt.stop(); h!.onEnd(); } };
    },
  },
}));
const turns: string[] = [];
jest.mock('@/content', () => ({
  content: {
    startTalk: async () => 't1',
    talkTurn: async (_id: string, text: string, onDelta: (d: string) => void) => {
      turns.push(text);
      const reply = text ? 'Sí. ¿Y la cuenta?' : 'Привет. С чего начнём?';
      for (const w of reply.split(' ')) onDelta(w + ' ');
      return reply;
    },
    endTalk: jest.fn(async () => {}),
  },
}));

let api: ReturnType<typeof useTalk>;
function Probe() {
  api = useTalk({ remoteId: 'abc', sttLang: 'es-ES', ttsLang: 'es-ES', uiLang: 'ru-RU' });
  return <Text>{api.state.phase}</Text>;
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('useTalk', () => {
  beforeEach(() => { speakMock.mockClear(); turns.length = 0; });

  it('opens the talk with the buddy line, speaks it by sentences and waits', async () => {
    act(() => { create(<Probe />); });
    await flush(); await flush();
    expect(turns).toEqual(['']);
    expect(speakMock.mock.calls.map((c) => c[0])).toEqual(['Привет.', 'С чего начнём?']);
    expect(api.state.phase).toBe('waiting');
    expect(api.state.lines[0]).toEqual({ side: 'buddy', text: 'Привет. С чего начнём?', live: false });
  });

  it('sends the transcript when stt ends and speaks the reply', async () => {
    act(() => { create(<Probe />); });
    await flush(); await flush();
    act(() => api.onMic());
    expect(api.state.phase).toBe('listening');
    act(() => stt.handlers!.onResult('La cuenta', false));
    act(() => { stt.handlers!.onResult('La cuenta, por favor', true); stt.handlers!.onEnd(); });
    expect(api.state.phase).toBe('thinking');
    await flush(); await flush();
    expect(turns).toEqual(['', 'La cuenta, por favor']);
    expect(api.state.lines.map((l) => l.text)).toEqual(['Привет. С чего начнём?', 'La cuenta, por favor', 'Sí. ¿Y la cuenta?']);
    expect(api.state.phase).toBe('waiting');
  });
});
```

- [ ] **Step 2: Прогнать — падает** (`Cannot find module '../useTalk'`)

Run: `cd mobile && npx jest src/features/talk/__tests__/useTalk.test.tsx`

- [ ] **Step 3: Хук**

`mobile/src/features/talk/useTalk.ts`:

```ts
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { content } from '@/content';
import type { BuddyState } from '@/features/session/buddyState';
import { recognizer, type SpeechSession } from '@/voice';
import { speak, stopSpeaking } from '@/voice/tts';
import { createSentenceSplitter } from './sentences';
import { initialTalk, reduceTalk, type TalkEffect, type TalkEvent, type TalkState } from './talkMachine';

export interface UseTalkOptions {
  remoteId: string;
  /** BCP-47 для распознавания (язык предмета или интерфейса — как в сессии). */
  sttLang: string;
  /** Язык озвучки; null — озвучки нет, реплики только текстом. */
  ttsLang: string | null;
  uiLang: string;
}

const PHASE_TO_BUDDY: Record<TalkState['phase'], BuddyState> = { waiting: 'waiting', listening: 'listening', thinking: 'thinking', speaking: 'speaking' };

/**
 * Разговор с бадди: исполняет эффекты стейт-машины. Порядок реплики:
 * STT → send (стрим с сервера) → предложения в очередь озвучки → speakDone, когда очередь пуста и стрим закрыт.
 */
export function useTalk({ remoteId, sttLang, ttsLang, uiLang }: UseTalkOptions) {
  const [state, dispatchRaw] = useReducer((s: TalkState, e: TalkEvent) => reduceTalk(s, e).state, undefined, initialTalk);
  const stateRef = useRef(state);
  stateRef.current = state;
  const talkId = useRef<string | null>(null);
  const stt = useRef<SpeechSession | null>(null);
  const queue = useRef<string[]>([]);
  const speakingNow = useRef(false);
  const streamOpen = useRef(false);
  const [seconds, setSeconds] = useState(0);

  const dispatch = useCallback((e: TalkEvent) => {
    const { effects } = reduceTalk(stateRef.current, e);
    dispatchRaw(e);
    effects.forEach(run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pump = useCallback(() => {
    if (speakingNow.current) return;
    const next = queue.current.shift();
    if (next === undefined) {
      if (!streamOpen.current) dispatch({ type: 'speakDone' });
      return;
    }
    if (!ttsLang) {
      pump();
      return;
    }
    speakingNow.current = true;
    speak(next, ttsLang, () => {
      speakingNow.current = false;
      pump();
    }, uiLang);
  }, [dispatch, ttsLang, uiLang]);

  const send = useCallback(async (text: string) => {
    const id = talkId.current ?? (talkId.current = await content.startTalk(remoteId));
    const splitter = createSentenceSplitter();
    queue.current = [];
    streamOpen.current = true;
    dispatch({ type: 'replyStart' });
    try {
      const reply = await content.talkTurn(id, text, (delta) => {
        dispatch({ type: 'replyDelta', text: delta });
        queue.current.push(...splitter.push(delta));
        pump();
      });
      queue.current.push(...splitter.flush());
      dispatch({ type: 'replyDone', text: reply });
    } catch (e) {
      dispatch({ type: 'error', message: e instanceof Error ? e.message : 'network' });
    } finally {
      streamOpen.current = false;
      pump();
    }
  }, [dispatch, pump, remoteId]);

  function run(effect: TalkEffect) {
    switch (effect) {
      case 'startStt':
        stt.current = recognizer.start(
          { lang: sttLang, continuous: false, playback: true },
          {
            onResult: (t, f) => dispatch({ type: 'sttResult', text: t, final: f }),
            onEnd: () => { stt.current = null; dispatch({ type: 'sttEnd' }); },
            onError: () => { stt.current = null; dispatch({ type: 'sttEnd' }); },
          },
        );
        break;
      case 'stopStt':
        stt.current?.stop();
        break;
      case 'send': {
        const line = stateRef.current.lines[stateRef.current.lines.length - 1];
        void send(line?.text ?? '');
        break;
      }
      case 'stopSpeech':
        queue.current = [];
        streamOpen.current = false;
        speakingNow.current = false;
        stopSpeaking();
        break;
      case 'end':
        if (talkId.current) void content.endTalk(talkId.current).catch(() => {});
        break;
    }
  }

  // Вступление бадди и таймер.
  useEffect(() => {
    void send('');
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMic = useCallback(() => dispatch({ type: 'micTap' }), [dispatch]);
  const close = useCallback(() => dispatch({ type: 'close' }), [dispatch]);
  useEffect(() => () => { stt.current?.stop(); stopSpeaking(); }, []);

  return { state, buddyState: PHASE_TO_BUDDY[state.phase], onMic, close, seconds };
}
```

Оговорка про `sttEnd` после «перебить»: в `run('stopStt')` STT вызывает `onEnd` → `sttEnd` — это ожидаемый путь отправки. При `stopSpeech` + `startStt` (перебивание) старый `send` ещё может прислать `replyDelta`; машина игнорирует их не в `speaking`, а `streamOpen=false` не даёт очереди озвучки ожить. Если `talkTurn` завершится после перебивания, его `replyDone` тоже игнорируется машиной (фаза не `speaking`) — но `finally` вызовет `pump()`, который в `listening` отправит `speakDone`, а машина его проигнорирует. Всё консистентно.

`src/voice/types.ts`: в `SpeechOptions` добавить `/** Разговор: запись и озвучка в одной аудиосессии (iOS playAndRecord). */ playback?: boolean;`. В `native.ts` в `m.start({...})` добавить:

```ts
        iosCategory: opts.playback ? { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'duckOthers'], mode: 'spokenAudio' } : undefined,
```

- [ ] **Step 4: Прогнать тест хука**

Run: `cd mobile && npx jest src/features/talk/__tests__/useTalk.test.tsx`
Expected: 2 passed. Если первый тест видит `speaking` вместо `waiting`, добавить третий `await flush()` — озвучка резолвится через `setTimeout(0)` на каждое предложение.

- [ ] **Step 5: Экран**

`mobile/app/talk/[id].tsx`:

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { subjectLanguage, useProgress, subjectConfig, subjectName } from '@/store/progress';
import { voiceLangFor } from '@/features/session/voiceLang';
import { useTalk } from '@/features/talk/useTalk';
import { useT } from '@/i18n';
import { uiLanguageTag } from '@/domain/languages';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';
import { BuddyDockView, MicButton, Screen, SessionHeader, Txt, useReduceMotion } from '@/ui';
import { ttsLangFor } from '@/voice/tts';

/** Разговор с бадди (FR-66): лента реплик, док, большой микрофон. Ничего не хранит локально. */
export default function TalkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const { c, size } = useTheme();
  const reduceMotion = useReduceMotion();
  const uiLang = useSettings((s) => s.lang);
  const sub = useProgress((s) => s.subjects[id]);
  const subjects = useProgress((s) => s.subjects);
  const cfg = useProgress(useShallow((st) => subjectConfig(st, id)));
  const language = subjectLanguage({ subjects }, id);
  const talk = useTalk({
    remoteId: sub?.remoteId ?? '',
    sttLang: voiceLangFor(language, cfg, uiLang),
    ttsLang: ttsLangFor(language, cfg) ?? uiLanguageTag[uiLang],
    uiLang: uiLanguageTag[uiLang],
  });
  const word = talk.state.phase === 'speaking' ? t.talk.talking : t.buddy[talk.buddyState];
  const hint = talk.state.error ? t.talk.errorNet : talk.state.phase === 'listening' ? t.talk.hintListening : talk.state.phase === 'speaking' ? t.talk.hintSpeaking : talk.state.phase === 'waiting' ? t.talk.hintWaiting : '';
  const mm = String(Math.floor(talk.seconds / 60)).padStart(2, '0');
  const ss = String(talk.seconds % 60).padStart(2, '0');
  const stageN = String((sub?.planStage ?? 0) + 1).padStart(2, '0');

  const onClose = () => {
    talk.close();
    router.back();
  };

  return (
    <Screen>
      <SessionHeader chip={subjectName({ subjects }, id)} counter={`${mm}:${ss}`} onClose={onClose} />
      <View style={{ marginTop: 20 }}>
        <Txt t="kicker" color="mut" style={{ letterSpacing: 0.84 }}>{t.talk.kicker(stageN)}</Txt>
        {sub?.plan?.[sub.planStage ?? 0] ? <Txt t="meta" color="mut" style={{ marginTop: 6, lineHeight: 19 }}>{sub.plan[sub.planStage ?? 0].t}</Txt> : null}
      </View>
      <ScrollView style={{ flex: 1, marginTop: 8 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', gap: 12, paddingBottom: 6 }} showsVerticalScrollIndicator={false}>
        {talk.state.lines.map((l, i) =>
          l.side === 'buddy' ? (
            <Txt key={i} t="body" style={{ maxWidth: 310 }}>{l.text || '…'}</Txt>
          ) : (
            <View key={i} style={{ alignSelf: 'flex-end', maxWidth: 280, backgroundColor: c.card, borderWidth: 1.5, borderColor: l.live ? c.line : c.line2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }}>
              <Txt t="row" color={l.live ? 'mut' : 'ink'}>{l.text || '…'}</Txt>
            </View>
          ),
        )}
      </ScrollView>
      <BuddyDockView state={talk.buddyState} word={word} reduceMotion={reduceMotion} accessible accessibilityRole="text" accessibilityLabel={word} accessibilityLiveRegion="polite" />
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <MicButton recording={talk.state.phase === 'listening'} onPress={talk.onMic} size={size.micLg} />
        <Txt t="tiny" color="mut" style={{ marginTop: 8, textAlign: 'center', minHeight: 17 }}>{hint}</Txt>
      </View>
    </Screen>
  );
}
```

`subjectName` уже есть в `store/progress.ts` (функция над `subjects`, возвращает `title ?? topic`); если она не экспортирована — экспортировать. Кнопка «перебить» показывает обычную иконку микрофона (`recording=false`), как в макете: отдельная иконка не нужна для MVP.

В `app/_layout.tsx` после строки `subject/[id]`: `<Stack.Screen name="talk/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />`.

- [ ] **Step 6: Прогнать typecheck и тесты**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: чисто.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/features/talk mobile/app/talk mobile/app/_layout.tsx mobile/src/voice
git commit -m "Client: talk screen and useTalk hook (STT → server stream → sentence TTS)"
```

### Task 11: Вход с «Сегодня»

**Files:**
- Create: `mobile/src/features/talk/useSttAvailable.ts`
- Modify: `mobile/src/features/today/SubjectCard.tsx`, `mobile/app/(tabs)/today.tsx`
- Test: `mobile/src/features/today/__tests__/SubjectCard.test.tsx`

**Interfaces:**
- Produces: `SubjectCard` получает `onTalk?: () => void`; при наличии рендерит строку под футером (`testID="talk-row"`): знак бадди в `waiting`, «Поговорить с бадди», подпись, стрелка. `useSttAvailable(): boolean` — `recognizer.isAvailable()` один раз, по умолчанию `false`.

- [ ] **Step 1: Тест карточки**

```tsx
import React from 'react';
import { act, create } from 'react-test-renderer';

import { SubjectCard } from '../SubjectCard';

const m = { id: 'custom', name: 'Испанский', level: 'Разговорные фразы', lessonTitle: 'Урок 5 · В кафе', done: false };

describe('SubjectCard talk row', () => {
  it('renders the talk row only when onTalk is given and calls it on press', () => {
    const onTalk = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => { tree = create(<SubjectCard m={m} onPress={() => {}} onTalk={onTalk} />); });
    const row = tree.root.findByProps({ testID: 'talk-row' });
    act(() => row.props.onPress());
    expect(onTalk).toHaveBeenCalledTimes(1);
    act(() => { tree = create(<SubjectCard m={m} onPress={() => {}} />); });
    expect(tree.root.findAllByProps({ testID: 'talk-row' })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Прогнать — падает** (строка не найдена)

Run: `cd mobile && npx jest src/features/today`

- [ ] **Step 3: Реализация**

`useSttAvailable.ts`:

```ts
import { useEffect, useState } from 'react';

import { recognizer } from '@/voice';

/** Доступен ли STT на устройстве (разрешение и поддержка). Голос никогда не блокирует: по умолчанию false. */
export function useSttAvailable(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    recognizer.isAvailable().then((v) => alive && setOk(v)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return ok;
}
```

`SubjectCard.tsx`: в props `{ m, onPress, onTalk }: { m: SubjectCardModel; onPress: () => void; onTalk?: () => void }`; импорт `Pressable` из react-native и `BuddyMark, useReduceMotion` из `@/ui`; после футера (последний `<View ... marginTop: 12>`), внутри `Card`:

```tsx
      {onTalk ? (
        <Pressable
          testID="talk-row"
          accessibilityRole="button"
          onPress={onTalk}
          style={({ pressed }) => ({ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.85 : 1 })}
        >
          <View style={{ width: 64, alignItems: 'center' }}>
            <BuddyMark state="waiting" reduceMotion={reduceMotion} animateReaction={false} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt t="rowMed" style={{ lineHeight: 19 }}>{t.talk.entry}</Txt>
            <Txt t="tiny" color="mut" style={{ marginTop: 3 }}>{t.talk.entryNote}</Txt>
          </View>
          <Txt t="body" color="mintInk" style={{ fontSize: 18, lineHeight: 22 }}>→</Txt>
        </Pressable>
      ) : null}
```

где `const reduceMotion = useReduceMotion();` в теле компонента. `Card` с `onPress` оборачивает содержимое в `Pressable`; вложенный `Pressable` перехватывает своё нажатие — это штатно в RN.

`today.tsx`: `const sttOk = useSttAvailable();` и в `SubjectCard` передать

```tsx
              onTalk={sttOk && !m.demo && !m.prepFailed && m.prepStage === undefined && subjects[m.id]?.remoteId ? () => router.push({ pathname: '/talk/[id]', params: { id: m.id } }) : undefined}
```

с `const subjects = useProgress((s) => s.subjects);` и импортом `useSttAvailable`.

- [ ] **Step 4: Прогнать**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: чисто.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/features/talk/useSttAvailable.ts mobile/src/features/today mobile/app/\(tabs\)/today.tsx
git commit -m "Client: «Поговорить с бадди» row on the Today subject card"
```

### Task 12: Сквозная проверка, документация, граф

**Files:**
- Modify: `mobile/README.md` (раздел «Разговор с бадди» без «(план)», как устроено: `src/features/talk`, `app/talk/[id].tsx`), `server/Teach.Api/wwwroot/docs/frd.html` (FR-66, FR-67 → «Реализовано»; FR-68 остаётся «План»; версия 1.6 и дата), `server/Teach.Api/wwwroot/docs/index.html` («Что важно знать»: убрать «(план)», описать реальный цикл), `docs/qa/make_qa_doc.py` (вводный абзац 5.13: раздел действует с build N; M-12 остаётся с оговоркой про FR-68), `docs/qa/README.md` (без изменения числа кейсов).

- [ ] **Step 1: Симулятор без микрофона**

Run: `cd mobile && EXPO_PUBLIC_VOICE_SIM=1 EXPO_PUBLIC_CONTENT_URL=http://localhost:5180 npx expo run:ios` при запущенном сервере с заглушкой (`cd server/Teach.Api && dotnet run`). Симулированный STT «наговаривает» `hint`; в `useTalk` для симуляции передать `hint: 'La cuenta, por favor'` в `recognizer.start` (только при `process.env.EXPO_PUBLIC_VOICE_SIM === '1'`).
Expected: на «Сегодня» у своего предмета есть строка «Поговорить с бадди»; экран открывается, бадди произносит вступление (док «Говорю» → «Ваш ход»); тап по микрофону → «Слушаю», серый транскрипт по словам, после конца → «Думаю» → ответ по словам и «Говорю» → «Ваш ход»; тап во время «Говорю» обрывает озвучку и слушает; крестик возвращает на «Сегодня» без диалога.

- [ ] **Step 2: Устройство с реальной моделью**

Собрать на iPhone (`mobile/README.md` → «Сборка на iPhone») против облачного сервера. Пройти кейсы M-01…M-04, M-06, M-09, M-11, M-13, M-14 из `docs/qa`. Записать замер задержки первой фразы (цель ≤ 2 с) в `index.html` в таблицу «Замеры на реальной модели» строкой «Первая фраза бадди (sonnet, стрим)».
Expected: все перечисленные кейсы PASS; при FAIL — исправление в соответствующей задаче и повторный прогон.

- [ ] **Step 3: Документация**

Внести правки из списка Files. В `frd.html` заголовок `<dd>` → «1.6 · <дата>», футер — та же версия. В `docs/qa/make_qa_doc.py` версия документа не меняется, только вводный абзац 5.13.

- [ ] **Step 4: Граф и тесты**

Run: `graphify update .` из корня, затем `cd server && dotnet test`, `cd mobile && npx tsc --noEmit && npx jest`.
Expected: всё зелёное, `graphify-out` обновлён.

- [ ] **Step 5: Commit**

```bash
git add mobile/README.md server/Teach.Api/wwwroot/docs docs/qa graphify-out
git commit -m "Docs: buddy conversation shipped — FRD v1.6, tech page, README, QA intro"
```

Деплой сервера и загрузка сборки в TestFlight — только по отдельной команде владельца (`fly deploy --remote-only` из `server/Teach.Api`; после выкладки `fly secrets set Teach__App__LatestIosBuild=N`).

---

## Self-review

- **Spec coverage.** FR-66: вход (Task 11), экран и состояния (Tasks 9–10), перебивание (Tasks 8, 10), «ты» (Task 2, промпт), стриминг и озвучка с первого предложения (Tasks 6, 7, 10). FR-67: дайджест (Tasks 3–4), три слоя кэша (Task 3 `TalkAsync`), окно 10 реплик и свёртка (Tasks 2, 5). SR-16: эндпоинт SSE (Task 5). FR-68 — вне плана, точка подключения `POST /talks/{id}/end` (Task 5). Открытые вопросы FRD: аудиосессия — `playAndRecord` (Task 10), голос — системный, без изменений.
- **Placeholder scan.** Все шаги с кодом содержат код; единственная условность — оговорка о типе `MessageParam.Content` в Task 3 и о `Results.Empty` после начатого ответа в Task 5, с указанием, что делать в каждом случае.
- **Type consistency.** `TalkTurn(Role, Text)` (Task 2) используется в Tasks 3, 5; `TalkHistory.Trim → (Kept, Dropped)` — в Task 5; `DigestService.EnsureAsync(db, s, ct)` — в Tasks 4, 5; `createSseParser().push` — в Task 6; `createSentenceSplitter().push/flush` — в Tasks 7, 10; `reduceTalk/initialTalk/TalkEffect` — в Tasks 8, 10; `BuddyDockView` props — в Tasks 9, 10; `ContentService.startTalk/talkTurn/endTalk` — в Tasks 6, 10; `SpeechOptions.playback` — в Task 10; `t.talk.*` ключи — в Tasks 9, 10, 11.
