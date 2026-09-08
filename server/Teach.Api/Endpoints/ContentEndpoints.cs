using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Teach.Api.Contracts;
using Teach.Api.Data;
using Teach.Api.Domain;
using Teach.Api.Jobs;
using Teach.Api.Model;

namespace Teach.Api.Endpoints;

/// <summary>HTTP-контракт из docs/ai-content.md. Клиент ходит только сюда, ключей модели у него нет.</summary>
public static class ContentEndpoints
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapContent(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", (ILessonModel model) => Results.Ok(new { ok = true, model = model.Name, prompts = Prompts.Version }));

        app.MapPost("/subjects/focus", async (FocusRequest r, ILessonModel model, CancellationToken ct) =>
            string.IsNullOrWhiteSpace(r.Topic) ? Results.BadRequest("topic is required") : Results.Ok(await model.SuggestFocusAsync(r.Topic.Trim(), ct)));

        app.MapPost("/subjects/sources", async (SourcesRequest r, ILessonModel model, CancellationToken ct) =>
            string.IsNullOrWhiteSpace(r.Topic) ? Results.BadRequest("topic is required") : Results.Ok(await model.FindSourcesAsync(r.Topic.Trim(), (r.Focus ?? "").Trim(), ct)));

        app.MapPost("/subjects/plan", async (PlanRequest r, ILessonModel model, CancellationToken ct) =>
            string.IsNullOrWhiteSpace(r.Topic) ? Results.BadRequest("topic is required") : Results.Ok(await model.BuildPlanAsync(r.Topic.Trim(), (r.Focus ?? "").Trim(), (r.Mission ?? "").Trim(), ct)));

        app.MapPost("/subjects", async (SubjectDraft d, TeachDb db, LessonQueue queue, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(d.Topic)) return Results.BadRequest("topic is required");
            var row = new SubjectRow
            {
                Id = Guid.NewGuid(), Topic = d.Topic.Trim(), Focus = (d.Focus ?? "").Trim(), Mission = (d.Mission ?? "").Trim(),
                SourceIdsJson = JsonSerializer.Serialize(d.SourceIds ?? []), Status = SubjectStatus.Preparing, PrepStage = 0,
                SourcesJson = d.Sources is { Length: > 0 } ? JsonSerializer.Serialize(d.Sources, Json) : null,
                CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
            };
            db.Subjects.Add(row);
            await db.SaveChangesAsync(ct);
            await queue.EnqueueAsync(row.Id, ct);
            return Results.Accepted($"/subjects/{row.Id}/lesson", new SubjectCreated(row.Id.ToString(), "preparing"));
        });

        app.MapGet("/subjects/{id:guid}/lesson", async (Guid id, TeachDb db, CancellationToken ct) =>
        {
            var s = await db.Subjects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            if (s is null) return Results.NotFound();
            return s.Status switch
            {
                SubjectStatus.Ready => Results.Ok(new LessonStatus("ready", null, JsonSerializer.Deserialize<Lesson>(s.LessonJson!, Json))),
                SubjectStatus.Failed => Results.Ok(new LessonStatus("failed", s.PrepStage, null)),
                _ => Results.Ok(new LessonStatus("preparing", s.PrepStage, null)),
            };
        });

        app.MapPost("/sessions/{subjectId}/recap", async (string subjectId, RecapRequest r, TeachDb db, CancellationToken ct) =>
        {
            var now = DateTimeOffset.UtcNow;
            db.Records.AddRange(r.Records.Select(x => new LearningRecordRow
            {
                SubjectId = subjectId, Title = x.Title, Note = x.Note, Ok = x.Ok, StepIndex = x.StepIndex, CreatedAt = now,
            }));
            await db.SaveChangesAsync(ct);
            // Следующий урок по записям — следующий шаг сервера; записи уже накапливаются.
            return Results.Accepted();
        });

        app.MapPost("/grade/free", async (GradeRequest r, ILessonModel model, CancellationToken ct) =>
            r.Criteria is null or { Length: 0 } ? Results.BadRequest("criteria are required")
                : Results.Ok(new GradeResponse(await model.GradeFreeAsync(r.Criteria, r.Text ?? "", r.Lang ?? "ru", ct))));

        return app;
    }
}
