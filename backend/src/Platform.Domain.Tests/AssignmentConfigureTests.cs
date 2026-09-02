namespace Platform.Domain.Tests;

/// <summary>
/// Assignment.Configure — specifically the guard added to close the "fake
/// completeness" gap where Automatic/AiAssisted/Hybrid evaluation methods
/// were selectable in the UI and the domain model but no automatic-
/// evaluation engine existed: every submission was silently graded Manual
/// regardless of the configured method (V1 Production Readiness Report, P1).
/// </summary>
public class AssignmentConfigureTests
{
    private static Assignment NewAssignment() =>
        Assignment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

    private static void ConfigureWith(Assignment assignment, AssignmentEvaluationMethod method) =>
        assignment.Configure(
            AssignmentAvailabilityMode.Immediate, scheduledAvailabilityAt: null,
            AssignmentDueDateMode.None, dueAt: null,
            submissionWindowStartAt: null, submissionWindowEndAt: null,
            AssignmentAttemptMode.Single, maxAttempts: null,
            method, notifyOnPublish: true, notifyOnFeedbackPublished: true);

    [Fact]
    public void Configure_WithManualEvaluation_Succeeds()
    {
        var assignment = NewAssignment();

        ConfigureWith(assignment, AssignmentEvaluationMethod.Manual);

        Assert.Equal(AssignmentEvaluationMethod.Manual, assignment.EvaluationMethod);
        Assert.True(assignment.Configured);
    }

    [Theory]
    [InlineData(AssignmentEvaluationMethod.Automatic)]
    [InlineData(AssignmentEvaluationMethod.AiAssisted)]
    [InlineData(AssignmentEvaluationMethod.Hybrid)]
    public void Configure_WithAnUnimplementedEvaluationMethod_Throws(AssignmentEvaluationMethod method)
    {
        var assignment = NewAssignment();

        Assert.Throws<ArgumentException>(() => ConfigureWith(assignment, method));
    }

    [Fact]
    public void Configure_MultipleAttemptModeWithNoLimit_StillThrows_EvenWithAnUnimplementedMethod()
    {
        // Confirms the new evaluation-method guard doesn't short-circuit past
        // the pre-existing attempt-limit validation.
        var assignment = NewAssignment();

        Assert.Throws<ArgumentException>(() => assignment.Configure(
            AssignmentAvailabilityMode.Immediate, scheduledAvailabilityAt: null,
            AssignmentDueDateMode.None, dueAt: null,
            submissionWindowStartAt: null, submissionWindowEndAt: null,
            AssignmentAttemptMode.Multiple, maxAttempts: null,
            AssignmentEvaluationMethod.Manual, notifyOnPublish: true, notifyOnFeedbackPublished: true));
    }
}
