using Teach.Api.Domain;

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
