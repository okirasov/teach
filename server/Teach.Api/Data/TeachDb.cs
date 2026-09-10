using Microsoft.EntityFrameworkCore;

namespace Teach.Api.Data;

public enum SubjectStatus { Preparing = 0, Ready = 1, Failed = 2 }

public sealed class SubjectRow
{
    public Guid Id { get; set; }
    /// <summary>Владелец: `apple:&lt;sub&gt;`, `tester:&lt;имя&gt;` или `shared` у сборок со старым общим токеном.</summary>
    public string OwnerId { get; set; } = Auth.Caller.SharedOwner;
    public required string Topic { get; set; }
    /// <summary>Короткое имя для карточек; null — показывается Topic.</summary>
    public string? Title { get; set; }
    public required string Focus { get; set; }
    public required string Mission { get; set; }
    /// <summary>JSON-массив id выбранных источников.</summary>
    public required string SourceIdsJson { get; set; }
    /// <summary>JSON-массив выбранных источников (SourceCandidate), если мастер их передал.</summary>
    public string? SourcesJson { get; set; }
    public SubjectStatus Status { get; set; }
    /// <summary>0..2 — этапы подготовки (t.prepSteps на клиенте).</summary>
    public int PrepStage { get; set; }
    /// <summary>Текущий готовый урок (JSON модели Lesson).</summary>
    public string? LessonJson { get; set; }
    /// <summary>Номер текущего урока: 0 — ещё нет, 1 — диагностика.</summary>
    public int LessonNumber { get; set; }
    /// <summary>План из мастера (JSON PlanStage[]); null — план по умолчанию из трёх этапов.</summary>
    public string? PlanJson { get; set; }
    /// <summary>Текущий этап плана, 0-based. Меняется только по результатам (StagePolicy).</summary>
    public int PlanStage { get; set; }
    /// <summary>Длительность урока из настроек предмета (3/5/10 мин); 0 — по умолчанию сервера.</summary>
    public int DurationMinutes { get; set; }
    /// <summary>Заготовка следующего урока (предзагрузка): JSON, номер и этап, на котором она собрана.</summary>
    public string? PrefetchJson { get; set; }
    public int PrefetchNumber { get; set; }
    public int PrefetchStage { get; set; }
    /// <summary>Идёт предзагрузка — второй раз не ставим.</summary>
    public bool PrefetchRunning { get; set; }
    /// <summary>Текущий урок пришёл из заготовки (для статуса и метрик).</summary>
    public bool LastFromPrefetch { get; set; }
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
    /// <summary>Урок, на котором сделана запись (0 — неизвестно, старые клиенты).</summary>
    public int LessonNumber { get; set; }
    /// <summary>Этап плана, к которому относился урок.</summary>
    public int PlanStage { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Справочник предмета: сжатая суть уроков, растёт после каждого урока.</summary>
public sealed class ReferenceRow
{
    public Guid Id { get; set; }
    public Guid SubjectId { get; set; }
    public required string Group { get; set; }
    public required string Title { get; set; }
    /// <summary>JSON-массив RefRowDto.</summary>
    public required string RowsJson { get; set; }
    public int UpdatedAfter { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>История уроков предмета — для справочников и повторной выдачи.</summary>
public sealed class LessonRow
{
    public long Id { get; set; }
    public Guid SubjectId { get; set; }
    public int Number { get; set; }
    public required string Json { get; set; }
    public required string PromptVersion { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class TeachDb(DbContextOptions<TeachDb> options) : DbContext(options)
{
    public DbSet<SubjectRow> Subjects => Set<SubjectRow>();
    public DbSet<LearningRecordRow> Records => Set<LearningRecordRow>();
    public DbSet<LessonRow> Lessons => Set<LessonRow>();
    public DbSet<ReferenceRow> References => Set<ReferenceRow>();
    public DbSet<ApiTokenRow> ApiTokens => Set<ApiTokenRow>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<SubjectRow>().HasKey(x => x.Id);
        b.Entity<SubjectRow>().HasIndex(x => x.OwnerId);
        b.Entity<ApiTokenRow>().HasKey(x => x.Id);
        b.Entity<ApiTokenRow>().HasIndex(x => x.Hash).IsUnique();
        b.Entity<LearningRecordRow>().HasKey(x => x.Id);
        b.Entity<LearningRecordRow>().HasIndex(x => x.SubjectId);
        b.Entity<LessonRow>().HasKey(x => x.Id);
        b.Entity<LessonRow>().HasIndex(x => new { x.SubjectId, x.Number }).IsUnique();
        b.Entity<ReferenceRow>().HasKey(x => x.Id);
        b.Entity<ReferenceRow>().HasIndex(x => x.SubjectId);
    }
}

/// <summary>
/// Выданный токен доступа. Хранится только SHA-256: утечка базы не даёт рабочих токенов.
/// Kind: `user` — выдан по Apple identityToken, `tester` — именной токен тестировщика.
/// </summary>
public sealed class ApiTokenRow
{
    public Guid Id { get; set; }
    public required string Hash { get; set; }
    public required string OwnerId { get; set; }
    public required string Kind { get; set; }
    public string? Name { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastUsedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
