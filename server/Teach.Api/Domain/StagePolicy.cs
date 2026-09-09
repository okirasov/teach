namespace Teach.Api.Domain;

/// <summary>Итог одного урока на этапе: доля практик, решённых с первой попытки.</summary>
public sealed record LessonOutcome(int LessonNumber, int Total, int Ok)
{
    public double OkRate => Total == 0 ? 0 : (double)Ok / Total;
}

/// <summary>
/// Переход между этапами плана — по результатам, не по номеру урока (бриф §2.4: зона ближайшего развития
/// считается из записей). Этап закрыт, когда два последних урока этапа сделаны уверенно;
/// страховка от застревания — после MaxLessonsPerStage уроков этап закрывается в любом случае.
/// </summary>
public static class StagePolicy
{
    public const double LastRate = 0.75;
    public const double PreviousRate = 0.6;
    public const int MinLessons = 2;
    public const int MaxLessonsPerStage = 6;

    /// <summary>true — этап пройден, следующий урок строится на следующем этапе.</summary>
    public static bool ShouldAdvance(IReadOnlyList<LessonOutcome> lessonsInStage)
    {
        var ordered = lessonsInStage.Where(l => l.Total > 0).OrderBy(l => l.LessonNumber).ToList();
        if (ordered.Count >= MaxLessonsPerStage) return true;
        if (ordered.Count < MinLessons) return false;
        return ordered[^1].OkRate >= LastRate && ordered[^2].OkRate >= PreviousRate;
    }
}
