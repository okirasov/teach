using Teach.Api.Domain;

namespace Teach.Api.Tests;

public class StagePolicyTests
{
    private static LessonOutcome L(int n, int ok, int total) => new(n, total, ok);

    [Fact]
    public void NeedsTwoLessonsInTheStage() => Assert.False(StagePolicy.ShouldAdvance([L(2, 3, 3)]));

    [Fact]
    public void AdvancesWhenTheLastTwoLessonsAreConfident() =>
        Assert.True(StagePolicy.ShouldAdvance([L(2, 2, 3), L(3, 3, 3)]));

    [Fact]
    public void StaysWhenTheLastLessonWasWeak() =>
        Assert.False(StagePolicy.ShouldAdvance([L(2, 3, 3), L(3, 1, 3)]));

    [Fact]
    public void StaysWhenThePreviousLessonWasWeakEvenIfTheLastIsPerfect() =>
        Assert.False(StagePolicy.ShouldAdvance([L(2, 1, 3), L(3, 3, 3)]));

    [Fact]
    public void ClosesTheStageAfterTheCapRegardlessOfResults() =>
        Assert.True(StagePolicy.ShouldAdvance(Enumerable.Range(2, 6).Select(n => L(n, 0, 3)).ToList()));

    [Fact]
    public void IgnoresLessonsWithoutPractice() => Assert.False(StagePolicy.ShouldAdvance([L(2, 0, 0), L(3, 3, 3)]));
}
