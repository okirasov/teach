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

        // Источники ищутся в фоне: POST создаёт задачу (202), GET отдаёт статус и результат.
        app.MapPost("/subjects/sources", (SourcesRequest r, SourcesJobs jobs) =>
        {
            if (string.IsNullOrWhiteSpace(r.Topic)) return Results.BadRequest("topic is required");
            var id = jobs.Start(r.Topic.Trim(), (r.Focus ?? "").Trim());
            return Results.Accepted($"/subjects/sources/{id}", new JobCreated(id, "running"));
        });

        app.MapGet("/subjects/sources/{jobId}", (string jobId, SourcesJobs jobs) =>
            jobs.Get(jobId) is { } st ? Results.Ok(st) : Results.NotFound());

        app.MapPost("/subjects/title", async (FocusRequest r, ILessonModel model, CancellationToken ct) =>
            string.IsNullOrWhiteSpace(r.Topic) ? Results.BadRequest("topic is required") : Results.Ok(new TitleResponse(await model.SuggestTitleAsync(r.Topic.Trim(), ct))));

        app.MapPost("/subjects/plan", async (PlanRequest r, ILessonModel model, CancellationToken ct) =>
            string.IsNullOrWhiteSpace(r.Topic) ? Results.BadRequest("topic is required") : Results.Ok(await model.BuildPlanAsync(r.Topic.Trim(), (r.Focus ?? "").Trim(), (r.Mission ?? "").Trim(), ct)));

        app.MapPost("/subjects", async (SubjectDraft d, TeachDb db, LessonQueue queue, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(d.Topic)) return Results.BadRequest("topic is required");
            var row = new SubjectRow
            {
                Id = Guid.NewGuid(), Topic = d.Topic.Trim(), Title = string.IsNullOrWhiteSpace(d.Title) ? null : d.Title.Trim(), Focus = (d.Focus ?? "").Trim(), Mission = (d.Mission ?? "").Trim(),
                SourceIdsJson = JsonSerializer.Serialize(d.SourceIds ?? []), Status = SubjectStatus.Preparing, PrepStage = 0,
                SourcesJson = d.Sources is { Length: > 0 } ? JsonSerializer.Serialize(d.Sources, Json) : null,
                PlanJson = d.Plan is { Length: > 0 } ? JsonSerializer.Serialize(d.Plan, Json) : null,
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
            var refs = s.Status == SubjectStatus.Ready
                ? (await db.References.AsNoTracking().Where(r => r.SubjectId == id).ToListAsync(ct))
                    .Select(r => new ReferenceDto(r.Id.ToString(), r.Group, r.Title, r.UpdatedAfter, JsonSerializer.Deserialize<RefRowDto[]>(r.RowsJson, Json) ?? [])).ToArray()
                : null;
            var total = Plans.Of(s).Length;
            return s.Status switch
            {
                SubjectStatus.Ready => Results.Ok(new LessonStatus("ready", null, s.LessonNumber, JsonSerializer.Deserialize<Lesson>(s.LessonJson!, Json), refs, s.PlanStage, total)),
                SubjectStatus.Failed => Results.Ok(new LessonStatus("failed", s.PrepStage, s.LessonNumber + 1, null, null, s.PlanStage, total)),
                _ => Results.Ok(new LessonStatus("preparing", s.PrepStage, s.LessonNumber + 1, null, null, s.PlanStage, total)),
            };
        });

        // Разбор: записи об усвоенном сохраняются; для предмета с сервера ставится генерация следующего урока.
        app.MapPost("/sessions/{subjectId}/recap", async (string subjectId, RecapRequest r, TeachDb db, LessonQueue queue, CancellationToken ct) =>
        {
            var now = DateTimeOffset.UtcNow;
            var subject = Guid.TryParse(subjectId, out var gid) ? await db.Subjects.FindAsync([gid], ct) : null;
            db.Records.AddRange(r.Records.Select(x => new LearningRecordRow
            {
                SubjectId = subjectId, Title = x.Title, Note = x.Note, Ok = x.Ok, StepIndex = x.StepIndex, CreatedAt = now,
                // Старый клиент не шлёт номер урока — считаем, что запись про текущий урок предмета.
                LessonNumber = x.LessonNumber > 0 ? x.LessonNumber : subject?.LessonNumber ?? 0,
                PlanStage = subject?.PlanStage ?? 0,
            }));
            if (subject is not null && subject.Status != SubjectStatus.Preparing)
            {
                subject.Status = SubjectStatus.Preparing;
                subject.PrepStage = 0;
                subject.LastError = null;
                subject.UpdatedAt = now;
            }
            await db.SaveChangesAsync(ct);
            if (subject is null) return Results.Accepted(null, new RecapAccepted("stored"));
            await queue.EnqueueAsync(subject.Id, ct);
            return Results.Accepted($"/subjects/{subject.Id}/lesson", new RecapAccepted("preparing"));
        });

        app.MapPost("/grade/free", async (GradeRequest r, ILessonModel model, CancellationToken ct) =>
            r.Criteria is null or { Length: 0 } ? Results.BadRequest("criteria are required")
                : Results.Ok(new GradeResponse(await model.GradeFreeAsync(r.Criteria, r.Text ?? "", r.Lang ?? "ru", ct))));

        return app;
    }
}
