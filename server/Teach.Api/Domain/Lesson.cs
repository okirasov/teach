using System.Text.Json.Serialization;

namespace Teach.Api.Domain;

/// <summary>Модель урока — зеркало mobile/src/domain/types.ts. Сериализуется camelCase с дискриминатором type.</summary>
public sealed class Lesson
{
    public required string Name { get; set; }
    public required string Level { get; set; }
    public string? LessonTitle { get; set; }
    public required List<LessonStep> Steps { get; set; }
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(ExplainStep), "explain")]
[JsonDerivedType(typeof(ChoiceStep), "choice")]
[JsonDerivedType(typeof(InputStep), "input")]
[JsonDerivedType(typeof(OrderStep), "order")]
[JsonDerivedType(typeof(FreeStep), "free")]
public abstract class LessonStep;

public sealed class ExplainStep : LessonStep
{
    public required string Why { get; set; }
    public required string Title { get; set; }
    public required List<string> Paras { get; set; }
    public required string Example { get; set; }
    public required string Source { get; set; }
}

public abstract class PracticeStep : LessonStep
{
    public required string Prompt { get; set; }
    public required string Explain { get; set; }
    public required string RecTitle { get; set; }
    public required string RecNote { get; set; }
    public string? Voice { get; set; }
}

public sealed class ChoiceStep : PracticeStep
{
    public required List<string> Options { get; set; }
    /// <summary>-1 — калибровка без правильного ответа.</summary>
    public required int Correct { get; set; }
}

public sealed class InputStep : PracticeStep
{
    public required string Placeholder { get; set; }
    /// <summary>Группы синонимов; пусто — принимается любой текст.</summary>
    public required List<List<string>> Tokens { get; set; }
    public required string Answer { get; set; }
}

public sealed class OrderStep : PracticeStep
{
    public required List<string> Items { get; set; }
    public required List<int> Correct { get; set; }
}

public sealed class FreeCriterion
{
    public required string T { get; set; }
    public required List<string> Keys { get; set; }
}

public sealed class FreeStep : PracticeStep
{
    public required string Placeholder { get; set; }
    public required List<FreeCriterion> Criteria { get; set; }
}
