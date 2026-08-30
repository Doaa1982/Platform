using Platform.Domain;

namespace Platform.Domain.Tests;

/// <summary>
/// Competency-Based Learning — Design Proposal §3-4: Assessment.Grade()'s
/// per-AssessedObjective competency breakdown, and the backward-compatibility
/// guarantee an untagged Question / an all-untagged Submission gets exactly
/// today's behavior (empty CompetencyLevels, unaffected score).
/// </summary>
public class AssessmentCompetencyGradeTests
{
    private static Assessment NewStandaloneAssessment() =>
        Assessment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Fractions Quiz", AssessmentKind.Standalone);

    private static Question AddMultipleChoice(Assessment assessment, string? assessedObjective, bool answerCorrectly, out SubmittedAnswer answer)
    {
        var question = assessment.AddQuestion(
            QuestionType.MultipleChoice, "1/2 + 1/2 = ?",
            options: ["0", "1", "2", "3"], correctOptionIndex: 1, acceptedAnswers: null,
            explanation: null, videoTimestampSeconds: null, points: 1, assessedObjective: assessedObjective);
        answer = new SubmittedAnswer(answerCorrectly ? 1 : 0, null);
        return question;
    }

    [Fact]
    public void UntaggedQuestion_DoesNotAppearInCompetencyBreakdown()
    {
        var assessment = NewStandaloneAssessment();
        var q = AddMultipleChoice(assessment, assessedObjective: null, answerCorrectly: true, out var answer);

        var (_, _, _, competencyLevels) = assessment.Grade(new Dictionary<Guid, SubmittedAnswer> { [q.Id] = answer });

        Assert.Empty(competencyLevels);
    }

    [Fact]
    public void SubmissionWithNoTaggedQuestions_ProducesEmptyCompetencyLevels_AndUnaffectedScore()
    {
        var assessment = NewStandaloneAssessment();
        var q1 = AddMultipleChoice(assessment, assessedObjective: null, answerCorrectly: true, out var a1);
        var q2 = AddMultipleChoice(assessment, assessedObjective: null, answerCorrectly: false, out var a2);

        var (scorePercent, passed, perQuestion, competencyLevels) = assessment.Grade(
            new Dictionary<Guid, SubmittedAnswer> { [q1.Id] = a1, [q2.Id] = a2 });

        Assert.Empty(competencyLevels);
        Assert.Equal(50, scorePercent);
        Assert.False(passed); // default PassingThresholdPercent is 70
        Assert.Equal(2, perQuestion.Count);
    }

    [Fact]
    public void TaggedQuestion_AtExactly80Percent_IsMastered()
    {
        var assessment = NewStandaloneAssessment();
        const string objective = "Add fractions with like denominators";
        var answers = new Dictionary<Guid, SubmittedAnswer>();

        // 4 of 5 correct = 80% exactly.
        for (var i = 0; i < 5; i++)
        {
            var q = AddMultipleChoice(assessment, objective, answerCorrectly: i < 4, out var answer);
            answers[q.Id] = answer;
        }

        var (_, _, _, competencyLevels) = assessment.Grade(answers);

        var result = Assert.Single(competencyLevels);
        Assert.Equal(objective, result.Objective);
        Assert.Equal(CompetencyLevel.Mastered, result.Level);
    }

    [Fact]
    public void TaggedQuestion_JustBelow80Percent_IsDeveloping_Not_Mastered()
    {
        var assessment = NewStandaloneAssessment();
        const string objective = "Add fractions with like denominators";
        var answers = new Dictionary<Guid, SubmittedAnswer>();

        // 3 of 4 correct = 75% — below the 80% Mastered threshold.
        for (var i = 0; i < 4; i++)
        {
            var q = AddMultipleChoice(assessment, objective, answerCorrectly: i < 3, out var answer);
            answers[q.Id] = answer;
        }

        var (_, _, _, competencyLevels) = assessment.Grade(answers);

        var result = Assert.Single(competencyLevels);
        Assert.Equal(CompetencyLevel.Developing, result.Level);
    }

    [Fact]
    public void TaggedQuestion_AtExactly50Percent_IsDeveloping()
    {
        var assessment = NewStandaloneAssessment();
        const string objective = "Add fractions with like denominators";
        var answers = new Dictionary<Guid, SubmittedAnswer>();

        // 1 of 2 correct = 50% exactly.
        for (var i = 0; i < 2; i++)
        {
            var q = AddMultipleChoice(assessment, objective, answerCorrectly: i < 1, out var answer);
            answers[q.Id] = answer;
        }

        var (_, _, _, competencyLevels) = assessment.Grade(answers);

        var result = Assert.Single(competencyLevels);
        Assert.Equal(CompetencyLevel.Developing, result.Level);
    }

    [Fact]
    public void TaggedQuestion_JustBelow50Percent_IsNotYet()
    {
        var assessment = NewStandaloneAssessment();
        const string objective = "Add fractions with like denominators";
        var answers = new Dictionary<Guid, SubmittedAnswer>();

        // 2 of 5 correct = 40% — below the 50% Developing threshold.
        for (var i = 0; i < 5; i++)
        {
            var q = AddMultipleChoice(assessment, objective, answerCorrectly: i < 2, out var answer);
            answers[q.Id] = answer;
        }

        var (_, _, _, competencyLevels) = assessment.Grade(answers);

        var result = Assert.Single(competencyLevels);
        Assert.Equal(CompetencyLevel.NotYet, result.Level);
    }

    [Fact]
    public void MultipleObjectives_EachGetsItsOwnIndependentLevel()
    {
        var assessment = NewStandaloneAssessment();
        var q1 = AddMultipleChoice(assessment, "Objective A", answerCorrectly: true, out var a1);
        var q2 = AddMultipleChoice(assessment, "Objective B", answerCorrectly: false, out var a2);
        var q3 = AddMultipleChoice(assessment, null, answerCorrectly: true, out var a3); // untagged — must not leak into either bucket

        var (_, _, _, competencyLevels) = assessment.Grade(new Dictionary<Guid, SubmittedAnswer>
        {
            [q1.Id] = a1, [q2.Id] = a2, [q3.Id] = a3
        });

        Assert.Equal(2, competencyLevels.Count);
        Assert.Equal(CompetencyLevel.Mastered, competencyLevels.Single(c => c.Objective == "Objective A").Level);
        Assert.Equal(CompetencyLevel.NotYet, competencyLevels.Single(c => c.Objective == "Objective B").Level);
    }

    [Fact]
    public void OpenAnswerQuestion_TaggedWithObjective_IsExcludedFromBreakdown()
    {
        var assessment = NewStandaloneAssessment();
        var q = assessment.AddQuestion(
            QuestionType.OpenAnswer, "Explain why 1/2 + 1/2 = 1.",
            options: null, correctOptionIndex: null, acceptedAnswers: null,
            explanation: null, videoTimestampSeconds: null, points: 1, assessedObjective: "Explain fraction addition");

        var (_, _, _, competencyLevels) = assessment.Grade(
            new Dictionary<Guid, SubmittedAnswer> { [q.Id] = new SubmittedAnswer(null, "because halves make a whole") });

        // OpenAnswer is never auto-graded (Correct is null), so it can't
        // contribute a correct/incorrect signal to any objective's tally.
        Assert.Empty(competencyLevels);
    }

    [Fact]
    public void Submission_Grade_PersistsCompetencyLevels_AsChildCollection()
    {
        var assessment = NewStandaloneAssessment();
        const string objective = "Add fractions with like denominators";
        var q1 = AddMultipleChoice(assessment, objective, answerCorrectly: true, out var a1);
        var q2 = AddMultipleChoice(assessment, objective, answerCorrectly: true, out var a2);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        submission.Grade(assessment, new Dictionary<Guid, SubmittedAnswer> { [q1.Id] = a1, [q2.Id] = a2 });

        var persisted = Assert.Single(submission.CompetencyLevels);
        Assert.Equal(objective, persisted.Objective);
        Assert.Equal(CompetencyLevel.Mastered, persisted.Level);
    }

    [Fact]
    public void Submission_Grade_WithNoTaggedQuestions_LeavesCompetencyLevelsEmpty()
    {
        var assessment = NewStandaloneAssessment();
        var q = AddMultipleChoice(assessment, assessedObjective: null, answerCorrectly: true, out var answer);

        var submission = Submission.Start(assessment.Id, Guid.NewGuid(), Guid.NewGuid());
        submission.Grade(assessment, new Dictionary<Guid, SubmittedAnswer> { [q.Id] = answer });

        Assert.Empty(submission.CompetencyLevels);
    }
}
