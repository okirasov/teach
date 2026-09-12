using System.Text.RegularExpressions;
using Teach.Api.Contracts;
using Teach.Api.Domain;

namespace Teach.Api.Model;

/// <summary>Заглушка с данными прототипа (mobile/src/content/local.ts). Работает без ключа модели.</summary>
public sealed partial class StubLessonModel : ILessonModel
{
    public string Name => "stub";

    public static string TopicKind(string topic)
    {
        var x = (topic ?? "").ToLowerInvariant();
        if (HumanRx().IsMatch(x)) return "human";
        if (LangRx().IsMatch(x)) return "lang";
        if (TechRx().IsMatch(x)) return "tech";
        if (SoftRx().IsMatch(x)) return "soft";
        return "gen";
    }

    public Task<IReadOnlyList<FocusOption>> SuggestFocusAsync(string topic, CancellationToken ct)
    {
        var t = string.IsNullOrWhiteSpace(topic) ? "тема" : topic;
        IReadOnlyList<FocusOption> r = TopicKind(topic) switch
        {
            "human" => [new("Поздняя Античность", "Рим, раздел империи, варвары — III–VI вв."), new("Революции Нового времени", "Англия, Франция, Америка — механика перелома"), new("XX век: мировые войны", "причины, коалиции, последствия")],
            "lang" => [new("Грамматика для речи", "времена и конструкции, которые нужны в разговоре"), new("Рабочий словарь", "лексика вашей профессии"), new("Аудирование и произношение", "понимать на слух и быть понятым")],
            "tech" => [new("Основы и синтаксис", "база, без которой не пойти дальше"), new("Практика на задачах", "типовые сценарии из работы"), new("Архитектура и оптимизация", "почему так, а не иначе")],
            "soft" => [new("Структура и аргументы", "как строить мысль"), new("Подача и голос", "темп, паузы, уверенность"), new("Работа с аудиторией", "вопросы, возражения, внимание")],
            _ => [new($"{t}: основы", "карта темы и ключевые понятия"), new($"{t}: практика", "применение в типовых ситуациях"), new($"{t}: глубина", "спорные места и детали")],
        };
        return Task.FromResult(r);
    }

    /// <summary>Заглушка: язык предмета или первые слова темы.</summary>
    public Task<string> SuggestTitleAsync(string topic, CancellationToken ct) => Task.FromResult(ShortTitle(topic));

    /// <summary>Языковой предмет → имя языка; та же таблица, что в клиенте (domain/languages.ts).</summary>
    public static string? LanguageName(string topic)
    {
        var t = (topic ?? "").Trim();
        foreach (var (rx, name) in Languages)
            if (Regex.IsMatch(t, rx, RegexOptions.IgnoreCase)) return name;
        return null;
    }

    private static readonly (string Rx, string Name)[] Languages =
    [
        ("англ|english", "Английский"), ("итал|italian", "Итальянский"), ("испан|spanish|español", "Испанский"), ("немец|german|deutsch", "Немецкий"),
        ("франц|french|français", "Французский"), ("португал|portugu", "Португальский"), ("китай|chinese|mandarin", "Китайский"), ("япон|japanese", "Японский"),
        ("корей|korean", "Корейский"), ("араб|arabic", "Арабский"), ("турец|turkish", "Турецкий"), ("польск|polish", "Польский"), ("чешск|czech", "Чешский"),
        ("нидерланд|голланд|dutch", "Нидерландский"), ("шведск|swedish", "Шведский"), ("греческ|greek", "Греческий"), ("иврит|hebrew", "Иврит"),
        ("хинди|hindi", "Хинди"), ("украин|ukrainian", "Украинский"),
    ];

    /// <summary>Имя предмета для карточки: язык, одно слово или два коротких — вместе до 20 символов.</summary>
    public static string ShortTitle(string topic)
    {
        if (LanguageName(topic) is { } lang) return lang;
        var words = (topic ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => !StopWords.Contains(w.ToLowerInvariant())).Take(2).ToList();
        if (words.Count == 0) return TrimWords(topic, 1, 20);
        // Два слова остаются, только если вместе коротки; иначе берём значимое — самое длинное.
        var pick = words.Count == 2 && string.Join(' ', words).Length > 20 ? words.MaxBy(w => w.Length)! : string.Join(' ', words);
        return TrimWords(pick, 2, 20);
    }

    /// <summary>До maxWords слов и до maxChars символов, слова не режем; слишком длинное первое слово режется жёстко.</summary>
    public static string TrimWords(string text, int maxWords = int.MaxValue, int maxChars = 24)
    {
        var t = (text ?? "").Trim();
        var s = "";
        foreach (var w in t.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(maxWords))
        {
            var next = s.Length == 0 ? w : $"{s} {w}";
            if (next.Length > maxChars) break;
            s = next;
        }
        if (s.Length == 0) s = t.Length > maxChars ? t[..maxChars].TrimEnd() : t;
        // Хвостовой предлог или союз после обрезки («Английский для») убираем.
        var parts = s.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        while (parts.Count > 1 && StopWords.Contains(parts[^1].ToLowerInvariant())) parts.RemoveAt(parts.Count - 1);
        s = string.Join(' ', parts);
        return s.Length > 0 ? char.ToUpper(s[0]) + s[1..] : "Предмет";
    }

    private static readonly HashSet<string> StopWords =
        ["для", "и", "в", "на", "с", "со", "по", "к", "о", "об", "от", "из", "за", "перед", "при", "без", "до", "у", "как",
         "for", "and", "of", "to", "in", "on", "with", "at", "by", "from", "the", "a", "an"];

    /// <summary>Заглушка глоссария: записи об усвоенном урока как термины.</summary>
    public Task<IReadOnlyList<RefRowDto>> ExtractGlossaryAsync(Lesson lesson, CancellationToken ct)
    {
        IReadOnlyList<RefRowDto> rows = lesson.Steps.OfType<PracticeStep>().Select(p => new RefRowDto(p.RecTitle, p.RecNote)).ToList();
        return Task.FromResult(rows);
    }

    public Task<IReadOnlyList<SourceCandidate>> FindSourcesAsync(string topic, string focus, CancellationToken ct)
    {
        var f = string.IsNullOrWhiteSpace(focus) ? (string.IsNullOrWhiteSpace(topic) ? "тема" : topic) : focus;
        (string T, string M, string Trust)[] raw = TopicKind(topic) switch
        {
            "human" => [($"Академическая монография — {f}", "рецензированная, с аппаратом ссылок", "high"), ("Университетский учебник", "структурный каркас периода", "high"), ("Первоисточники: хроники, письма", "взгляд современников — с поправкой на позицию", "mid"), ("Научпоп и подкасты", "живо, но упрощает", "low")],
            "lang" => [($"Академическая грамматика — {f}", "нормативный источник", "high"), ("Корпус живой речи", "как говорят на самом деле", "high"), ("Учебные курсы уровня", "проверенные последовательности", "mid"), ("Блоги и видео носителей", "быстро, но без системы", "low")],
            "tech" => [($"Официальная документация — {f}", "первоисточник · обновляется", "high"), ("Университетский курс: введение", "структурный каркас темы", "high"), ("Разборы практиков", "живые примеры, реальные задачи", "mid"), ("Треды и подборки в соцсетях", "быстро, но шумно", "low")],
            "soft" => [($"Исследования по коммуникации — {f}", "что подтверждено экспериментами", "high"), ("Классические руководства", "проверенные десятилетиями рамки", "mid"), ("Разборы выступлений", "на реальных примерах", "mid"), ("Мотивационный контент", "вдохновляет, но не учит", "low")],
            _ => [($"Академический обзор — {f}", "систематизация темы", "high"), ("Базовый учебник", "структурный каркас", "high"), ("Практические разборы", "примеры и кейсы", "mid"), ("Подборки и треды", "быстро, но шумно", "low")],
        };
        IReadOnlyList<SourceCandidate> r = raw.Select((s, i) => new SourceCandidate($"src-{i}", s.T, s.M, s.Trust)).ToList();
        return Task.FromResult(r);
    }

    public Task<IReadOnlyList<PlanStage>> BuildPlanAsync(string topic, string focus, string mission, CancellationToken ct)
    {
        IReadOnlyList<PlanStage> r =
        [
            new("01", "Каркас: термины и карта темы", "глоссарий закладывается с первого урока"),
            new("02", "Рабочие приёмы малыми шагами", "один урок — одна победа, практика без подсказок"),
            new("03", "Применение под вашу миссию", string.IsNullOrWhiteSpace(mission) ? "уточним после первых сессий" : mission.Trim()),
        ];
        return Task.FromResult(r);
    }

    public Task<Lesson> GenerateDiagnosticAsync(SubjectDraft draft, IReadOnlyList<SourceCandidate> sources, CancellationToken ct)
    {
        var topic = draft.Title ?? draft.Topic;
        var lesson = new Lesson
        {
            Name = topic,
            Level = "старт",
            Steps =
            [
                new ExplainStep
                {
                    Why = "миссия · " + (string.IsNullOrWhiteSpace(draft.Mission) ? "уточняется" : draft.Mission),
                    Title = "Стартовая диагностика",
                    Paras =
                    [
                        "Зона ближайшего развития считается из записей, а не из самооценки. Поэтому первый урок — не теория, а замер: два коротких задания покажут границу, с которой начнём.",
                        "Ошибаться здесь полезно: каждая ошибка станет первой записью об усвоенном — памятью системы.",
                    ],
                    Example = "Ответ «не знаю» — тоже данные: такая тема попадёт в каркас первого этапа плана.",
                    Source = "Ваш план · этап 01 — каркас темы",
                },
                new ChoiceStep
                {
                    Prompt = $"Насколько уверенно вы сейчас в теме «{topic}»?",
                    Options = ["Слышал(а), но не применял(а)", "Применяю по шаблону", "Могу объяснить другому"],
                    Correct = -1,
                    Explain = "Это калибровка, а не экзамен: от ответа зависит, с какой ступени плана начнём.",
                    RecTitle = "Стартовая уверенность",
                    RecNote = "Сверим через несколько сессий — самооценка сдвигается.",
                },
                new InputStep
                {
                    Prompt = $"Что уже знаете или умеете в «{topic}»? Пишите как есть.",
                    Placeholder = "2–3 фразы свободным текстом",
                    Tokens = [],
                    Answer = "",
                    Explain = "Замер лёг в записи об усвоенном — первый полный урок построится от этой границы.",
                    Voice = "знаю базовые вещи, применял пару раз на практике, системно не учил",
                    RecTitle = "Карта того, что уже есть",
                    RecNote = "Из этого считается зона ближайшего развития.",
                },
            ],
        };
        return Task.FromResult(lesson);
    }

    /// <summary>Заглушка следующего урока: каркас темы с одной ошибкой из записей в качестве повтора.</summary>
    public Task<Lesson> GenerateNextLessonAsync(SubjectDraft draft, IReadOnlyList<SourceCandidate> sources, int number, PlanStage stage, int stageIndex, IReadOnlyList<RecapRecord> records, int durationMinutes, CancellationToken ct)
    {
        var topic = draft.Title ?? draft.Topic;
        var lastMiss = records.LastOrDefault(r => !r.Ok)?.Title ?? "первые термины";
        var src = sources.FirstOrDefault()?.T ?? "Ваш план · этап 01";
        var lesson = new Lesson
        {
            Name = topic,
            Level = $"этап {stage.N} · {draft.Focus}",
            LessonTitle = $"Урок {number} · {stage.T}",
            Steps =
            [
                new ExplainStep
                {
                    Why = "миссия · " + (string.IsNullOrWhiteSpace(draft.Mission) ? "уточняется" : draft.Mission),
                    Title = $"{topic}: карта темы",
                    Paras =
                    [
                        $"Каркас темы — три-четыре термина, через которые описывается всё остальное. Прошлый разбор показал слабое место: «{lastMiss}». Начинаем с него.",
                        "Один урок — одна победа: сегодня только карта, без деталей. Детали появятся, когда карта перестанет путаться.",
                    ],
                    Example = "Термин без места на карте забывается через день; термин с местом — держится неделями.",
                    Source = src + " · доверие высокое",
                },
                new ChoiceStep
                {
                    Prompt = $"С чего начинается каркас темы «{topic}»?",
                    Options = ["С самых частых терминов", "С самых сложных случаев", "С исторической справки"],
                    Correct = 0,
                    Explain = "Каркас строится от частого к редкому: сначала то, что встречается в каждом втором тексте.",
                    RecTitle = "Каркас — от частого к редкому",
                    RecNote = "Соблазн начать со сложного: кажется, что так быстрее. Но без частых терминов сложное не к чему привязать.",
                },
                new FreeStep
                {
                    Prompt = $"Назовите три термина, без которых нельзя говорить о «{topic}», и по одной фразе к каждому.",
                    Placeholder = "Три термина и по фразе",
                    Criteria =
                    [
                        new FreeCriterion { T = "Названы три термина", Keys = ["1", "2", "3", "три", "первый", "второй"] },
                        new FreeCriterion { T = "К каждому есть фраза-пояснение", Keys = ["это", "значит", "—", ":"] },
                    ],
                    Explain = "Термины с фразами — первая строка вашего справочника по теме.",
                    RecTitle = "Карта темы своими словами",
                    RecNote = "Формулировки своими словами точнее заученных определений: по ним видно, что понято.",
                },
            ],
        };
        return Task.FromResult(lesson);
    }

    /// <summary>Офлайн-правило клиента: критерий засчитан, если встретилось любое ключевое слово.</summary>
    public Task<bool[]> GradeFreeAsync(IReadOnlyList<Criterion> criteria, string text, string lang, CancellationToken ct)
    {
        var t = (text ?? "").ToLowerInvariant();
        return Task.FromResult(criteria.Select(c => c.Keys.Any(k => t.Contains(k.ToLowerInvariant()))).ToArray());
    }

    [GeneratedRegex("истор|history|философ|литерат|искусств")] private static partial Regex HumanRx();
    [GeneratedRegex("англ|испан|немец|франц|язык|english|spanish")] private static partial Regex LangRx();
    [GeneratedRegex("sql|python|js|qa|тест|програм|данн|devops|код")] private static partial Regex TechRx();
    [GeneratedRegex("выступ|перегов|менедж|лидер|продаж")] private static partial Regex SoftRx();
}
