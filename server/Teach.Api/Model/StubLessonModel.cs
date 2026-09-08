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
        var topic = draft.Topic;
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
