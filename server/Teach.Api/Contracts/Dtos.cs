using System.Text.Json.Serialization;

namespace Teach.Api.Contracts;

/// <summary>Контракт с клиентом — зеркало mobile/src/content/types.ts.</summary>
public sealed record FocusOption(string T, string D);

public sealed record SourceCandidate(string Id, string T, string M, string Trust);

public sealed record PlanStage(string N, string T, string D);

public sealed record FocusRequest(string Topic);

public sealed record SourcesRequest(string Topic, string Focus);

public sealed record PlanRequest(string Topic, string Focus, string Mission);

/// <summary>Sources — кандидаты, уже найденные мастером; если переданы, сервер не ищет их заново.</summary>
public sealed record SubjectDraft(string Topic, string Focus, string Mission, string[] SourceIds, SourceCandidate[]? Sources = null);

public sealed record SubjectCreated(string SubjectId, string Status);

public sealed record Criterion(string T, string[] Keys);

public sealed record GradeRequest(Criterion[] Criteria, string Text, string Lang);

public sealed record GradeResponse(bool[] Hits);

public sealed record RecapRecord(string Title, string Note, bool Ok, int StepIndex);

public sealed record RecapRequest(RecapRecord[] Records);

/// <summary>GET /subjects/{id}/lesson: preparing → stage, ready → lesson.</summary>
public sealed record LessonStatus(
    string Status,
    int? Stage,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Domain.Lesson? Lesson);
