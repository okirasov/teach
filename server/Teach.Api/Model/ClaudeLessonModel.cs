using System.Text.Json;
using Anthropic;
using Anthropic.Models.Messages;
using Teach.Api.Contracts;
using Teach.Api.Domain;

namespace Teach.Api.Model;

/// <summary>
/// Claude через официальный Anthropic SDK. Структурированный вывод по JSON-схеме (невалидный JSON невозможен),
/// смысловая валидация — в LessonValidator. Промпт-кэш: методика (system) и контекст предмета — стабильные префиксы.
/// </summary>
public sealed class ClaudeLessonModel(AnthropicClient client, ILogger<ClaudeLessonModel> log) : ILessonModel
{
    public const string LessonModel = "claude-opus-5";
    public const string GradeModel = "claude-haiku-4-5";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public string Name => "claude";

    public async Task<IReadOnlyList<FocusOption>> SuggestFocusAsync(string topic, CancellationToken ct)
    {
        var r = await AskAsync<FocusList>(
            $"Тема ученика: «{topic}». Предложи ровно 3 фокуса — с чего начать, чтобы один урок не был «про всё». t — короткое название, d — одна строка пояснения.",
            Schemas.FocusList, ct);
        return r.Items;
    }

    public async Task<IReadOnlyList<SourceCandidate>> FindSourcesAsync(string topic, string focus, CancellationToken ct)
    {
        var r = await AskAsync<SourceList>(
            $"Тема «{topic}», фокус «{focus}». Найди 4 реальных источника для уроков: t — название, m — одна строка, что это и чем полезно, trust — high/mid/low по правилу: рецензированное и официальное — high, учебные курсы и первоисточники с оговоркой — mid, блоги, треды, научпоп — low. Модель не источник истины: используй поиск.",
            Schemas.SourceList, ct, tools: [new ToolUnion(new WebSearchTool20260209 { MaxUses = 5 })]);
        return r.Items.Select((s, i) => new SourceCandidate($"src-{i}", s.T, s.M, s.Trust)).ToList();
    }

    public async Task<IReadOnlyList<PlanStage>> BuildPlanAsync(string topic, string focus, string mission, CancellationToken ct)
    {
        var r = await AskAsync<PlanList>(
            $"Тема «{topic}», фокус «{focus}», миссия ученика: «{mission}». Составь план из 3 этапов: n — «01/02/03», t — название этапа, d — одна строка. Этап 01 — каркас и термины, 02 — рабочие приёмы малыми шагами, 03 — применение под миссию (повтори её формулировку).",
            Schemas.PlanList, ct);
        return r.Items;
    }

    public async Task<Lesson> GenerateDiagnosticAsync(SubjectDraft draft, IReadOnlyList<SourceCandidate> sources, CancellationToken ct)
    {
        var context = $"""
            Предмет: {draft.Topic}
            Фокус: {draft.Focus}
            Миссия: {draft.Mission}
            Выбранные источники:
            {string.Join("\n", sources.Select(s => $"- {s.T} ({s.Trust}): {s.M}"))}
            """;
        var raw = await AskAsync<RawLesson>(Prompts.Diagnostic, Schemas.Lesson, ct, context: context);
        return raw.ToLesson();
    }

    public async Task<bool[]> GradeFreeAsync(IReadOnlyList<Criterion> criteria, string text, string lang, CancellationToken ct)
    {
        var list = string.Join("\n", criteria.Select((c, i) => $"{i + 1}. {c.T}"));
        var response = await client.Messages.Create(new MessageCreateParams
        {
            Model = GradeModel,
            MaxTokens = 256,
            System = "Ты проверяешь свободный ответ ученика по критериям. Для каждого критерия по порядку ответь true, если он раскрыт по смыслу (не по совпадению слов), иначе false.",
            Messages = [new() { Role = Role.User, Content = $"Критерии:\n{list}\n\nОтвет ученика ({lang}):\n{text}" }],
            OutputConfig = new OutputConfig { Format = new JsonOutputFormat { Schema = Schemas.Grade } },
        }, ct);
        var hits = Parse<GradeResponse>(response).Hits;
        return hits.Length == criteria.Count ? hits : criteria.Select((_, i) => i < hits.Length && hits[i]).ToArray();
    }

    private async Task<T> AskAsync<T>(string task, Dictionary<string, JsonElement> schema, CancellationToken ct, string? context = null, List<ToolUnion>? tools = null)
    {
        var content = new List<ContentBlockParam>();
        if (context is not null)
            content.Add(new TextBlockParam { Text = context, CacheControl = new CacheControlEphemeral() });
        content.Add(new TextBlockParam { Text = task });

        var p = new MessageCreateParams
        {
            Model = LessonModel,
            MaxTokens = 16000,
            System = new List<TextBlockParam> { new() { Text = Prompts.System, CacheControl = new CacheControlEphemeral() } },
            Messages = [new() { Role = Role.User, Content = content }],
            Thinking = new ThinkingConfigAdaptive(),
            OutputConfig = new OutputConfig { Effort = Effort.High, Format = new JsonOutputFormat { Schema = schema } },
            Tools = tools,
        };

        var response = await client.Messages.Create(p, ct);
        log.LogInformation("claude {Model}: in={In} cached={Cached} out={Out} stop={Stop}", LessonModel, response.Usage.InputTokens,
            response.Usage.CacheReadInputTokens, response.Usage.OutputTokens, response.StopReason);
        return Parse<T>(response);
    }

    private static T Parse<T>(Message response)
    {
        if (response.StopReason?.ToString() == "refusal")
            throw new InvalidOperationException("model refused: " + response.StopDetails?.ToString());
        var text = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
        return JsonSerializer.Deserialize<T>(text, Json) ?? throw new InvalidOperationException("empty model output");
    }

    private sealed record FocusList(List<FocusOption> Items);
    private sealed record SourceItem(string T, string M, string Trust);
    private sealed record SourceList(List<SourceItem> Items);
    private sealed record PlanList(List<PlanStage> Items);

    /// <summary>Плоский шаг из схемы структурированного вывода (без anyOf) → доменный шаг.</summary>
    private sealed class RawStep
    {
        public string Type { get; set; } = "";
        public string? Why { get; set; }
        public string? Title { get; set; }
        public List<string>? Paras { get; set; }
        public string? Example { get; set; }
        public string? Source { get; set; }
        public string? Prompt { get; set; }
        public string? Explain { get; set; }
        public string? RecTitle { get; set; }
        public string? RecNote { get; set; }
        public string? Voice { get; set; }
        public List<string>? Options { get; set; }
        public int? Correct { get; set; }
        public List<int>? CorrectOrder { get; set; }
        public string? Placeholder { get; set; }
        public List<List<string>>? Tokens { get; set; }
        public string? Answer { get; set; }
        public List<string>? Items { get; set; }
        public List<FreeCriterion>? Criteria { get; set; }

        public LessonStep ToStep() => Type switch
        {
            "explain" => new ExplainStep { Why = Why ?? "", Title = Title ?? "", Paras = Paras ?? [], Example = Example ?? "", Source = Source ?? "" },
            "choice" => new ChoiceStep { Prompt = Prompt ?? "", Explain = Explain ?? "", RecTitle = RecTitle ?? "", RecNote = RecNote ?? "", Voice = Voice, Options = Options ?? [], Correct = Correct ?? -1 },
            "input" => new InputStep { Prompt = Prompt ?? "", Explain = Explain ?? "", RecTitle = RecTitle ?? "", RecNote = RecNote ?? "", Voice = Voice, Placeholder = Placeholder ?? "", Tokens = Tokens ?? [], Answer = Answer ?? "" },
            "order" => new OrderStep { Prompt = Prompt ?? "", Explain = Explain ?? "", RecTitle = RecTitle ?? "", RecNote = RecNote ?? "", Voice = Voice, Items = Items ?? [], Correct = CorrectOrder ?? [] },
            "free" => new FreeStep { Prompt = Prompt ?? "", Explain = Explain ?? "", RecTitle = RecTitle ?? "", RecNote = RecNote ?? "", Voice = Voice, Placeholder = Placeholder ?? "", Criteria = Criteria ?? [] },
            _ => throw new InvalidOperationException($"unknown step type {Type}"),
        };
    }

    private sealed class RawLesson
    {
        public string Name { get; set; } = "";
        public string Level { get; set; } = "";
        public string? LessonTitle { get; set; }
        public List<RawStep> Steps { get; set; } = [];
        public Lesson ToLesson() => new() { Name = Name, Level = Level, LessonTitle = LessonTitle, Steps = Steps.Select(s => s.ToStep()).ToList() };
    }
}

/// <summary>JSON-схемы структурированного вывода. Плоские, без anyOf — так надёжнее для ограниченной грамматики.</summary>
public static class Schemas
{
    private const string Str = """{"type":"string"}""";
    private const string StrArr = """{"type":"array","items":{"type":"string"}}""";

    private static Dictionary<string, JsonElement> Parse(string json) =>
        JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json.Replace("@S@", Str).Replace("@SA@", StrArr))!;

    public static readonly Dictionary<string, JsonElement> FocusList = Parse("""
        {"type":"object","properties":{"items":{"type":"array","items":{"type":"object","properties":{"t":@S@,"d":@S@},"required":["t","d"],"additionalProperties":false}}},"required":["items"],"additionalProperties":false}
        """);

    public static readonly Dictionary<string, JsonElement> SourceList = Parse("""
        {"type":"object","properties":{"items":{"type":"array","items":{"type":"object","properties":{"t":@S@,"m":@S@,"trust":{"type":"string","enum":["high","mid","low"]}},"required":["t","m","trust"],"additionalProperties":false}}},"required":["items"],"additionalProperties":false}
        """);

    public static readonly Dictionary<string, JsonElement> PlanList = Parse("""
        {"type":"object","properties":{"items":{"type":"array","items":{"type":"object","properties":{"n":@S@,"t":@S@,"d":@S@},"required":["n","t","d"],"additionalProperties":false}}},"required":["items"],"additionalProperties":false}
        """);

    public static readonly Dictionary<string, JsonElement> Grade = Parse("""
        {"type":"object","properties":{"hits":{"type":"array","items":{"type":"boolean"}}},"required":["hits"],"additionalProperties":false}
        """);

    public static readonly Dictionary<string, JsonElement> Lesson = Parse("""
        {"type":"object","properties":{
          "name":@S@,"level":@S@,"lessonTitle":@S@,
          "steps":{"type":"array","items":{"type":"object","properties":{
            "type":{"type":"string","enum":["explain","choice","input","order","free"]},
            "why":@S@,"title":@S@,"paras":@SA@,"example":@S@,"source":@S@,
            "prompt":@S@,"explain":@S@,"recTitle":@S@,"recNote":@S@,"voice":@S@,
            "options":@SA@,"correct":{"type":"integer"},"correctOrder":{"type":"array","items":{"type":"integer"}},
            "placeholder":@S@,"tokens":{"type":"array","items":@SA@},"answer":@S@,
            "items":@SA@,
            "criteria":{"type":"array","items":{"type":"object","properties":{"t":@S@,"keys":@SA@},"required":["t","keys"],"additionalProperties":false}}
          },"required":["type"],"additionalProperties":false}}
        },"required":["name","level","steps"],"additionalProperties":false}
        """);
}
