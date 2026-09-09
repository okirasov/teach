using Microsoft.EntityFrameworkCore;

namespace Teach.Api.Data;

/// <summary>
/// EnsureCreated создаёт схему только в пустой базе. Для базы на томе доводим схему вручную:
/// новые таблицы и колонки добавляются, старые не трогаем. Список растёт вместе с моделью.
/// </summary>
public static class SchemaUpgrader
{
    private static readonly (string Table, string Column, string Ddl)[] Columns =
    [
        ("Subjects", "SourcesJson", "ALTER TABLE Subjects ADD COLUMN SourcesJson TEXT NULL"),
        ("Subjects", "LessonNumber", "ALTER TABLE Subjects ADD COLUMN LessonNumber INTEGER NOT NULL DEFAULT 0"),
        ("Subjects", "Title", "ALTER TABLE Subjects ADD COLUMN Title TEXT NULL"),
        ("Subjects", "PlanJson", "ALTER TABLE Subjects ADD COLUMN PlanJson TEXT NULL"),
        ("Subjects", "PlanStage", "ALTER TABLE Subjects ADD COLUMN PlanStage INTEGER NOT NULL DEFAULT 0"),
        ("Records", "LessonNumber", "ALTER TABLE Records ADD COLUMN LessonNumber INTEGER NOT NULL DEFAULT 0"),
        ("Records", "PlanStage", "ALTER TABLE Records ADD COLUMN PlanStage INTEGER NOT NULL DEFAULT 0"),
    ];

    private static readonly (string Table, string Ddl)[] Tables =
    [
        ("Lessons", """
            CREATE TABLE IF NOT EXISTS Lessons (
              Id INTEGER NOT NULL CONSTRAINT PK_Lessons PRIMARY KEY AUTOINCREMENT,
              SubjectId TEXT NOT NULL, Number INTEGER NOT NULL, Json TEXT NOT NULL, PromptVersion TEXT NOT NULL, CreatedAt TEXT NOT NULL);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Lessons_SubjectId_Number ON Lessons (SubjectId, Number);
            """),
        ("References", """
            CREATE TABLE IF NOT EXISTS "References" (
              Id TEXT NOT NULL CONSTRAINT PK_References PRIMARY KEY,
              SubjectId TEXT NOT NULL, "Group" TEXT NOT NULL, Title TEXT NOT NULL, RowsJson TEXT NOT NULL,
              UpdatedAfter INTEGER NOT NULL, UpdatedAt TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS IX_References_SubjectId ON "References" (SubjectId);
            """),
    ];

    public static async Task UpgradeAsync(TeachDb db, ILogger log, CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);
        foreach (var (table, ddl) in Tables)
        {
            var exists = await db.Database.SqlQueryRaw<int>($"SELECT COUNT(*) AS Value FROM sqlite_master WHERE type='table' AND name='{table}'").FirstAsync(ct);
            if (exists == 0) { await db.Database.ExecuteSqlRawAsync(ddl, ct); log.LogInformation("schema: created table {Table}", table); }
        }
        foreach (var (table, column, ddl) in Columns)
        {
            var has = await db.Database.SqlQueryRaw<int>($"SELECT COUNT(*) AS Value FROM pragma_table_info('{table}') WHERE name='{column}'").FirstAsync(ct);
            if (has == 0) { await db.Database.ExecuteSqlRawAsync(ddl, ct); log.LogInformation("schema: added {Table}.{Column}", table, column); }
        }
    }
}
