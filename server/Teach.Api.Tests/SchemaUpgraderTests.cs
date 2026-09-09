using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Teach.Api.Data;

namespace Teach.Api.Tests;

public class SchemaUpgraderTests
{
    [Fact]
    public async Task AddsMissingTablesAndColumnsToAnOldDatabase()
    {
        var path = Path.Combine(Path.GetTempPath(), $"teach-old-{Guid.NewGuid():N}.db");
        var options = new DbContextOptionsBuilder<TeachDb>().UseSqlite($"Data Source={path}").Options;
        // База «старой» версии: Subjects без новых колонок, без таблиц Lessons/References.
        await using (var db = new TeachDb(options))
        {
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE Subjects (Id TEXT NOT NULL PRIMARY KEY, Topic TEXT NOT NULL, Focus TEXT NOT NULL, Mission TEXT NOT NULL,
                  SourceIdsJson TEXT NOT NULL, Status INTEGER NOT NULL, PrepStage INTEGER NOT NULL, LessonJson TEXT NULL, PromptVersion TEXT NULL,
                  LastError TEXT NULL, CreatedAt TEXT NOT NULL, UpdatedAt TEXT NOT NULL);
                CREATE TABLE Records (Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, SubjectId TEXT NOT NULL, Title TEXT NOT NULL, Note TEXT NOT NULL,
                  Ok INTEGER NOT NULL, StepIndex INTEGER NOT NULL, CreatedAt TEXT NOT NULL);
                """);
        }
        await using (var db = new TeachDb(options))
        {
            await SchemaUpgrader.UpgradeAsync(db, NullLogger.Instance);
            await SchemaUpgrader.UpgradeAsync(db, NullLogger.Instance); // идемпотентно
            db.Subjects.Add(new SubjectRow { Id = Guid.NewGuid(), Topic = "t", Title = "T", Focus = "f", Mission = "m", SourceIdsJson = "[]", LessonNumber = 2, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow });
            db.References.Add(new ReferenceRow { Id = Guid.NewGuid(), SubjectId = Guid.NewGuid(), Group = "g", Title = "t", RowsJson = "[]", UpdatedAt = DateTimeOffset.UtcNow });
            db.Lessons.Add(new LessonRow { SubjectId = Guid.NewGuid(), Number = 1, Json = "{}", PromptVersion = "v1", CreatedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
            Assert.Equal(1, await db.Subjects.CountAsync(x => x.Title == "T"));
        }
        File.Delete(path);
    }
}
