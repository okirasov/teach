namespace Teach.Api.Domain;

/// <summary>
/// Смысловая валидация поверх схемы (бриф §5.4): невалидный урок пользователю не показывается,
/// генерация повторяется.
/// </summary>
public static class LessonValidator
{
    /// <summary>Бюджет текста по длительности урока (символов): один урок — одна победа.</summary>
    public static int CharBudget(int durationMinutes) => durationMinutes switch { <= 3 => 1400, <= 5 => 2200, _ => 4000 };

    public static IReadOnlyList<string> Validate(Lesson lesson, int durationMinutes = 5)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(lesson.Name)) errors.Add("name is empty");
        if (lesson.Steps is null || lesson.Steps.Count == 0) { errors.Add("no steps"); return errors; }
        if (lesson.Steps.Count > 6) errors.Add("more than 6 steps");
        if (lesson.Steps.Count(s => s is ExplainStep) > 1) errors.Add("more than one explain step");
        if (!lesson.Steps.Any(s => s is PracticeStep)) errors.Add("no practice step");

        var chars = 0;
        for (var i = 0; i < lesson.Steps.Count; i++)
        {
            var step = lesson.Steps[i];
            var at = $"step {i} ({Kind(step)})";
            switch (step)
            {
                case ExplainStep e:
                    Require(errors, at, ("title", e.Title), ("example", e.Example), ("source", e.Source), ("why", e.Why));
                    if (e.Paras is null || e.Paras.Count == 0 || e.Paras.Any(string.IsNullOrWhiteSpace)) errors.Add($"{at}: paras empty");
                    chars += e.Title.Length + e.Example.Length + (e.Paras?.Sum(p => p.Length) ?? 0);
                    break;
                case ChoiceStep c:
                    Practice(errors, at, c);
                    if (c.Options is null || c.Options.Count < 2 || c.Options.Count > 5) errors.Add($"{at}: 2–5 options expected");
                    else if (c.Correct != -1 && (c.Correct < 0 || c.Correct >= c.Options.Count)) errors.Add($"{at}: correct out of range");
                    else if (c.Options.Distinct(StringComparer.OrdinalIgnoreCase).Count() != c.Options.Count) errors.Add($"{at}: duplicate options");
                    chars += c.Prompt.Length + (c.Options?.Sum(o => o.Length) ?? 0) + c.Explain.Length;
                    break;
                case InputStep n:
                    Practice(errors, at, n);
                    if (n.Tokens is null || n.Tokens.Any(g => g is null || g.Count == 0 || g.Any(string.IsNullOrWhiteSpace))) errors.Add($"{at}: token groups must be non-empty");
                    if (n.Tokens is { Count: > 0 } && string.IsNullOrWhiteSpace(n.Answer)) errors.Add($"{at}: answer required when tokens are set");
                    chars += n.Prompt.Length + n.Explain.Length + (n.Answer?.Length ?? 0);
                    break;
                case OrderStep o:
                    Practice(errors, at, o);
                    if (o.Items is null || o.Items.Count < 3 || o.Items.Count > 6) errors.Add($"{at}: 3–6 items expected");
                    else if (o.Correct is null || o.Correct.Count != o.Items.Count || o.Correct.OrderBy(x => x).SequenceEqual(Enumerable.Range(0, o.Items.Count)) is false)
                        errors.Add($"{at}: correct must be a permutation of item indices");
                    chars += o.Prompt.Length + (o.Items?.Sum(x => x.Length) ?? 0) + o.Explain.Length;
                    break;
                case FreeStep f:
                    Practice(errors, at, f);
                    if (f.Criteria is null || f.Criteria.Count is < 2 or > 5) errors.Add($"{at}: 2–5 criteria expected");
                    else if (f.Criteria.Any(cr => string.IsNullOrWhiteSpace(cr.T) || cr.Keys is null || cr.Keys.Count == 0)) errors.Add($"{at}: each criterion needs text and keys");
                    chars += f.Prompt.Length + f.Explain.Length + (f.Criteria?.Sum(cr => cr.T.Length) ?? 0);
                    break;
                default:
                    errors.Add($"{at}: unknown step type");
                    break;
            }
        }
        if (chars > CharBudget(durationMinutes)) errors.Add($"lesson too long: {chars} chars > budget {CharBudget(durationMinutes)}");
        return errors;
    }

    private static string Kind(LessonStep s) => s switch
    {
        ExplainStep => "explain", ChoiceStep => "choice", InputStep => "input", OrderStep => "order", FreeStep => "free", _ => "?",
    };

    private static void Practice(List<string> errors, string at, PracticeStep p)
        => Require(errors, at, ("prompt", p.Prompt), ("explain", p.Explain), ("recTitle", p.RecTitle), ("recNote", p.RecNote));

    private static void Require(List<string> errors, string at, params (string Name, string? Value)[] fields)
    {
        foreach (var (name, value) in fields)
            if (string.IsNullOrWhiteSpace(value)) errors.Add($"{at}: {name} is empty");
    }
}
