namespace Teach.Api.Domain;

/// <summary>
/// Двухканальная реплика бадди для языкового предмета: модель отвечает строками
/// «SAY: …» (что произнести вслух, целиком на языке предмета) и «TEXT: …» (что показать: пояснения
/// на языке ученика, фразы на языке предмета). Разбирает поток по кускам, не дожидаясь конца:
/// маркер может прийти разрезанным, поэтому хвост, похожий на начало маркера, придерживается.
/// Без маркеров весь поток считается каналом text (одноканальный ответ).
/// </summary>
public sealed class TalkChannels
{
    private const string SayMark = "SAY:";
    private const string TextMark = "TEXT:";
    private const string TextLineMark = "\nTEXT:";

    private string _buf = "";
    private string _mode = "head"; // head | say | text
    private bool _first = true;

    public IReadOnlyList<(string Channel, string Text)> Push(string delta)
    {
        _buf += delta;
        var outList = new List<(string, string)>();
        for (;;)
        {
            if (_mode == "head")
            {
                var trimmed = _buf.TrimStart();
                if (trimmed.StartsWith(SayMark, StringComparison.Ordinal)) { _mode = "say"; _buf = trimmed[SayMark.Length..]; _first = true; continue; }
                if (trimmed.StartsWith(TextMark, StringComparison.Ordinal)) { _mode = "text"; _buf = trimmed[TextMark.Length..]; _first = true; continue; }
                if (trimmed.Length < TextMark.Length && (SayMark.StartsWith(trimmed, StringComparison.Ordinal) || TextMark.StartsWith(trimmed, StringComparison.Ordinal))) return outList;
                _mode = "text"; _first = true; continue;
            }
            if (_mode == "say")
            {
                var at = _buf.IndexOf(TextLineMark, StringComparison.Ordinal);
                if (at >= 0)
                {
                    Emit(outList, "say", _buf[..at]);
                    _buf = _buf[(at + TextLineMark.Length)..];
                    _mode = "text"; _first = true;
                    continue;
                }
                var hold = HeldSuffix(_buf, TextLineMark);
                Emit(outList, "say", _buf[..^hold]);
                _buf = _buf[^hold..];
                return outList;
            }
            Emit(outList, "text", _buf);
            _buf = "";
            return outList;
        }
    }

    public IReadOnlyList<(string Channel, string Text)> Flush()
    {
        var outList = new List<(string, string)>();
        if (_mode == "head") { _mode = "text"; _first = true; }
        Emit(outList, _mode, _buf);
        _buf = "";
        return outList;
    }

    private void Emit(List<(string, string)> outList, string channel, string text)
    {
        if (_first) { text = text.TrimStart(); if (text.Length == 0) return; _first = false; }
        if (text.Length > 0) outList.Add((channel, text));
    }

    /// <summary>Длина хвоста buf, который может оказаться началом маркера (например «\nTE»).</summary>
    private static int HeldSuffix(string buf, string marker)
    {
        for (var n = Math.Min(marker.Length - 1, buf.Length); n > 0; n--)
            if (buf.EndsWith(marker[..n], StringComparison.Ordinal)) return n;
        return 0;
    }
}
