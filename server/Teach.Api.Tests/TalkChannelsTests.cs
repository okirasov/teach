using Teach.Api.Domain;

namespace Teach.Api.Tests;

public class TalkChannelsTests
{
    private static (string Say, string Text) Run(params string[] deltas)
    {
        var p = new TalkChannels();
        var say = ""; var text = "";
        foreach (var d in deltas) foreach (var (ch, t) in p.Push(d)) { if (ch == "say") say += t; else text += t; }
        foreach (var (ch, t) in p.Flush()) { if (ch == "say") say += t; else text += t; }
        return (say, text);
    }

    [Fact]
    public void SplitsSayAndTextEvenWhenMarkersArriveInPieces()
    {
        var (say, text) = Run("SA", "Y: Hi! Let's start.", "\nTE", "XT: Привет. Начнём с ", "Present.");
        Assert.Equal("Hi! Let's start.", say);
        Assert.Equal("Привет. Начнём с Present.", text);
    }

    [Fact]
    public void WithoutMarkersEverythingIsText()
    {
        var (say, text) = Run("Привет. ", "Давай поговорим.");
        Assert.Equal("", say);
        Assert.Equal("Привет. Давай поговорим.", text);
    }

    [Fact]
    public void SayIsStreamedBeforeTextArrives()
    {
        var p = new TalkChannels();
        var first = p.Push("SAY: Hello there, ");
        Assert.Contains(first, x => x.Channel == "say" && x.Text == "Hello there, ");
        var second = p.Push("how are you?\n");
        Assert.Equal("how are you?", string.Concat(second.Where(x => x.Channel == "say").Select(x => x.Text)));
        var third = p.Push("TEXT: Привет");
        Assert.Equal("Привет", string.Concat(third.Where(x => x.Channel == "text").Select(x => x.Text)));
    }
}
