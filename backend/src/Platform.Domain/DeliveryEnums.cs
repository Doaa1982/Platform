namespace Platform.Domain;

/// <summary>
/// Whether a Learner's access to a Learning Product is ongoing or done
/// (Enrollment Aggregate Design §15 — simplified here, see Enrollment.cs).
/// </summary>
public enum EnrollmentStatus { Active, Completed }

/// <summary>
/// A graded attempt's lifecycle. Collapsed from the four documented stages
/// (Assessment and Submission Aggregate Design §14: Started → Submitted →
/// Evaluated → Result Issued) into two, since grading here is always the same
/// synchronous simulated-AI method the tutor's Preview already uses — there
/// is no asynchronous gap between Submitted and Evaluated to model yet.
/// </summary>
public enum SubmissionStatus { InProgress, Graded }

/// <summary>
/// One Learner's progress through one Lesson (Learning Progress Tracking
/// Business Analysis §7 — simplified to the two states this app's one
/// concrete completion rule actually needs; see LessonProgress.cs).
/// </summary>
public enum LessonProgressStatus { NotStarted, Completed }

/// <summary>What a Notification is about (Notification.cs). One kind exists so far — as many more get added as trigger real learner-facing events.</summary>
public enum NotificationKind { LessonQuestionsUpdated }
