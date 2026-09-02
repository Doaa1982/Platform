namespace Platform.Domain;

/// <summary>
/// Whether a Learner's access to a Learning Product is ongoing or done
/// (Enrollment Aggregate Design §15 — simplified here, see Enrollment.cs).
/// </summary>
/// <summary>Cancelled added so WorkspaceMemberService.UnenrollMemberAsync can end an Enrollment without hard-deleting it (and the LessonProgress history keyed to it) — see Enrollment.Cancel/Reactivate.</summary>
public enum EnrollmentStatus { Active, Completed, Cancelled }

/// <summary>
/// A Submission's lifecycle. <see cref="InProgress"/>/<see cref="Graded"/>
/// are the original two states — an Assessment-target attempt is always
/// graded by the same synchronous simulated-AI method the tutor's Preview
/// already uses, so there is no asynchronous gap between Submitted and
/// Evaluated to model for that path, and these two values' meaning is
/// unchanged. <see cref="Submitted"/>/<see cref="UnderReview"/>/
/// <see cref="Evaluated"/> are additive, v1.1: an Assignment-target
/// Submission's grading is not synchronous — a real gap exists between a
/// learner submitting a Response and a tutor recording an Evaluation — so it
/// passes through the fuller four-stage shape (Assessment and Submission
/// Aggregate Design §14: Started → Submitted → Evaluated → Result Issued)
/// this enum was always describing, just now with the middle stages made
/// explicit for the path that actually needs them.
/// </summary>
public enum SubmissionStatus { InProgress, Graded, Submitted, UnderReview, Evaluated }

/// <summary>
/// One Learner's progress through one Lesson (Learning Progress Tracking
/// Business Analysis §7 — simplified to the two states this app's one
/// concrete completion rule actually needs; see LessonProgress.cs).
/// </summary>
public enum LessonProgressStatus { NotStarted, Completed }

/// <summary>What a Notification is about (Notification.cs).</summary>
public enum NotificationKind { LessonQuestionsUpdated, AssignmentPublished, AssignmentFeedbackPublished }
