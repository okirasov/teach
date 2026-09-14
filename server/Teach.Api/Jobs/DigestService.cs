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
