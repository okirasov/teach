using System.Text.Json;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Teach.Api.Contracts;
using Teach.Api.Data;
using Teach.Api.Domain;
using Teach.Api.Model;

namespace Teach.Api.Jobs;

/// <summary>Очередь подготовки первых уроков: без спиннера у пользователя, этапы видны на карточке.</summary>
public sealed class LessonQueue
{
    private readonly Channel<Guid> _ch = Channel.CreateUnbounded<Guid>();
    /// <summary>Задача — предмет; что готовить (первый или следующий урок), воркер решает по LessonNumber.</summary>
    public ValueTask EnqueueAsync(Guid subjectId, CancellationToken ct = default) => _ch.Writer.WriteAsync(subjectId, ct);
    public IAsyncEnumerable<Guid> ReadAllAsync(CancellationToken ct) => _ch.Reader.ReadAllAsync(ct);
}

public sealed class WorkerOptions
{
    /// <summary>Пауза между этапами подготовки (мс) — только чтобы этапы были видны; у реальной модели время задаёт сама генерация.</summary>
    public int StageDelayMs { get; set; } = 1500;
    public int MaxAttempts { get; set; } = 3;
    public int DurationMinutes { get; set; } = 5;
}

public sealed class LessonWorker(LessonQueue queue, IServiceScopeFactory scopes, ILessonModel model, WorkerOptions opts, ILogger<LessonWorker> log)
    : BackgroundService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await foreach (var id in queue.ReadAllAsync(ct))
        {
            try { await PrepareAsync(id, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception e)
            {
                log.LogError(e, "prepare {Subject} failed", id);
                await MarkFailedAsync(id, e.Message, ct);
            }
        }
    }

    private async Task PrepareAsync(Guid id, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var s = await db.Subjects.FindAsync([id], ct);
        if (s is null) return;

        // Этап 0 «Ищу источники» → 1 «Отбираю по доверию» → 2 «Собираю урок».
        var draft = new SubjectDraft(s.Topic, s.Focus, s.Mission, JsonSerializer.Deserialize<string[]>(s.SourceIdsJson) ?? []);
        // Источники, уже найденные мастером, не ищем заново — это самый долгий вызов модели.
        var known = s.SourcesJson is null ? null : JsonSerializer.Deserialize<List<SourceCandidate>>(s.SourcesJson, Json);
        var all = known is { Count: > 0 } ? known : (await model.FindSourcesAsync(s.Topic, s.Focus, ct)).ToList();
        await SetStage(db, s, 1, ct);
        await Task.Delay(opts.StageDelayMs, ct);
        var chosen = all.Where(x => draft.SourceIds.Length == 0 || draft.SourceIds.Contains(x.Id)).ToList();
        await SetStage(db, s, 2, ct);
        await Task.Delay(opts.StageDelayMs, ct);

        var number = s.LessonNumber + 1;
        var records = number == 1
            ? []
            : await db.Records.Where(r => r.SubjectId == id.ToString()).OrderBy(r => r.Id)
                .Select(r => new RecapRecord(r.Title, r.Note, r.Ok, r.StepIndex)).ToListAsync(ct);

        string? lastError = null;
        for (var attempt = 1; attempt <= opts.MaxAttempts; attempt++)
        {
            var lesson = number == 1
                ? await model.GenerateDiagnosticAsync(draft, chosen, ct)
                : await model.GenerateNextLessonAsync(draft, chosen, number, records, ct);
            var errors = LessonValidator.Validate(lesson, opts.DurationMinutes);
            if (errors.Count == 0)
            {
                // Заголовок карточки: схема структурированного вывода его не содержит, ставим сами.
                if (string.IsNullOrWhiteSpace(lesson.LessonTitle))
                    lesson.LessonTitle = $"Урок {number} · {(lesson.Steps[0] as ExplainStep)?.Title ?? lesson.Name}";
                var json = JsonSerializer.Serialize(lesson, Json);
                s.LessonJson = json;
                s.LessonNumber = number;
                s.PromptVersion = Prompts.Version;
                s.Status = SubjectStatus.Ready;
                s.LastError = null;
                s.UpdatedAt = DateTimeOffset.UtcNow;
                db.Lessons.Add(new LessonRow { SubjectId = id, Number = number, Json = json, PromptVersion = Prompts.Version, CreatedAt = DateTimeOffset.UtcNow });
                await db.SaveChangesAsync(ct);
                log.LogInformation("subject {Subject} lesson {Number} ready ({Model}, attempt {Attempt})", id, number, model.Name, attempt);
                return;
            }
            lastError = string.Join("; ", errors);
            log.LogWarning("subject {Subject}: lesson rejected (attempt {Attempt}): {Errors}", id, attempt, lastError);
        }
        s.Status = SubjectStatus.Failed;
        s.LastError = lastError;
        s.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Сбой генерации не должен оставлять предмет в вечном «Готовится…»: клиент увидит failed и предложит повторить.</summary>
    private async Task MarkFailedAsync(Guid id, string error, CancellationToken ct)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
            var s = await db.Subjects.FindAsync([id], ct);
            if (s is null) return;
            s.Status = SubjectStatus.Failed;
            s.LastError = error.Length > 500 ? error[..500] : error;
            s.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        catch (Exception e) { log.LogError(e, "mark failed {Subject}", id); }
    }

    private static async Task SetStage(TeachDb db, SubjectRow s, int stage, CancellationToken ct)
    {
        s.PrepStage = stage;
        s.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}
