using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Teach.Api.Auth;
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
        app.MapGet("/health", (ILessonModel model) => Results.Ok(new { ok = true, model = model.Name, prompts = Prompts.Version })).WithSummary("Состояние сервера: модель и версия промптов. Без токена.").WithTags("Служебные");

        app.MapPost("/subjects/focus", async (FocusRequest r, ILessonModel model, CancellationToken ct) =>
            string.IsNullOrWhiteSpace(r.Topic) ? Results.BadRequest("topic is required") : Results.Ok(await model.SuggestFocusAsync(r.Topic.Trim(), ct))).WithSummary("Три варианта сужения темы для мастера (claude-sonnet-5).").WithTags("Мастер предмета");

        // Источники ищутся в фоне: POST создаёт задачу (202), GET отдаёт статус и результат.
        app.MapPost("/subjects/sources", (SourcesRequest r, SourcesJobs jobs) =>
        {
            if (string.IsNullOrWhiteSpace(r.Topic)) return Results.BadRequest("topic is required");
            var id = jobs.Start(r.Topic.Trim(), (r.Focus ?? "").Trim());
            return Results.Accepted($"/subjects/sources/{id}", new JobCreated(id, "running"));
        }).WithSummary("Запустить поиск источников (web search, 30–120 с). Возвращает jobId для опроса.").WithTags("Мастер предмета");

        app.MapGet("/subjects/sources/{jobId}", (string jobId, SourcesJobs jobs) =>
            jobs.Get(jobId) is { } st ? Results.Ok(st) : Results.NotFound()).WithSummary("Статус поиска источников: running | ready (items) | failed.").WithTags("Мастер предмета");

        app.MapPost("/subjects/title", async (FocusRequest r, ILessonModel model, CancellationToken ct) =>
            string.IsNullOrWhiteSpace(r.Topic) ? Results.BadRequest("topic is required") : Results.Ok(new TitleResponse(await model.SuggestTitleAsync(r.Topic.Trim(), ct)))).WithSummary("Короткое имя предмета до 24 символов из формулировки темы.").WithTags("Мастер предмета");

        app.MapPost("/subjects/plan", async (PlanRequest r, ILessonModel model, CancellationToken ct) =>
            string.IsNullOrWhiteSpace(r.Topic) ? Results.BadRequest("topic is required") : Results.Ok(await model.BuildPlanAsync(r.Topic.Trim(), (r.Focus ?? "").Trim(), (r.Mission ?? "").Trim(), ct))).WithSummary("План из этапов под тему, фокус и миссию.").WithTags("Мастер предмета");

        app.MapPost("/subjects", async (SubjectDraft d, HttpContext ctx, TeachDb db, LessonQueue queue, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(d.Topic)) return Results.BadRequest("topic is required");
            var row = new SubjectRow
            {
                Id = Guid.NewGuid(), OwnerId = AuthEndpoints.Caller(ctx).Owner, Topic = d.Topic.Trim(), Title = string.IsNullOrWhiteSpace(d.Title) ? null : d.Title.Trim(), Focus = (d.Focus ?? "").Trim(), Mission = (d.Mission ?? "").Trim(),
                SourceIdsJson = JsonSerializer.Serialize(d.SourceIds ?? []), Status = SubjectStatus.Preparing, PrepStage = 0,
                SourcesJson = d.Sources is { Length: > 0 } ? JsonSerializer.Serialize(d.Sources, Json) : null,
                PlanJson = d.Plan is { Length: > 0 } ? JsonSerializer.Serialize(d.Plan, Json) : null,
                DurationMinutes = d.DurationMinutes ?? 0,
                CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
            };
            db.Subjects.Add(row);
            await db.SaveChangesAsync(ct);
            await queue.EnqueueAsync(row.Id, LessonJobKind.Prepare, ct);
            return Results.Accepted($"/subjects/{row.Id}/lesson", new SubjectCreated(row.Id.ToString(), "preparing"));
        }).WithSummary("Создать предмет и запустить стартовую диагностику в фоне. Источники из мастера передаются в sources и больше не ищутся.").WithTags("Предмет и уроки");

        app.MapGet("/subjects/{id:guid}/lesson", async (Guid id, HttpContext ctx, TeachDb db, CancellationToken ct) =>
        {
            var s = await db.Subjects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            if (s is null || !Owns(ctx, s)) return Results.NotFound();
            var refs = s.Status == SubjectStatus.Ready
                ? (await db.References.AsNoTracking().Where(r => r.SubjectId == id).ToListAsync(ct))
                    .Select(r => new ReferenceDto(r.Id.ToString(), r.Group, r.Title, r.UpdatedAfter, JsonSerializer.Deserialize<RefRowDto[]>(r.RowsJson, Json) ?? [])).ToArray()
                : null;
            var total = Plans.Of(s).Length;
            var prefetchReady = s.PrefetchJson is not null && s.PrefetchNumber == s.LessonNumber + 1;
            return s.Status switch
            {
                SubjectStatus.Ready => Results.Ok(new LessonStatus("ready", null, s.LessonNumber, JsonSerializer.Deserialize<Lesson>(s.LessonJson!, Json), refs, s.PlanStage, total, s.LastFromPrefetch, prefetchReady)),
                SubjectStatus.Failed => Results.Ok(new LessonStatus("failed", s.PrepStage, s.LessonNumber + 1, null, null, s.PlanStage, total)),
                _ => Results.Ok(new LessonStatus("preparing", s.PrepStage, s.LessonNumber + 1, null, null, s.PlanStage, total)),
            };
        }).WithSummary("Статус подготовки: preparing (stage 0..2) | failed | ready с уроком, справочниками, этапом плана и флагами предзагрузки.").WithTags("Предмет и уроки");

        // Разбор: записи об усвоенном сохраняются; для предмета с сервера ставится генерация следующего урока.
        app.MapPost("/sessions/{subjectId}/recap", async (string subjectId, RecapRequest r, HttpContext ctx, TeachDb db, LessonQueue queue, CancellationToken ct) =>
        {
            var now = DateTimeOffset.UtcNow;
            var subject = Guid.TryParse(subjectId, out var gid) ? await db.Subjects.FindAsync([gid], ct) : null;
            // Чужой предмет не трогаем: записи примем как «просто сохранить», урок не готовим.
            if (subject is not null && !Owns(ctx, subject)) subject = null;
            // Повторный разбор того же урока (клиент перезапустился или нажал «Повторить»): записи не дублируем.
            var lessonNo = r.Records.Length > 0 ? r.Records[0].LessonNumber : 0;
            var repeated = subject is not null && lessonNo > 0 && await db.Records.AnyAsync(x => x.SubjectId == subjectId && x.LessonNumber == lessonNo, ct);
            if (!repeated) db.Records.AddRange(r.Records.Select(x => new LearningRecordRow
            {
                SubjectId = subjectId, Title = x.Title, Note = x.Note, Ok = x.Ok, StepIndex = x.StepIndex, CreatedAt = now,
                // Старый клиент не шлёт номер урока — считаем, что запись про текущий урок предмета.
                LessonNumber = x.LessonNumber > 0 ? x.LessonNumber : subject?.LessonNumber ?? 0,
                PlanStage = subject?.PlanStage ?? 0,
            }));
            if (subject is not null && r.DurationMinutes is > 0) subject.DurationMinutes = r.DurationMinutes.Value;
            if (subject is null)
            {
                await db.SaveChangesAsync(ct);
                return Results.Accepted(null, new RecapAccepted("stored"));
            }
            await db.SaveChangesAsync(ct);
            if (repeated && subject.Status == SubjectStatus.Ready && subject.LessonNumber > lessonNo)
                return Results.Accepted($"/subjects/{subject.Id}/lesson", new RecapAccepted("ready"));
            if (repeated && subject.Status == SubjectStatus.Preparing)
                return Results.Accepted($"/subjects/{subject.Id}/lesson", new RecapAccepted("preparing"));

            // Этап по результатам — решается здесь, до генерации (диагностика не в счёт).
            var plan = Plans.Of(subject);
            var stageRows = await db.Records.Where(x => x.SubjectId == subjectId && x.PlanStage == subject.PlanStage && x.LessonNumber > 1).ToListAsync(ct);
            var outcomes = stageRows.GroupBy(x => x.LessonNumber).Select(g => new LessonOutcome(g.Key, g.Count(), g.Count(x => x.Ok))).ToList();
            if (subject.PlanStage < plan.Length - 1 && StagePolicy.ShouldAdvance(outcomes)) subject.PlanStage += 1;

            // Заготовка годится, если собрана на этом же этапе и разбор не провальный; иначе — заново.
            // Если заготовка ещё собирается, задача «продвинуть» встанет в очередь за ней и проверит её сама.
            var okRate = r.Records.Length == 0 ? 1.0 : (double)r.Records.Count(x => x.Ok) / r.Records.Length;
            var prefetchFits = okRate >= 0.5 && (subject.PrefetchRunning || subject.PrefetchStage == subject.PlanStage);
            var hasPrefetch = subject.PrefetchRunning || (subject.PrefetchJson is not null && subject.PrefetchNumber == subject.LessonNumber + 1);
            var usePrefetch = hasPrefetch && prefetchFits;
            if (!usePrefetch) { subject.PrefetchJson = null; subject.PrefetchNumber = 0; }
            if (subject.Status != SubjectStatus.Preparing)
            {
                subject.Status = SubjectStatus.Preparing;
                // Источники уже есть, следующий урок сразу «собираю урок».
                subject.PrepStage = 2;
                subject.LastError = null;
                subject.UpdatedAt = now;
            }
            await db.SaveChangesAsync(ct);
            await queue.EnqueueAsync(subject.Id, usePrefetch ? LessonJobKind.Promote : LessonJobKind.Prepare, ct);
            return Results.Accepted($"/subjects/{subject.Id}/lesson", new RecapAccepted("preparing"));
        }).WithSummary("Записи разбора урока. Для предмета сервера решает этап плана и готовит следующий урок (из заготовки, если она подошла). Повторная отправка того же урока идемпотентна.").WithTags("Предмет и уроки");

        // Предзагрузка: клиент зовёт при открытии урока N, сервер заготавливает N+1 по записям на этот момент.
        app.MapPost("/subjects/{id:guid}/prefetch", async (Guid id, HttpContext ctx, TeachDb db, LessonQueue queue, CancellationToken ct) =>
        {
            var s = await db.Subjects.FindAsync([id], ct);
            if (s is null || !Owns(ctx, s)) return Results.NotFound();
            if (s.Status != SubjectStatus.Ready || s.LessonNumber == 0) return Results.Accepted(null, new PrefetchAccepted("skipped"));
            if (s.PrefetchJson is not null && s.PrefetchNumber == s.LessonNumber + 1) return Results.Accepted(null, new PrefetchAccepted("exists"));
            if (s.PrefetchRunning) return Results.Accepted(null, new PrefetchAccepted("running"));
            s.PrefetchRunning = true;
            await db.SaveChangesAsync(ct);
            await queue.EnqueueAsync(s.Id, LessonJobKind.Prefetch, ct);
            return Results.Accepted(null, new PrefetchAccepted("queued"));
        }).WithSummary("Заготовить следующий урок, пока идёт текущий. Ответ: queued | exists | running | skipped.").WithTags("Предмет и уроки");

        app.MapPost("/grade/free", async (GradeRequest r, ILessonModel model, CancellationToken ct) =>
            r.Criteria is null or { Length: 0 } ? Results.BadRequest("criteria are required")
                : Results.Ok(new GradeResponse(await model.GradeFreeAsync(r.Criteria, r.Text ?? "", r.Lang ?? "ru", ct)))).WithSummary("Оценка свободного ответа по критериям моделью (claude-haiku-4-5): hits[] по каждому критерию.").WithTags("Оценка");

        // История уроков предмета: клиент восстанавливает по ней вопросы старых карточек повторов,
        // которые ссылались только на номер шага и показывали вопрос из текущего урока.
        app.MapGet("/subjects/{id:guid}/lessons", async (Guid id, HttpContext ctx, TeachDb db, CancellationToken ct) =>
        {
            var s = await db.Subjects.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
            if (s is null || !Owns(ctx, s)) return Results.NotFound();
            var rows = await db.Lessons.AsNoTracking().Where(l => l.SubjectId == id).OrderBy(l => l.Number).ToListAsync(ct);
            return Results.Ok(rows.Select(l => new LessonHistoryItem(l.Number, JsonSerializer.Deserialize<Lesson>(l.Json, Json)!)));
        }).WithSummary("Все уроки предмета по порядку номеров: для восстановления вопросов старых карточек повторов.").WithTags("Предмет и уроки");

        // Список своих предметов: нужен при входе на новом устройстве, чтобы подтянуть уже созданное.
        app.MapGet("/subjects", async (HttpContext ctx, TeachDb db, CancellationToken ct) =>
        {
            var owner = AuthEndpoints.Caller(ctx).Owner;
            // Сортировка в памяти: SQLite не умеет ORDER BY по DateTimeOffset.
            var rows = (await db.Subjects.AsNoTracking().Where(x => x.OwnerId == owner).ToListAsync(ct)).OrderBy(x => x.CreatedAt);
            // В список отдаём только свои: предметы общего владельца принадлежали всем сразу и в списке аккаунта не нужны.
            return Results.Ok(rows.Select(x => new SubjectSummary(
                x.Id.ToString(), x.Title ?? x.Topic, x.Topic, x.Focus, x.Mission, x.LessonNumber, x.PlanStage, Plans.Of(x).Length, x.Status.ToString().ToLowerInvariant(), x.UpdatedAt)));
        }).WithSummary("Предметы текущего владельца токена: id, имя, номер урока и этап плана.").WithTags("Предмет и уроки");

        return app;
    }

    /// <summary>
    /// Предмет доступен вызывающему. Предметы, созданные до входа по Apple, лежат у общего владельца
    /// и остаются доступны всем: их и раньше видел каждый с общим токеном, а терять предметы
    /// тестировщиков при обновлении нельзя. Новые предметы принадлежат конкретному аккаунту.
    /// </summary>
    private static bool Owns(HttpContext ctx, SubjectRow s) =>
        s.OwnerId == AuthEndpoints.Caller(ctx).Owner || s.OwnerId == Caller.SharedOwner;
}
