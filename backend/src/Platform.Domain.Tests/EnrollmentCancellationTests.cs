namespace Platform.Domain.Tests;

/// <summary>
/// Enrollment.Cancel/Reactivate — WorkspaceMemberService.UnenrollMemberAsync
/// used to hard-delete the Enrollment row and every LessonProgress row keyed
/// to it, permanently destroying a learner's completion history for one
/// tutor click (V1 Production Readiness Report, P1). Cancel ends access
/// without deleting the row; Reactivate is how a later re-enrollment (or a
/// revisit to an Open-mode product) picks the same row back up instead of
/// violating the (LearningProductId, MembershipId) unique index with a
/// second row.
/// </summary>
public class EnrollmentCancellationTests
{
    private static Enrollment NewActiveEnrollment() =>
        Enrollment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

    [Fact]
    public void NewEnrollment_StartsActive()
    {
        var enrollment = NewActiveEnrollment();

        Assert.Equal(EnrollmentStatus.Active, enrollment.Status);
    }

    [Fact]
    public void Cancel_MovesToCancelled_WithoutDeletingTheRow()
    {
        var enrollment = NewActiveEnrollment();

        enrollment.Cancel();

        Assert.Equal(EnrollmentStatus.Cancelled, enrollment.Status);
    }

    [Fact]
    public void Reactivate_FromCancelled_ReturnsToActive()
    {
        var enrollment = NewActiveEnrollment();
        enrollment.Cancel();

        enrollment.Reactivate();

        Assert.Equal(EnrollmentStatus.Active, enrollment.Status);
    }

    [Fact]
    public void Reactivate_WhenNotCancelled_Throws()
    {
        var enrollment = NewActiveEnrollment();

        Assert.Throws<InvalidOperationException>(enrollment.Reactivate);
    }
}
