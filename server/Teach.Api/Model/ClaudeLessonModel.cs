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
    /// <summary>Уроки — качество и есть продукт.</summary>
    public const string LessonModel = "claude-opus-5";
    /// <summary>Шаги мастера (фокусы, имя, план) — быстрее и дешевле; источники остаются на Opus из-за web search.</summary>
    public const string WizardModel = "claude-sonnet-5";
    /// <summary>Извлечение и классификация: оценка ответа, глоссарий.</summary>
    public const string GradeModel = "claude-haiku-4-5";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static ILogger? Log;

    public string Name => "claude";

    public async Task<IReadOnlyList<FocusOption>> SuggestFocusAsync(string topic, CancellationToken ct)
    {
        Log ??= log;
        var r = await AskAsync<FocusList>(
            $"Тема ученика: «{topic}». Предложи ровно 3 фокуса — с чего начать, чтобы один урок не был «про всё». t — короткое название до 30 символов (оно печатается на карточке предмета), d — одна строка пояснения.",
            Schemas.FocusList, ct, effort: Effort.Medium, model: WizardModel);
        // Длинное название фокуса не влезает на карточку предмета: режем по словам.
        return r.Items.Select(f => f with { T = StubLessonModel.TrimWords(f.T, maxChars: 30) }).ToList();
    }

    public async Task<string> SuggestTitleAsync(string topic, CancellationToken ct)
    {
        // Языковой предмет: имя языка без вызова модели — так же, как считает клиент.
        if (StubLessonModel.LanguageName(topic) is { } lang) return lang;
        var r = await AskAsync<TitleOut>(
            $"Тема ученика: «{topic}». Дай короткое имя предмета для карточки: одно слово; два коротких — только если одним не назвать. До 20 символов, без кавычек и точки, с заглавной буквы. Для языка — просто название языка («Итальянский»).",
            Schemas.Title, ct, effort: Effort.Low, model: WizardModel);
        var t = r.Title.Trim().Trim('«', '»', '"', '.');
        return t.Length == 0 ? StubLessonModel.ShortTitle(topic) : StubLessonModel.TrimWords(t, 2);
    }

    public async Task<IReadOnlyList<RefRowDto>> ExtractGlossaryAsync(Lesson lesson, CancellationToken ct)
    {
        var text = string.Join("\n", lesson.Steps.Select(s => s switch
        {
            ExplainStep e => $"{e.Title}\n{string.Join("\n", e.Paras)}\nПример: {e.Example}",
            PracticeStep p => $"{p.Prompt}\n{p.Explain}\n{p.RecTitle}: {p.RecNote}",
            _ => "",
        }));
        var response = await client.Messages.Create(new MessageCreateParams
        {
            Model = GradeModel,
            MaxTokens = 2000,
            System = "Ты составляешь глоссарий предмета из текста урока. Выбери 3–6 терминов или конструкций, которые ученик должен помнить, и дай каждому определение в одну строку (до 90 символов) с примером, если он есть в уроке. Термин на языке предмета, определение на русском. Без общих слов вроде «диагностика» или «самооценка».",
            Messages = [new() { Role = Role.User, Content = text }],
            OutputConfig = new OutputConfig { Format = new JsonOutputFormat { Schema = Schemas.Glossary } },
        }, ct);
        return Parse<GlossaryOut>(response).Items.Select(i => new RefRowDto(i.K.Trim(), i.V.Trim())).Where(i => i.K.Length > 0).ToList();
    }

    public async Task<IReadOnlyList<SourceCandidate>> FindSourcesAsync(string topic, string focus, CancellationToken ct)
    {
        var r = await AskAsync<SourceList>(
            $"Тема «{topic}», фокус «{focus}». Найди 4 реальных источника для уроков: t — название, m — одна строка, что это и чем полезно, trust — high/mid/low по правилу: рецензированное и официальное — high, учебные курсы и первоисточники с оговоркой — mid, блоги, треды, научпоп — low. Модель не источник истины: используй поиск.",
            Schemas.SourceList, ct, effort: Effort.Low, tools: [new ToolUnion(new WebSearchTool20260209 { MaxUses = 2 })]);
        return r.Items.Select((s, i) => new SourceCandidate($"src-{i}", s.T, s.M, s.Trust)).ToList();
    }

    public async Task<IReadOnlyList<PlanStage>> BuildPlanAsync(string topic, string focus, string mission, CancellationToken ct)
    {
        var r = await AskAsync<PlanList>(
            $"Тема «{topic}», фокус «{focus}», миссия ученика: «{mission}». Составь план из 3 этапов: n — «01/02/03», t — название этапа, d — одна строка. Этап 01 — каркас и термины, 02 — рабочие приёмы малыми шагами, 03 — применение под миссию (повтори её формулировку).",
            Schemas.PlanList, ct, effort: Effort.Medium, model: WizardModel);
        return r.Items;
    }

    public async Task<Lesson> GenerateDiagnosticAsync(SubjectDraft draft, IReadOnlyList<SourceCandidate> sources, CancellationToken ct)
    {
        var context = SubjectContext(draft, sources);
        Log ??= log;
        var why = "миссия · " + (string.IsNullOrWhiteSpace(draft.Mission) ? "уточняется" : draft.Mission);
        try
        {
            var raw = await AskAsync<RawLesson>(Prompts.Diagnostic + "\n" + Prompts.Limits(5), Schemas.Lesson, ct, context: context, effort: Effort.Medium);
            return raw.ToLesson(why);
        }
        catch (Exception e) when (e is JsonException or InvalidOperationException)
        {
            // Ограниченная грамматика структурированного вывода изредка зацикливается внутри строки;
            // запасной путь — тот же формат без схемы, JSON вырезается из текста, валидатор проверит смысл.
            log.LogWarning(e, "diagnostic: structured output failed, retrying without schema");
            var raw = await AskAsync<RawLesson>(Prompts.Diagnostic + "\n" + Prompts.Limits(5) + "\nОтветь только одним JSON-объектом без пояснений: " + Schemas.LessonShape,
                null, ct, context: context, effort: Effort.Medium);
            return raw.ToLesson(why);
        }
    }

    public async Task<Lesson> GenerateNextLessonAsync(SubjectDraft draft, IReadOnlyList<SourceCandidate> sources, int number, PlanStage stage, int stageIndex, IReadOnlyList<RecapRecord> records, int durationMinutes, CancellationToken ct)
    {
        Log ??= log;
        var why = "миссия · " + (string.IsNullOrWhiteSpace(draft.Mission) ? "уточняется" : draft.Mission);
        var context = SubjectContext(draft, sources);
        var recs = records.Count == 0
            ? "(записей пока нет)"
            : string.Join("\n", records.TakeLast(20).Select(r => $"- [{(r.Ok ? "ok" : "ошибка")}] {r.Title}: {r.Note}"));
        var task = Prompts.NextLesson.Replace("{N}", number.ToString()).Replace("{STAGE}", $"{stage.N} «{stage.T}» — {stage.D}")
            + "\n" + Prompts.Limits(durationMinutes)
            + "\nЗаписи об усвоенном (последние — важнее):\n" + recs;
        try
        {
            var raw = await AskAsync<RawLesson>(task, Schemas.Lesson, ct, context: context, effort: Effort.Medium);
            return raw.ToLesson(why);
        }
        catch (Exception e) when (e is JsonException or InvalidOperationException)
        {
            log.LogWarning(e, "next lesson: structured output failed, retrying without schema");
            var raw = await AskAsync<RawLesson>(task + "\nОтветь только одним JSON-объектом без пояснений: " + Schemas.LessonShape, null, ct, context: context, effort: Effort.Medium);
            return raw.ToLesson(why);
        }
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

    /// <summary>Контекст предмета — стабильный префикс под кэш промпта.</summary>
    private static string SubjectContext(SubjectDraft draft, IReadOnlyList<SourceCandidate> sources) => $"""
        Предмет: {draft.Title ?? draft.Topic}
        Тема целиком: {draft.Topic}
        Фокус: {draft.Focus}
        Миссия: {draft.Mission}
        Выбранные источники:
        {(sources.Count == 0 ? "- не заданы: опирайся на общепризнанные материалы по теме и в поле source называй реальный источник" : string.Join("\n", sources.Select(s => $"- {s.T} ({s.Trust}): {s.M}")))}
        """;

    private async Task<T> AskAsync<T>(string task, Dictionary<string, JsonElement>? schema, CancellationToken ct, string? context = null, List<ToolUnion>? tools = null, Effort effort = Effort.High, string model = LessonModel)
    {
        var content = new List<ContentBlockParam>();
        if (context is not null)
            content.Add(new TextBlockParam { Text = context, CacheControl = new CacheControlEphemeral() });
        content.Add(new TextBlockParam { Text = task });

        var p = new MessageCreateParams
        {
            Model = model,
            // Thinking считается в max_tokens: запас, чтобы длинное размышление не обрезало JSON урока.
            MaxTokens = 32000,
            System = new List<TextBlockParam> { new() { Text = Prompts.System, CacheControl = new CacheControlEphemeral() } },
            Messages = [new() { Role = Role.User, Content = content }],
            Thinking = new ThinkingConfigAdaptive(),
            OutputConfig = schema is null ? new OutputConfig { Effort = effort } : new OutputConfig { Effort = effort, Format = new JsonOutputFormat { Schema = schema } },
            Tools = tools,
        };

        var started = DateTimeOffset.UtcNow;
        Message response;
        try { response = await client.Messages.Create(p, ct); }
        catch (Exception e)
        {
            log.LogError(e, "claude {Model} failed after {Sec:F0}s", model, (DateTimeOffset.UtcNow - started).TotalSeconds);
            throw;
        }
        log.LogInformation("claude {Model}: in={In} cached={Cached} out={Out} stop={Stop} {Sec:F0}s", model, response.Usage.InputTokens,
            response.Usage.CacheReadInputTokens, response.Usage.OutputTokens, response.StopReason, (DateTimeOffset.UtcNow - started).TotalSeconds);
        return Parse<T>(response);
    }

    private static T Parse<T>(Message response)
    {
        var stop = response.StopReason?.ToString()?.Trim('"');
        if (stop == "refusal")
            throw new InvalidOperationException("model refused: " + response.StopDetails?.ToString());
        if (stop == "max_tokens")
            throw new InvalidOperationException($"model output truncated at max_tokens (out={response.Usage.OutputTokens})");
        var text = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
        Log?.LogDebug("model output ({Len} chars): {Text}", text.Length, text.Length > 4000 ? text[..4000] + "…" : text);
        // Без схемы модель может обернуть JSON в текст — берём от первой '{' до последней '}'.
        var a = text.IndexOf('{');
        var z = text.LastIndexOf('}');
        if (a >= 0 && z > a) text = text[a..(z + 1)];
        try
        {
            return JsonSerializer.Deserialize<T>(text, Json) ?? throw new InvalidOperationException("empty model output");
        }
        catch (JsonException e)
        {
            var tail = text.Length > 300 ? text[^300..] : text;
            throw new JsonException($"{e.Message} | output {text.Length} chars, tail: {tail}", e);
        }
    }

    private sealed record FocusList(List<FocusOption> Items);
    private sealed record TitleOut(string Title);
    private sealed record GlossaryItem(string K, string V);
    private sealed record GlossaryOut(List<GlossaryItem> Items);
    private sealed record SourceItem(string T, string M, string Trust);
    private sealed record SourceList(List<SourceItem> Items);
    private sealed record PlanList(List<PlanStage> Items);

    /// <summary>
    /// Компактный шаг из схемы структурированного вывода (лимит сложности схемы у API жёсткий):
    /// text — абзацы (explain), варианты (choice), элементы (order), критерии «текст | ключ1, ключ2» (free),
    /// группы токенов «a | b» (input); order — индексы правильного порядка. why сервер ставит сам из миссии.
    /// </summary>
    private sealed class RawStep
    {
        public string Type { get; set; } = "";
        public string? Title { get; set; }
        public List<string>? Text { get; set; }
        public string? Example { get; set; }
        public string? Source { get; set; }
        public string? Prompt { get; set; }
        public string? Explain { get; set; }
        public string? RecTitle { get; set; }
        public string? RecNote { get; set; }
        public int? Correct { get; set; }
        public List<int>? Order { get; set; }
        public string? Answer { get; set; }

        private static List<string> Split(string s, char sep) =>
            s.Split(sep, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

        public LessonStep ToStep(string why) => Type switch
        {
            "explain" => new ExplainStep { Why = why, Title = Title ?? "", Paras = Text ?? [], Example = Example ?? "", Source = Source ?? "" },
            "choice" => new ChoiceStep { Prompt = Prompt ?? "", Explain = Explain ?? "", RecTitle = RecTitle ?? "", RecNote = RecNote ?? "", Options = Text ?? [], Correct = Correct ?? -1 },
            "input" => new InputStep
            {
                Prompt = Prompt ?? "", Explain = Explain ?? "", RecTitle = RecTitle ?? "", RecNote = RecNote ?? "", Placeholder = "Наберите ответ…",
                Tokens = (Text ?? []).Select(g => Split(g, '|')).Where(g => g.Count > 0).ToList(), Answer = Answer ?? "",
            },
            "order" => new OrderStep { Prompt = Prompt ?? "", Explain = Explain ?? "", RecTitle = RecTitle ?? "", RecNote = RecNote ?? "", Items = Text ?? [], Correct = Order ?? [] },
            "free" => new FreeStep
            {
                Prompt = Prompt ?? "", Explain = Explain ?? "", RecTitle = RecTitle ?? "", RecNote = RecNote ?? "", Placeholder = "Ответьте развёрнуто — текстом или голосом",
                Criteria = (Text ?? []).Select(c =>
                {
                    var parts = c.Split('|', 2, StringSplitOptions.TrimEntries);
                    return new FreeCriterion { T = parts[0], Keys = parts.Length > 1 ? Split(parts[1], ',') : [] };
                }).ToList(),
            },
            _ => throw new InvalidOperationException($"unknown step type {Type}"),
        };
    }

    private sealed class RawLesson
    {
        public string Name { get; set; } = "";
        public string Level { get; set; } = "";
        public string? LessonTitle { get; set; }
        public List<RawStep> Steps { get; set; } = [];
        public Lesson ToLesson(string why) => new() { Name = Name, Level = Level, LessonTitle = LessonTitle, Steps = Steps.Select(s => s.ToStep(why)).ToList() };
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

    public static readonly Dictionary<string, JsonElement> Title = Parse("""
        {"type":"object","properties":{"title":@S@},"required":["title"],"additionalProperties":false}
        """);

    public static readonly Dictionary<string, JsonElement> Glossary = Parse("""
        {"type":"object","properties":{"items":{"type":"array","items":{"type":"object","properties":{"k":@S@,"v":@S@},"required":["k","v"],"additionalProperties":false}}},"required":["items"],"additionalProperties":false}
        """);

    public static readonly Dictionary<string, JsonElement> Grade = Parse("""
        {"type":"object","properties":{"hits":{"type":"array","items":{"type":"boolean"}}},"required":["hits"],"additionalProperties":false}
        """);

    /// <summary>Тот же формат словами — для запасного пути без схемы.</summary>
    public const string LessonShape =
        "{name, level, steps:[{type: explain|choice|input|order|free, title, text:[…], example, source, prompt, explain, recTitle, recNote, correct:int, order:[int], answer}]}";

    public static readonly Dictionary<string, JsonElement> Lesson = Parse("""
        {"type":"object","properties":{
          "name":@S@,"level":@S@,
          "steps":{"type":"array","items":{"type":"object","properties":{
            "type":{"type":"string","enum":["explain","choice","input","order","free"]},
            "title":@S@,"text":@SA@,"example":@S@,"source":@S@,
            "prompt":@S@,"explain":@S@,"recTitle":@S@,"recNote":@S@,
            "correct":{"type":"integer"},"order":{"type":"array","items":{"type":"integer"}},
            "answer":@S@
          },"required":["type","title","text","example","source","prompt","explain","recTitle","recNote","correct","order","answer"],"additionalProperties":false}}
        },"required":["name","level","steps"],"additionalProperties":false}
        """);
}
