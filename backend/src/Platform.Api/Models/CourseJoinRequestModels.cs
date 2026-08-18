namespace Platform.Api.Models;

/// <summary>Submitting a request for a specific ApprovalRequired course. The requester is already an authenticated Member.</summary>
public record SubmitCourseJoinRequest(string? Message);

/// <summary>One row of the reviewer's course-request queue.</summary>
public record CourseJoinRequestRow(
    Guid Id,
    Guid LearningProductId,
    string ProductTitle,
    Guid MembershipId,
    string MemberFullName,
    string MemberEmail,
    string? Message,
    string Status,
    DateTime SubmittedAt,
    DateTime? DecidedAt);
