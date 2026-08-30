namespace Platform.Domain;

/// <summary>Assignment's own six-state lifecycle (Assignment Aggregate Design §10), independent of both LessonRevision's authoring lifecycle and Submission's per-learner evaluation lifecycle.</summary>
public enum AssignmentStatus { Draft, Scheduled, Published, Active, Closed, Archived }

/// <summary>Assignment Business Analysis §8's Availability options.</summary>
public enum AssignmentAvailabilityMode { Immediate, Scheduled, Hidden }

/// <summary>Assignment Business Analysis §8's Due Date options. Relative is explicitly named "(Future)" there — only None/Fixed are modeled.</summary>
public enum AssignmentDueDateMode { None, Fixed }

/// <summary>Assignment Business Analysis §8's Attempts options.</summary>
public enum AssignmentAttemptMode { Single, Multiple, Unlimited }

/// <summary>
/// Assignment Business Analysis §8's Evaluation Method options. Shared by
/// both Assignment (as the configured policy) and Submission (as the method
/// actually used to evaluate one Assignment-target attempt, Assessment and
/// Submission Aggregate Design §8).
/// </summary>
public enum AssignmentEvaluationMethod { Automatic, Manual, AiAssisted, Hybrid }
