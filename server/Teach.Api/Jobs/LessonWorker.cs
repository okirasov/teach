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
            catch (Exception e) { log.LogError(e, "prepare {Subject} failed", id); }
        }
    }

    private async Task PrepareAsync(Guid id, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var s = await db.Subjects.FindAsync([id], ct);
        if (s is null) return;

        // Этап 0 «Ищу источники» → 1 «Отбираю по доверию» → 2 «Собираю первый урок».
        var draft = new SubjectDraft(s.Topic, s.Focus, s.Mission, JsonSerializer.Deserialize<string[]>(s.SourceIdsJson) ?? []);
        var all = await model.FindSourcesAsync(s.Topic, s.Focus, ct);
        await SetStage(db, s, 1, ct);
        await Task.Delay(opts.StageDelayMs, ct);
        var chosen = all.Where(x => draft.SourceIds.Length == 0 || draft.SourceIds.Contains(x.Id)).ToList();
        await SetStage(db, s, 2, ct);
        await Task.Delay(opts.StageDelayMs, ct);

        string? lastError = null;
        for (var attempt = 1; attempt <= opts.MaxAttempts; attempt++)
        {
            var lesson = await model.GenerateDiagnosticAsync(draft, chosen, ct);
            var errors = LessonValidator.Validate(lesson, opts.DurationMinutes);
            if (errors.Count == 0)
            {
                s.LessonJson = JsonSerializer.Serialize(lesson, Json);
                s.PromptVersion = Prompts.Version;
                s.Status = SubjectStatus.Ready;
                s.LastError = null;
                s.UpdatedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(ct);
                log.LogInformation("subject {Subject} ready ({Model}, attempt {Attempt})", id, model.Name, attempt);
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

    private static async Task SetStage(TeachDb db, SubjectRow s, int stage, CancellationToken ct)
    {
        s.PrepStage = stage;
        s.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}
