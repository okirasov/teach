using Teach.Api.Domain;
using Teach.Api.Model;

namespace Teach.Api.Tests;

public class LessonValidatorTests
{
    private static Lesson Diagnostic() =>
        new StubLessonModel().GenerateDiagnosticAsync(new("SQL", "Основы", "писать отчёты", []), [], CancellationToken.None).Result;

    [Fact]
    public void StubDiagnosticIsValid() => Assert.Empty(LessonValidator.Validate(Diagnostic()));

    [Fact]
    public void RejectsChoiceWithCorrectOutOfRange()
    {
        var l = Diagnostic();
        ((ChoiceStep)l.Steps[1]).Correct = 7;
        Assert.Contains(LessonValidator.Validate(l), e => e.Contains("correct out of range"));
    }

    [Fact]
    public void RejectsEmptyRecordFields()
    {
        var l = Diagnostic();
        ((ChoiceStep)l.Steps[1]).RecTitle = "";
        Assert.Contains(LessonValidator.Validate(l), e => e.Contains("recTitle is empty"));
    }

    [Fact]
    public void RejectsOrderThatIsNotAPermutation()
    {
        var l = Diagnostic();
        l.Steps.Add(new OrderStep { Prompt = "p", Explain = "e", RecTitle = "r", RecNote = "n", Items = ["a", "b", "c"], Correct = [0, 0, 2] });
        Assert.Contains(LessonValidator.Validate(l), e => e.Contains("permutation"));
    }

    [Fact]
    public void RejectsLessonOverBudget()
    {
        var l = Diagnostic();
        ((ExplainStep)l.Steps[0]).Paras.Add(new string('x', 3000));
        Assert.Contains(LessonValidator.Validate(l, 5), e => e.Contains("too long"));
        Assert.DoesNotContain(LessonValidator.Validate(l, 10), e => e.Contains("too long"));
    }

    [Fact]
    public void RejectsLessonWithoutPractice()
    {
        var l = Diagnostic();
        l.Steps.RemoveRange(1, 2);
        Assert.Contains(LessonValidator.Validate(l), e => e == "no practice step");
    }

    [Fact]
    public void SourceLineDropsHighTrustAndKeepsWarnings()
    {
        Assert.Equal("Accademia della Crusca, «Gli allocutivi di cortesia»", SourceLine.Normalize("Accademia della Crusca, «Gli allocutivi di cortesia» · доверие высокое"));
        Assert.Equal("Форум · доверие низкое", SourceLine.Normalize("Форум · доверие низкое"));
        Assert.Equal("Учебник, гл. 2", SourceLine.Normalize("Учебник, гл. 2"));
    }
}
