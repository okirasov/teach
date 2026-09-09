using Teach.Api.Contracts;
using Teach.Api.Domain;

namespace Teach.Api.Model;

/// <summary>
/// Провайдер модели — заменяем (бриф §5.1). Реализации: Claude через Anthropic SDK и заглушка прототипа.
/// Сроки повторов модель не считает никогда — это FSRS на клиенте.
/// </summary>
public interface ILessonModel
{
    string Name { get; }
    Task<IReadOnlyList<FocusOption>> SuggestFocusAsync(string topic, CancellationToken ct);
    /// <summary>Короткое имя предмета (≤ 24 символов) из формулировки темы.</summary>
    Task<string> SuggestTitleAsync(string topic, CancellationToken ct);
    /// <summary>Термины урока для глоссария: термин → определение в одну строку.</summary>
    Task<IReadOnlyList<RefRowDto>> ExtractGlossaryAsync(Lesson lesson, CancellationToken ct);
    Task<IReadOnlyList<SourceCandidate>> FindSourcesAsync(string topic, string focus, CancellationToken ct);
    Task<IReadOnlyList<PlanStage>> BuildPlanAsync(string topic, string focus, string mission, CancellationToken ct);
    /// <summary>Первый урок — стартовая диагностика: калибровка без правильного ответа + свободный рассказ.</summary>
    Task<Lesson> GenerateDiagnosticAsync(SubjectDraft draft, IReadOnlyList<SourceCandidate> sources, CancellationToken ct);
    /// <summary>Урок N по плану и записям об усвоенном: чуть выше границы, что показали ошибки.</summary>
    Task<Lesson> GenerateNextLessonAsync(SubjectDraft draft, IReadOnlyList<SourceCandidate> sources, int number, IReadOnlyList<RecapRecord> records, CancellationToken ct);
    Task<bool[]> GradeFreeAsync(IReadOnlyList<Criterion> criteria, string text, string lang, CancellationToken ct);
}
