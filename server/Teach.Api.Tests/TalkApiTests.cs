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

    private static async Task<List<JsonElement>> ReadEventsAsync(HttpResponseMessage res)
    {
        Assert.Equal("text/event-stream", res.Content.Headers.ContentType!.MediaType);
        var body = await res.Content.ReadAsStringAsync();
        return body.Split("\n\n", StringSplitOptions.RemoveEmptyEntries)
            .Select(chunk => chunk.Trim()).Where(chunk => chunk.StartsWith("data: "))
            .Select(chunk => JsonSerializer.Deserialize<JsonElement>(chunk[6..])).ToList();
    }

    [Fact]
    public async Task TalkOpensStreamsAndStoresTurns()
    {
        var id = await ReadySubjectAsync();
        var created = await _http.PostAsJsonAsync($"/subjects/{id}/talks", new { });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var talkId = (await created.Content.ReadFromJsonAsync<TalkCreated>(Json))!.TalkId;

        var opening = await ReadEventsAsync(await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest("")));
        Assert.True(opening.Count(e => e.GetProperty("t").GetString() == "delta") > 3);
        var done = opening.Last();
        Assert.Equal("done", done.GetProperty("t").GetString());
        Assert.Equal(1, done.GetProperty("turn").GetInt32());
        Assert.Contains("?", done.GetProperty("reply").GetString());

        var second = await ReadEventsAsync(await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest("Hola, un café por favor")));
        Assert.Equal(3, second.Last().GetProperty("turn").GetInt32());
        Assert.Contains("Hola, un café por favor", second.Last().GetProperty("reply").GetString());

        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var row = await db.Talks.AsNoTracking().FirstAsync(t => t.Id == Guid.Parse(talkId));
        var turns = JsonSerializer.Deserialize<Teach.Api.Domain.TalkTurn[]>(row.TurnsJson, Json)!;
        Assert.Equal(["buddy", "user", "buddy"], turns.Select(t => t.Role));
        Assert.False(row.Ended);
    }

    [Fact]
    public async Task OldTurnsAreFoldedIntoASummary()
    {
        var id = await ReadySubjectAsync();
        var talkId = (await (await _http.PostAsJsonAsync($"/subjects/{id}/talks", new { })).Content.ReadFromJsonAsync<TalkCreated>(Json))!.TalkId;
        await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest(""));
        for (var i = 1; i <= 6; i++) await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest($"реплика {i}"));
        // 1 + 6·2 = 13 реплик → хранится 10, три старших свёрнуты.
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var row = await db.Talks.AsNoTracking().FirstAsync(t => t.Id == Guid.Parse(talkId));
        var turns = JsonSerializer.Deserialize<Teach.Api.Domain.TalkTurn[]>(row.TurnsJson, Json)!;
        Assert.Equal(10, turns.Length);
        Assert.Contains("Свёрнуто 3 реплик", row.OlderSummary);
    }

    [Fact]
    public async Task DemoTalkWithoutAServerSubjectUsesTheInlineDigest()
    {
        var draft = new TalkDraft("Английский", "Рассказ о себе", "проходить собеседования на английском", "Английский",
            new("01", "Каркас и термины", "базовые фразы о себе"), [new("to be", "глагол-связка")], [new("Present Simple", "форма 3-го лица", false, 1, 2)]);
        var created = await _http.PostAsJsonAsync("/talks", draft);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var talkId = (await created.Content.ReadFromJsonAsync<TalkCreated>(Json))!.TalkId;
        var opening = await ReadEventsAsync(await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest("")));
        Assert.Equal("done", opening.Last().GetProperty("t").GetString());
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var row = await db.Talks.AsNoTracking().FirstAsync(t => t.Id == Guid.Parse(talkId));
        Assert.Equal(Guid.Empty, row.SubjectId);
        Assert.Contains("Английский", row.DigestText);
        Assert.Contains("Present Simple", row.DigestText);
        Assert.Contains("to be", row.DigestText);
        Assert.Equal(HttpStatusCode.BadRequest, (await _http.PostAsJsonAsync("/talks", draft with { Topic = " " })).StatusCode);
    }

    [Fact]
    public async Task LanguageTalkStreamsSayAndTextChannels()
    {
        var id = await ReadySubjectAsync();
        var talkId = (await (await _http.PostAsJsonAsync($"/subjects/{id}/talks", new { })).Content.ReadFromJsonAsync<TalkCreated>(Json))!.TalkId;
        var events = await ReadEventsAsync(await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest("", "en-US")));
        var say = string.Concat(events.Where(e => e.GetProperty("t").GetString() == "delta" && e.GetProperty("ch").GetString() == "say").Select(e => e.GetProperty("text").GetString()));
        var text = string.Concat(events.Where(e => e.GetProperty("t").GetString() == "delta" && e.GetProperty("ch").GetString() == "text").Select(e => e.GetProperty("text").GetString()));
        Assert.StartsWith("Hi! Let's talk", say);
        Assert.StartsWith("Привет. Давай", text);
        var done = events.Last();
        Assert.Equal(text.Trim(), done.GetProperty("reply").GetString());
        Assert.Equal(say.Trim(), done.GetProperty("say").GetString());
        // История хранит текст для чтения, не голос.
        using var scope = f.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TeachDb>();
        var row = await db.Talks.AsNoTracking().FirstAsync(t => t.Id == Guid.Parse(talkId));
        var turns = JsonSerializer.Deserialize<Teach.Api.Domain.TalkTurn[]>(row.TurnsJson, Json)!;
        Assert.StartsWith("Привет. Давай", turns[0].Text);
        Assert.DoesNotContain("SAY:", turns[0].Text);
    }

    [Fact]
    public async Task EndedTalkRejectsTurnsAndStrangersGet404()
    {
        var id = await ReadySubjectAsync();
        var talkId = (await (await _http.PostAsJsonAsync($"/subjects/{id}/talks", new { })).Content.ReadFromJsonAsync<TalkCreated>(Json))!.TalkId;
        var ended = await _http.PostAsJsonAsync($"/talks/{talkId}/end", new { });
        Assert.Equal(HttpStatusCode.Accepted, ended.StatusCode);
        Assert.Equal("ended", (await ended.Content.ReadFromJsonAsync<TalkEnded>(Json))!.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await _http.PostAsJsonAsync($"/talks/{talkId}/turns", new TurnRequest("ещё"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _http.PostAsJsonAsync($"/talks/{Guid.NewGuid()}/turns", new TurnRequest("x"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _http.PostAsJsonAsync($"/subjects/{Guid.NewGuid()}/talks", new { })).StatusCode);
    }
}
