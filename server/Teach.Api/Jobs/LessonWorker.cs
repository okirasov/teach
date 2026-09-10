using System.Text.Json;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Teach.Api.Contracts;
using Teach.Api.Data;
using Teach.Api.Domain;
using Teach.Api.Model;

namespace Teach.Api.Jobs;

/// <summary>План предмета: из мастера или по умолчанию.</summary>
public static class Plans
{
    public static readonly PlanStage[] Default =
    [
        new("01", "Каркас: термины и карта темы", "глоссарий закладывается с первого урока"),
        new("02", "Рабочие приёмы малыми шагами", "один урок — одна победа, практика без подсказок"),
        new("03", "Применение под вашу миссию", "уточним после первых сессий"),
    ];

    public static PlanStage[] Of(SubjectRow s)
    {
        if (s.PlanJson is null) return Default;
        var plan = JsonSerializer.Deserialize<PlanStage[]>(s.PlanJson, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return plan is { Length: > 0 } ? plan : Default;
    }
}

/// <summary>Очередь подготовки первых уроков: без спиннера у пользователя, этапы видны на карточке.</summary>
public enum LessonJobKind { Prepare, Prefetch, Promote }

/// <summary>Задача воркера: собрать текущий урок, заготовить следующий или продвинуть заготовку в текущие.</summary>
public sealed record LessonJob(Guid SubjectId, LessonJobKind Kind);

public sealed class LessonQueue
{
    private readonly Channel<LessonJob> _ch = Channel.CreateUnbounded<LessonJob>();
    public ValueTask EnqueueAsync(Guid subjectId, LessonJobKind kind = LessonJobKind.Prepare, CancellationToken ct = default) =>
        _ch.Writer.WriteAsync(new LessonJob(subjectId, kind), ct);
    public IAsyncEnumerable<LessonJob> ReadAllAsync(CancellationToken ct) => _ch.Reader.ReadAllAsync(ct);
    public ValueTask<LessonJob> ReadAsync(CancellationToken ct) => _ch.Reader.ReadAsync(ct);
}

public sealed class WorkerOptions
{
    /// <summary>Пауза между этапами подготовки (мс) — только чтобы этапы были видны; у реальной модели время задаёт сама генерация.</summary>
    public int StageDelayMs { get; set; } = 1500;
    public int MaxAttempts { get; set; } = 3;
    public int DurationMinutes { get; set; } = 10;
}

public sealed class LessonWorker(LessonQueue queue, IServiceScopeFactory scopes, ILessonModel model, WorkerOptions opts, ILogger<LessonWorker> log)
    : BackgroundService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly CancellationTokenSource _drain = new();

    /// <summary>
    /// Плавная остановка: перестать брать задачи и дождаться конца текущей. Вызывается по SIGINT/SIGTERM
    /// до остановки хоста, поэтому сервер всё это время отвечает на опросы клиента; обрыв генерации
    /// стоил бы повторного вызова модели.
    /// </summary>
    public Task DrainAsync()
    {
        _drain.Cancel();
        return ExecuteTask ?? Task.CompletedTask;
    }

    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(stopping, _drain.Token);
        await RequeueInterruptedAsync(stopping);
        while (!linked.IsCancellationRequested)
        {
            LessonJob job;
            try { job = await queue.ReadAsync(linked.Token); }
            catch (OperationCanceledException) { break; }
            await RunAsync(job, CancellationToken.None);
        }
        log.LogInformation("worker stopped; queued jobs will be requeued on start");
    }

    private async Task RunAsync(LessonJob job, CancellationToken ct)
    {
        try
        {
            switch (job.Kind)
            {
                case LessonJobKind.Prepare: await PrepareAsync(job.SubjectId, ct); break;
                case LessonJobKind.Prefetch: await PrefetchAsync(job.SubjectId, ct); break;
                case LessonJobKind.Promote: await PromoteAsync(job.SubjectId, ct); break;
            }
        }
        catch (Exception e)
        {
            log.LogError(e, "{Kind} {Subject} failed", job.Kind, job.SubjectId);
            if (job.Kind == LessonJobKind.Prefetch) await ClearPrefetchAsync(job.SubjectId, ct);
            else await MarkFailedAsync(job.SubjectId, e.Message, ct);
        }
    }

    /// <summary>Текущий урок: источники → этап → генерация → валидация → ready. Этап уже решён при разборе.</summary>
    private async Task PrepareAsync(Guid id, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var s = await db.Subjects.FindAsync([id], ct);
        if (s is null) return;

        var number = s.LessonNumber + 1;
        var (draft, chosen) = await SourcesAsync(db, s, ct);
        if (number == 1)
        {
            // Этапы «ищу источники → отбираю → собираю» видны только на первом уроке.
            await SetStage(db, s, 1, ct);
            await Task.Delay(opts.StageDelayMs, ct);
        }
        await SetStage(db, s, 2, ct);
        if (number == 1) await Task.Delay(opts.StageDelayMs, ct);

        var (lesson, error) = await GenerateAsync(db, s, draft, chosen, number, s.PlanStage, ct);
        if (lesson is null)
        {
            s.Status = SubjectStatus.Failed;
            s.LastError = error;
            s.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return;
        }
        await PublishAsync(db, s, lesson, number, fromPrefetch: false, ct);
    }

    /// <summary>Заготовка урока N+1 по записям на этот момент; статус предмета не трогаем.</summary>
    private async Task PrefetchAsync(Guid id, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var s = await db.Subjects.FindAsync([id], ct);
        if (s is null || s.Status != SubjectStatus.Ready || s.LessonNumber == 0) return;
        var number = s.LessonNumber + 1;
        if (s.PrefetchJson is not null && s.PrefetchNumber == number) { s.PrefetchRunning = false; await db.SaveChangesAsync(ct); return; }

        var (draft, chosen) = await SourcesAsync(db, s, ct);
        var (lesson, error) = await GenerateAsync(db, s, draft, chosen, number, s.PlanStage, ct);
        s.PrefetchRunning = false;
        if (lesson is null)
        {
            log.LogWarning("subject {Subject}: prefetch of lesson {Number} rejected: {Error}", id, number, error);
        }
        else
        {
            s.PrefetchJson = JsonSerializer.Serialize(lesson, Json);
            s.PrefetchNumber = number;
            s.PrefetchStage = s.PlanStage;
            log.LogInformation("subject {Subject}: lesson {Number} prefetched (stage {Stage})", id, number, s.PlanStage);
        }
        s.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Заготовка становится текущим уроком: история, глоссарий, ready.</summary>
    private async Task PromoteAsync(Guid id, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var s = await db.Subjects.FindAsync([id], ct);
        if (s is null) return;
        if (s.PrefetchJson is null || s.PrefetchNumber != s.LessonNumber + 1 || s.PrefetchStage != s.PlanStage)
        {
            // Заготовки нет или она с другого этапа — обычная генерация.
            s.PrefetchJson = null;
            s.PrefetchNumber = 0;
            await db.SaveChangesAsync(ct);
            await PrepareAsync(id, ct);
            return;
        }
        var lesson = JsonSerializer.Deserialize<Lesson>(s.PrefetchJson, Json)!;
        await PublishAsync(db, s, lesson, s.PrefetchNumber, fromPrefetch: true, ct);
        log.LogInformation("subject {Subject}: lesson {Number} promoted from prefetch", id, s.LessonNumber);
    }

    /// <summary>
    /// Источники ищутся один раз — при создании предмета (мастер присылает их в POST /subjects).
    /// Если их нет (старый клиент), ищем перед первым уроком и сохраняем; дальше никогда не ищем:
    /// web search — самый долгий и дорогой вызов, а источники предмета не меняются от урока к уроку.
    /// </summary>
    private async Task<(SubjectDraft Draft, List<SourceCandidate> Chosen)> SourcesAsync(TeachDb db, SubjectRow s, CancellationToken ct)
    {
        var draft = new SubjectDraft(s.Topic, s.Focus, s.Mission, JsonSerializer.Deserialize<string[]>(s.SourceIdsJson) ?? [], Title: s.Title);
        var known = s.SourcesJson is null ? null : JsonSerializer.Deserialize<List<SourceCandidate>>(s.SourcesJson, Json);
        List<SourceCandidate> all;
        if (known is { Count: > 0 }) all = known;
        else if (s.LessonNumber == 0)
        {
            all = (await model.FindSourcesAsync(s.Topic, s.Focus, ct)).ToList();
            s.SourcesJson = JsonSerializer.Serialize(all, Json);
            await db.SaveChangesAsync(ct);
        }
        else
        {
            log.LogWarning("subject {Subject}: no stored sources, generating lesson {Number} without them", s.Id, s.LessonNumber + 1);
            all = [];
        }
        var chosen = all.Where(x => draft.SourceIds.Length == 0 || draft.SourceIds.Contains(x.Id)).ToList();
        return (draft, chosen);
    }

    /// <summary>Генерация с валидацией и повторами; уровень и заголовок карточки ставим детерминированно.</summary>
    private async Task<(Lesson? Lesson, string? Error)> GenerateAsync(TeachDb db, SubjectRow s, SubjectDraft draft, List<SourceCandidate> chosen, int number, int stageIndex, CancellationToken ct)
    {
        var plan = Plans.Of(s);
        var stage = plan[Math.Min(stageIndex, plan.Length - 1)];
        var duration = s.DurationMinutes > 0 ? s.DurationMinutes : opts.DurationMinutes;
        var records = number == 1
            ? []
            : await db.Records.Where(r => r.SubjectId == s.Id.ToString()).OrderBy(r => r.Id)
                .Select(r => new RecapRecord(r.Title, r.Note, r.Ok, r.StepIndex, r.LessonNumber)).ToListAsync(ct);

        string? lastError = null;
        for (var attempt = 1; attempt <= opts.MaxAttempts; attempt++)
        {
            var lesson = number == 1
                ? await model.GenerateDiagnosticAsync(draft, chosen, ct)
                : await model.GenerateNextLessonAsync(draft, chosen, number, stage, stageIndex, records, duration, ct);
            var errors = LessonValidator.Validate(lesson, number == 1 ? 5 : duration);
            if (errors.Count == 0)
            {
                if (string.IsNullOrWhiteSpace(lesson.LessonTitle))
                    lesson.LessonTitle = $"Урок {number} · {(lesson.Steps[0] as ExplainStep)?.Title ?? lesson.Name}";
                // Строка уровня — от сервера: модель путает этап с номером урока.
                lesson.Level = number == 1 ? "старт" : $"этап {stage.N} · {s.Focus}";
                if (lesson.Steps[0] is ExplainStep ex) ex.Source = SourceLine.Normalize(ex.Source);
                return (lesson, null);
            }
            lastError = string.Join("; ", errors);
            log.LogWarning("subject {Subject}: lesson {Number} rejected (attempt {Attempt}): {Errors}", s.Id, number, attempt, lastError);
        }
        return (null, lastError);
    }

    private async Task PublishAsync(TeachDb db, SubjectRow s, Lesson lesson, int number, bool fromPrefetch, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(lesson, Json);
        s.LessonJson = json;
        s.LessonNumber = number;
        s.PromptVersion = Prompts.Version;
        s.Status = SubjectStatus.Ready;
        s.LastError = null;
        s.LastFromPrefetch = fromPrefetch;
        s.PrefetchJson = null;
        s.PrefetchNumber = 0;
        s.PrefetchRunning = false;
        s.UpdatedAt = DateTimeOffset.UtcNow;
        db.Lessons.Add(new LessonRow { SubjectId = s.Id, Number = number, Json = json, PromptVersion = Prompts.Version, CreatedAt = DateTimeOffset.UtcNow });
        // Глоссарий собираем до статуса ready: клиент забирает урок и справочник одним опросом.
        await UpdateGlossaryAsync(db, s, lesson, number, ct);
        await db.SaveChangesAsync(ct);
        log.LogInformation("subject {Subject} lesson {Number} ready ({Model}, prefetch={Prefetch})", s.Id, number, model.Name, fromPrefetch);
    }

    /// <summary>Очередь живёт в памяти: после перезапуска сервера предметы «в подготовке» ставим заново.</summary>
    private async Task RequeueInterruptedAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var stale = await db.Subjects.Where(s => s.Status == SubjectStatus.Preparing || s.PrefetchRunning).ToListAsync(ct);
        foreach (var s in stale)
        {
            s.PrefetchRunning = false;
            if (s.Status == SubjectStatus.Preparing)
            {
                s.PrepStage = 0;
                await queue.EnqueueAsync(s.Id, LessonJobKind.Prepare, ct);
                log.LogInformation("subject {Subject}: requeued after restart", s.Id);
            }
        }
        if (stale.Count > 0) await db.SaveChangesAsync(ct);
    }

    private async Task ClearPrefetchAsync(Guid id, CancellationToken ct)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
            var s = await db.Subjects.FindAsync([id], ct);
            if (s is null) return;
            s.PrefetchRunning = false;
            await db.SaveChangesAsync(ct);
        }
        catch (Exception e) { log.LogError(e, "clear prefetch {Subject}", id); }
    }

    /// <summary>Глоссарий предмета конденсируется из каждого урока; сбой извлечения урок не отменяет.</summary>
    private async Task UpdateGlossaryAsync(TeachDb db, SubjectRow s, Lesson lesson, int number, CancellationToken ct)
    {
        try
        {
            var fresh = await model.ExtractGlossaryAsync(lesson, ct);
            if (fresh.Count == 0) return;
            var name = s.Title ?? s.Topic;
            var row = await db.References.FirstOrDefaultAsync(r => r.SubjectId == s.Id && r.Group == "Глоссарий", ct);
            var rows = row is null ? [] : JsonSerializer.Deserialize<List<RefRowDto>>(row.RowsJson, Json) ?? [];
            foreach (var f in fresh)
                if (!rows.Any(r => string.Equals(r.K, f.K, StringComparison.OrdinalIgnoreCase))) rows.Add(f);
            if (row is null)
            {
                row = new ReferenceRow { Id = Guid.NewGuid(), SubjectId = s.Id, Group = "Глоссарий", Title = $"Термины · {name}", RowsJson = "[]" };
                db.References.Add(row);
            }
            row.RowsJson = JsonSerializer.Serialize(rows, Json);
            row.UpdatedAfter = number;
            row.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            log.LogInformation("subject {Subject} glossary: {Rows} rows after lesson {Number}", s.Id, rows.Count, number);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception e) { log.LogWarning(e, "glossary for {Subject} failed", s.Id); }
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
