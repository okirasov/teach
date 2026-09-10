using System.Text.Json.Serialization;

namespace Teach.Api.Contracts;

/// <summary>Контракт с клиентом — зеркало mobile/src/content/types.ts.</summary>
public sealed record FocusOption(string T, string D);

public sealed record SourceCandidate(string Id, string T, string M, string Trust);

public sealed record PlanStage(string N, string T, string D);

public sealed record FocusRequest(string Topic);

/// <summary>Короткое имя предмета для карточек и пиллов (≤ 24 символов), из полной формулировки темы.</summary>
public sealed record TitleResponse(string Title);

public sealed record RefRowDto(string K, string V, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Sec = null);

/// <summary>Справочник предмета (Reference из брифа §5.3), конденсируется из уроков.</summary>
public sealed record ReferenceDto(string Id, string Group, string Title, int UpdatedAfter, RefRowDto[] Rows);

public sealed record SourcesRequest(string Topic, string Focus);

public sealed record PlanRequest(string Topic, string Focus, string Mission);

/// <summary>Sources — кандидаты, уже найденные мастером; если переданы, сервер не ищет их заново.</summary>
/// <summary>DurationMinutes — «Длительность урока» из настроек предмета (3/5/10): задаёт бюджет текста и число практик.</summary>
public sealed record SubjectDraft(string Topic, string Focus, string Mission, string[] SourceIds, SourceCandidate[]? Sources = null, string? Title = null, PlanStage[]? Plan = null, int? DurationMinutes = null);

public sealed record SubjectCreated(string SubjectId, string Status);

/// <summary>Поиск источников — фоновая задача: web search у модели идёт 1–2 минуты, дольше таймаута HTTP на телефоне.</summary>
public sealed record JobCreated(string JobId, string Status);

public sealed record SourcesJobStatus(
    string Status,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<SourceCandidate>? Items,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error);

public sealed record Criterion(string T, string[] Keys);

public sealed record GradeRequest(Criterion[] Criteria, string Text, string Lang);

public sealed record GradeResponse(bool[] Hits);

public sealed record RecapRecord(string Title, string Note, bool Ok, int StepIndex, int LessonNumber = 0);

public sealed record RecapRequest(RecapRecord[] Records, int? DurationMinutes = null);

/// <summary>Ответ на разбор: preparing — следующий урок ставится в очередь; stored — записи сохранены (сидовый предмет).</summary>
public sealed record RecapAccepted(string Status);

/// <summary>GET /subjects/{id}/lesson: preparing → stage, ready → lesson.</summary>
public sealed record LessonStatus(
    string Status,
    int? Stage,
    /// <summary>Номер готового урока (1 — диагностика); при preparing — номер урока, который готовится.</summary>
    int Number,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Domain.Lesson? Lesson,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ReferenceDto[]? References = null,
    /// <summary>Текущий этап плана (0-based) и число этапов; этапом владеет сервер по результатам.</summary>
    int PlanStage = 0,
    int PlanTotal = 3,
    /// <summary>Урок пришёл из заготовки предзагрузки.</summary>
    bool Prefetched = false,
    /// <summary>Заготовка следующего урока уже лежит на сервере.</summary>
    bool PrefetchReady = false);

public sealed record PrefetchAccepted(string Status);

public sealed record SubjectSummary(string Id, string Name, string Topic, string Focus, string Mission, int LessonNumber, int PlanStage, int PlanTotal, string Status, DateTimeOffset UpdatedAt);
