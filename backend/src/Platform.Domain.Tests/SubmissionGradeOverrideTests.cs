namespace Platform.Domain.Tests;

/// <summary>
/// Submission.OverrideGrade — there was previously no way for a tutor to
/// correct an already-graded Assessment-target Submission short of telling
/// the learner to retake the whole quiz (V1 Production Readiness Report,
/// P2). EffectivePassed/EffectiveScorePercent are what every display/stats
/// consumer should read; ScorePercent/Passed/GradedAt (the original
/// automatic grade) must stay exactly what Grade() produced.
/// </summary>
public class SubmissionGradeOverrideTests
{
    private static (Assessment Assessment, Submission Submission) NewGradedSubmission(bool answerCorrectly)
    {
        var assessment = Assessment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Fractions Quiz", AssessmentKind.Standalone);
        var question = assessment.AddQuestion(
            QuestionType.MultipleChoice, "1/2 + 1/2 = ?",
            options: ["0", "1", "2", "3"], correctOptionIndex: 1, acceptedAnswers: null,
            explanation: null, videoTimestampSeconds: null, points: 1, assessedObjective: null);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        submission.Grade(assessment, new Dictionary<Guid, SubmittedAnswer>
        {
            [question.Id] = new SubmittedAnswer(answerCorrectly ? 1 : 0, null),
        });
        return (assessment, submission);
    }

    [Fact]
    public void BeforeAnyOverride_EffectiveValues_EqualTheOriginalAutomaticGrade()
    {
        var (_, submission) = NewGradedSubmission(answerCorrectly: false);

        Assert.Equal(submission.Passed, submission.EffectivePassed);
        Assert.Equal(submission.ScorePercent, submission.EffectiveScorePercent);
    }

    [Fact]
    public void OverrideGrade_SetsEffectiveValues_ButLeavesTheOriginalAutomaticGradeUntouched()
    {
        var (_, submission) = NewGradedSubmission(answerCorrectly: false);
        var originalScore = submission.ScorePercent;
        var originalPassed = submission.Passed;
        var originalGradedAt = submission.GradedAt;
        var tutorMembershipId = Guid.NewGuid();

        submission.OverrideGrade(tutorMembershipId, passed: true, scorePercent: 100, note: "Accepted a valid synonym.");

        // The historical record of what the auto-grader actually decided must not change.
        Assert.Equal(originalScore, submission.ScorePercent);
        Assert.Equal(originalPassed, submission.Passed);
        Assert.Equal(originalGradedAt, submission.GradedAt);

        // But the effective outcome — what a gradebook/stats consumer should read — does.
        Assert.True(submission.EffectivePassed);
        Assert.Equal(100, submission.EffectiveScorePercent);
        Assert.Equal(tutorMembershipId, submission.OverriddenByMembershipId);
        Assert.Equal("Accepted a valid synonym.", submission.OverrideNote);
        Assert.NotNull(submission.OverriddenAt);
    }

    [Fact]
    public void OverrideGrade_OnAnInProgressSubmission_Throws()
    {
        var submission = Submission.Start(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        Assert.Throws<InvalidOperationException>(() => submission.OverrideGrade(Guid.NewGuid(), true, 100, null));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(101)]
    public void OverrideGrade_WithAnOutOfRangeScore_Throws(int invalidScore)
    {
        var (_, submission) = NewGradedSubmission(answerCorrectly: true);

        Assert.Throws<ArgumentException>(() => submission.OverrideGrade(Guid.NewGuid(), true, invalidScore, null));
    }

    [Fact]
    public void OverrideGrade_CanBeRevised_UnlikeTheOriginalGradesImmutabilityRule()
    {
        var (_, submission) = NewGradedSubmission(answerCorrectly: false);
        submission.OverrideGrade(Guid.NewGuid(), passed: true, scorePercent: 90, note: "First look.");

        // Deliberately not INV-005-protected — an explicit human judgment call
        // a tutor should be able to revise, unlike the one-shot automatic grade.
        submission.OverrideGrade(Guid.NewGuid(), passed: false, scorePercent: 40, note: "Reconsidered after a second look.");

        Assert.False(submission.EffectivePassed);
        Assert.Equal(40, submission.EffectiveScorePercent);
        Assert.Equal("Reconsidered after a second look.", submission.OverrideNote);
    }
}
