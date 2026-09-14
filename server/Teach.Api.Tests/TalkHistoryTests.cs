using Teach.Api.Contracts;
using Teach.Api.Domain;
using Teach.Api.Model;

namespace Teach.Api.Tests;

public class TalkHistoryTests
{
    private static List<TalkTurn> Turns(int n) => Enumerable.Range(1, n).Select(i => new TalkTurn(i % 2 == 1 ? "buddy" : "user", $"t{i}")).ToList();

    [Fact]
    public void KeepsShortHistoryAsIs()
    {
        var (kept, dropped) = TalkHistory.Trim(Turns(10));
        Assert.Equal(10, kept.Count);
        Assert.Empty(dropped);
    }

    [Fact]
    public void DropsOldestBeyondTenKeepingOrder()
    {
        var (kept, dropped) = TalkHistory.Trim(Turns(13));
        Assert.Equal(["t1", "t2", "t3"], dropped.Select(t => t.Text));
        Assert.Equal("t4", kept[0].Text);
        Assert.Equal("t13", kept[^1].Text);
    }

    [Fact]
    public void TranscriptLabelsSpeakers()
    {
        var text = TalkHistory.Transcript([new("buddy", "Привет"), new("user", "Hola")]);
        Assert.Equal("Бадди: Привет\nУченик: Hola", text);
    }
}

public class StubTalkTests
{
    private readonly StubLessonModel _m = new();

    [Fact]
    public async Task DigestMentionsStageAndMistakes()
    {
        var draft = new SubjectDraft("Испанский", "Разговорные фразы", "поездка в Мадрид", [], Title: "Испанский");
        var digest = await _m.BuildDigestAsync(draft, new("02", "Первые фразы для поездки", "заказ, счёт, дорога"), 1,
            [new("cuesta vs cuestan", "число глагола", false, 2, 4), new("por favor", "вежливая просьба", true, 1, 3)],
            [new("la cuenta", "счёт")], CancellationToken.None);
        Assert.Contains("Первые фразы для поездки", digest);
        Assert.Contains("cuesta vs cuestan", digest);
        Assert.Contains("la cuenta", digest);
        Assert.True(digest.Length <= 2000);
    }

    [Fact]
    public async Task TalkOpensThenAnswersWithAQuestion()
    {
        var opening = string.Concat(await Collect(_m.TalkAsync("digest", null, [], "", CancellationToken.None)));
        Assert.Contains("?", opening);
        var reply = string.Concat(await Collect(_m.TalkAsync("digest", null, [new("buddy", opening)], "Hola", CancellationToken.None)));
        Assert.Contains("Hola", reply);
        Assert.EndsWith("?", reply.TrimEnd());
    }

    [Fact]
    public async Task FoldJoinsPreviousSummary()
    {
        var s = await _m.SummarizeTalkAsync("Раньше: говорили о кафе.", [new("user", "¿Cuánto cuesta?"), new("buddy", "Sí.")], CancellationToken.None);
        Assert.StartsWith("Раньше: говорили о кафе.", s);
        Assert.Contains("2 реплик", s);
    }

    private static async Task<List<string>> Collect(IAsyncEnumerable<string> src)
    {
        var list = new List<string>();
        await foreach (var x in src) list.Add(x);
        return list;
    }
}
