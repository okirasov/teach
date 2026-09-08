using Microsoft.EntityFrameworkCore;

namespace Teach.Api.Data;

public enum SubjectStatus { Preparing = 0, Ready = 1, Failed = 2 }

public sealed class SubjectRow
{
    public Guid Id { get; set; }
    public required string Topic { get; set; }
    public required string Focus { get; set; }
    public required string Mission { get; set; }
    /// <summary>JSON-массив id выбранных источников.</summary>
    public required string SourceIdsJson { get; set; }
    /// <summary>JSON-массив выбранных источников (SourceCandidate), если мастер их передал.</summary>
    public string? SourcesJson { get; set; }
    public SubjectStatus Status { get; set; }
    /// <summary>0..2 — этапы подготовки (t.prepSteps на клиенте).</summary>
    public int PrepStage { get; set; }
    /// <summary>Готовый урок (JSON модели Lesson).</summary>
    public string? LessonJson { get; set; }
    public string? PromptVersion { get; set; }
    public string? LastError { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>LearningRecord из брифа §5.3 — память системы; из неё строится следующий урок.</summary>
public sealed class LearningRecordRow
{
    public long Id { get; set; }
    public required string SubjectId { get; set; }
    public required string Title { get; set; }
    public required string Note { get; set; }
    public bool Ok { get; set; }
    public int StepIndex { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class TeachDb(DbContextOptions<TeachDb> options) : DbContext(options)
{
    public DbSet<SubjectRow> Subjects => Set<SubjectRow>();
    public DbSet<LearningRecordRow> Records => Set<LearningRecordRow>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<SubjectRow>().HasKey(x => x.Id);
        b.Entity<LearningRecordRow>().HasKey(x => x.Id);
        b.Entity<LearningRecordRow>().HasIndex(x => x.SubjectId);
    }
}
