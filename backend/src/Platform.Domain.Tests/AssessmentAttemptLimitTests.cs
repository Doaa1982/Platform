namespace Platform.Domain.Tests;

/// <summary>
/// Assessment.AttemptLimit — Assessment and Submission Aggregate Design §8
/// lists it as an optional Scoring Configuration field that was never
/// implemented, which combined with Grade() always disclosing the correct
/// answer let a learner pass any quiz after one deliberately-wrong
/// "scouting" attempt (V1 Production Readiness Report, P1). These tests
/// cover only the domain-level validation; LearningDeliveryService's
/// AttemptLimitBlockerAsync is what actually counts prior Submissions and
/// enforces it — that requires a DbContext, out of scope for this project.
/// </summary>
public class AssessmentAttemptLimitTests
{
    private static Assessment NewAssessment() =>
        Assessment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Fractions Quiz", AssessmentKind.Standalone);

    [Fact]
    public void NewAssessment_HasNoAttemptLimit_ByDefault()
    {
        var assessment = NewAssessment();

        Assert.Null(assessment.AttemptLimit);
    }

    [Fact]
    public void SetAttemptLimit_ToAPositiveNumber_Succeeds()
    {
        var assessment = NewAssessment();

        assessment.SetAttemptLimit(3);

        Assert.Equal(3, assessment.AttemptLimit);
    }

    [Fact]
    public void SetAttemptLimit_ToNull_ClearsItBackToUnlimited()
    {
        var assessment = NewAssessment();
        assessment.SetAttemptLimit(3);

        assessment.SetAttemptLimit(null);

        Assert.Null(assessment.AttemptLimit);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void SetAttemptLimit_ToZeroOrNegative_Throws(int invalidLimit)
    {
        var assessment = NewAssessment();

        Assert.Throws<ArgumentException>(() => assessment.SetAttemptLimit(invalidLimit));
    }
}
