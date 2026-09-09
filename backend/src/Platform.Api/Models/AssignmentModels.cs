namespace Platform.Api.Models;

/// <summary>One Assignment's full configuration and lifecycle state — tutor-facing.</summary>
public record AssignmentResponse(
    Guid Id, Guid LearningActivityId, Guid LearningProductId, string Status,
    string AvailabilityMode, DateTime? ScheduledAvailabilityAt,
    string DueDateMode, DateTime? DueAt,
    DateTime? SubmissionWindowStartAt, DateTime? SubmissionWindowEndAt,
    string AttemptMode, int? MaxAttempts,
    string EvaluationMethod, bool Visible, bool NotifyOnPublish, bool NotifyOnFeedbackPublished,
    bool Configured,
    DateTime CreatedAt, DateTime UpdatedAt, DateTime? PublishedAt, DateTime? ClosedAt, DateTime? ArchivedAt,
    /// <summary>Why publication is refused right now, or null when it is allowed.</summary>
    string? PublicationBlocker);

/// <summary>AvailabilityMode/DueDateMode/AttemptMode/EvaluationMethod are the string names of Assignment's own enums (e.g. "Immediate", "Fixed", "Multiple", "Manual").</summary>
public record ConfigureAssignmentRequest(
    string AvailabilityMode, DateTime? ScheduledAvailabilityAt,
    string DueDateMode, DateTime? DueAt,
    DateTime? SubmissionWindowStartAt, DateTime? SubmissionWindowEndAt,
    string AttemptMode, int? MaxAttempts,
    string EvaluationMethod, bool NotifyOnPublish = true, bool NotifyOnFeedbackPublished = true);

public record ExtendAssignmentDueDateRequest(DateTime NewDueAt);
public record ChangeAssignmentAttemptLimitRequest(int NewMaxAttempts);
public record ChangeAssignmentVisibilityRequest(bool Visible);

/// <summary>Passed is null for a Feedback-only evaluation (no binary outcome). EvaluationMethod defaults to the Assignment's own configured policy when omitted.</summary>
public record EvaluateSubmissionRequest(bool? Passed, string? Feedback, string? EvaluationMethod = null);

/// <summary>At least one of Text or AttachedLearningAssetId is required before a response can be submitted (INV-007).</summary>
public record RecordAssignmentResponseRequest(string? Text, Guid? AttachedLearningAssetId);

/// <summary>One row in the workspace-wide tutor Assignments dashboard.</summary>
public record AssignmentOverviewRow(
    Guid AssignmentId, Guid LearningActivityId, string ActivityTitle, string ActivityType,
    Guid LessonId, string LessonTitle, Guid ProductId, string ProductTitle,
    string Status, DateTime? DueAt, int RecipientCount, int SubmittedCount);

public record AssignmentOverviewResponse(IReadOnlyList<AssignmentOverviewRow> Rows);

/// <summary>One targeted learner's submission status against one Assignment, for the tutor's grading queue — SubmissionId/Status/… are null when that learner hasn't started yet ("NotStarted").</summary>
public record AssignmentSubmissionRow(
    Guid MembershipId, string FullName, string Email,
    Guid? SubmissionId, string Status, int AttemptNumber,
    string? ResponseText, Guid? ResponseLearningAssetId, string? Feedback, bool? Passed, DateTime? EvaluatedAt, DateTime? StartedAt);

public record AssignmentSubmissionsResponse(AssignmentResponse Assignment, IReadOnlyList<AssignmentSubmissionRow> Rows);

/// <summary>One Assignment as it appears in a learner's own list — LearnerStatus is Assignment BA §11's computed student-facing status (Locked/Available/InProgress/Submitted/UnderReview/Completed/Overdue), never stored.</summary>
public record LearnerAssignmentRow(
    Guid AssignmentId, Guid LearningActivityId, string ActivityTitle, string ActivityType,
    Guid LessonId, string LessonTitle, Guid ProductId, string ProductTitle,
    DateTime? DueAt, string LearnerStatus, Guid? SubmissionId);

public record LearnerAssignmentListResponse(IReadOnlyList<LearnerAssignmentRow> Rows);

/// <summary>A Learning Activity's learner-facing content — no answer key/instructor-only fields. SubmissionMode tells the learner which of ResponseText/AttachedLearningAssetId their submission needs to include.</summary>
public record LearningActivityForLearnerResponse(
    Guid Id, string Type, string Title, string? Instructions, Guid? AssessmentId, string? ExternalUrl,
    Guid? ActivityFileAssetId, string SubmissionMode);

public record LearnerSubmissionRow(
    Guid Id, int AttemptNumber, string Status, string? ResponseText, Guid? ResponseLearningAssetId,
    DateTime StartedAt, DateTime? EvaluatedAt, bool? Passed, string? Feedback);

/// <summary>What a learner sees opening one Assignment — the policy, the activity content, and every attempt of their own so far (most recent first).</summary>
public record LearnerAssignmentDetailResponse(
    AssignmentResponse Assignment, LearningActivityForLearnerResponse Activity, IReadOnlyList<LearnerSubmissionRow> Submissions);
