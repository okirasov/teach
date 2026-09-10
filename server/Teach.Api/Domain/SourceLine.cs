using System.Text.RegularExpressions;

namespace Teach.Api.Domain;

/// <summary>
/// Строка источника объяснения. Модель пишет «Название, раздел · доверие высокое/среднее/низкое»;
/// высокое доверие — норма, его в уроке не показываем, среднее и низкое оставляем как предупреждение.
/// </summary>
public static partial class SourceLine
{
    [GeneratedRegex(@"\s*[·—-]\s*доверие\s+высокое\s*$", RegexOptions.IgnoreCase)]
    private static partial Regex HighTrust();

    public static string Normalize(string source) => HighTrust().Replace(source.Trim(), "");
}
