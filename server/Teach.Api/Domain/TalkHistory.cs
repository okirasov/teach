namespace Teach.Api.Domain;

/// <summary>Реплика разговора с бадди. Role: user | buddy.</summary>
public sealed record TalkTurn(string Role, string Text);

/// <summary>История разговора: последние Keep реплик как есть, всё старше сворачивается в две фразы (FR-67).</summary>
public static class TalkHistory
{
    public const int Keep = 10;

    public static (IReadOnlyList<TalkTurn> Kept, IReadOnlyList<TalkTurn> Dropped) Trim(IReadOnlyList<TalkTurn> turns)
    {
        if (turns.Count <= Keep) return (turns, []);
        var cut = turns.Count - Keep;
        return (turns.Skip(cut).ToList(), turns.Take(cut).ToList());
    }

    public static string Transcript(IReadOnlyList<TalkTurn> turns) =>
        string.Join("\n", turns.Select(t => (t.Role == "buddy" ? "Бадди: " : "Ученик: ") + t.Text));
}
