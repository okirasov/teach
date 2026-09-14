using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Teach.Api.Contracts;
using Teach.Api.Data;

namespace Teach.Api.Tests;

public class TalkApiTests(ApiFactory f) : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _http = f.CreateClient();

    private async Task<string> ReadySubjectAsync()
    {
        var created = await _http.PostAsJsonAsync("/subjects", new SubjectDraft("Испанский", "Разговорные фразы", "поездка в Мадрид", ["src-0"], Title: "Испанский"));
        var id = (await created.Content.ReadFromJsonAsync<SubjectCreated>(Json))!.SubjectId;
        for (var i = 0; i < 200; i++)
        {
            var st = await _http.GetFromJsonAsync<LessonStatus>($"/subjects/{id}/lesson", Json);
            if (st!.Status == "ready") return id;
            await Task.Delay(20);
        }
        throw new Exception("lesson never ready");
    }

    private async Task<SubjectRow> RowAsync(string id)
    {
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        return await db.Subjects.AsNoTracking().FirstAsync(x => x.Id == Guid.Parse(id));
    }

    [Fact]
    public async Task DigestIsBuiltAfterTheLessonIsReady()
    {
        var id = await ReadySubjectAsync();
        SubjectRow? row = null;
        for (var i = 0; i < 100; i++)
        {
            row = await RowAsync(id);
            if (row.DigestLesson == 1) break;
            await Task.Delay(20);
        }
        Assert.Equal(1, row!.DigestLesson);
        Assert.Contains("Испанский", row.DigestText);
        Assert.Contains("Этап 01", row.DigestText);
    }
}
