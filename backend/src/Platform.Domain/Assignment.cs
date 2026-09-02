namespace Platform.Domain;

/// <summary>
/// Assignment Aggregate Root (Assignment Aggregate Design v1.1).
///
/// Answers "given a Learning Activity that already exists, who gets it,
/// when, under what rules, and how is it evaluated?" — targeting,
/// scheduling, and policy, never instructional content (that belongs to
/// <see cref="LearningActivity"/>) and never a learner's evidence or grade
/// (that belongs to <see cref="Submission"/>).
///
/// A separate Aggregate Root from LearningActivity for the same reason
/// Lesson is separated from LessonRevision: different change rate (a
/// Learning Activity is authored once; an Assignment is configured,
/// scheduled, extended, and closed repeatedly) and an independent
/// lifecycle. Owns no child entities (§6 of the design document) —
/// recipients are resolved live from Enrollment (INV-004), never stored
/// here; per-learner attempt usage and status live on Submission.
/// </summary>
public class Assignment
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }

    /// <summary>INV-001/INV-002 — exactly one Learning Activity, 1:1 in V1 (enforced by a unique index at the storage layer).</summary>
    public Guid LearningActivityId { get; private set; }

    /// <summary>For Enrollment-sourced recipient resolution (INV-004) — recipients are every active Enrollment against this product, resolved live, never stored on this aggregate.</summary>
    public Guid LearningProductId { get; private set; }

    public Guid CreatorMembershipId { get; private set; }
    public AssignmentStatus Status { get; private set; }

    public AssignmentAvailabilityMode AvailabilityMode { get; private set; }
    public DateTime? ScheduledAvailabilityAt { get; private set; }
    public AssignmentDueDateMode DueDateMode { get; private set; }
    public DateTime? DueAt { get; private set; }
    public DateTime? SubmissionWindowStartAt { get; private set; }
    public DateTime? SubmissionWindowEndAt { get; private set; }
    public AssignmentAttemptMode AttemptMode { get; private set; }

    /// <summary>The effective attempt cap: 1 when AttemptMode is Single, a positive limit when Multiple, null (no cap) when Unlimited.</summary>
    public int? MaxAttempts { get; private set; }
    public AssignmentEvaluationMethod EvaluationMethod { get; private set; }
    public bool Visible { get; private set; } = true;
    public bool NotifyOnPublish { get; private set; } = true;
    public bool NotifyOnFeedbackPublished { get; private set; } = true;

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public DateTime? ArchivedAt { get; private set; }

    /// <summary>
    /// Set by Configure() — INV-003: a Draft cannot become Scheduled/Published
    /// until Availability and Evaluation Policy have been configured at
    /// least once. Must be persisted, not just an in-memory flag: every
    /// field Configure() sets also has an ordinary default value assigned at
    /// Create() (e.g. AvailabilityMode defaults to Immediate), so an
    /// unconfigured Assignment is not otherwise distinguishable from one
    /// deliberately configured to match those same defaults.
    /// </summary>
    public bool Configured { get; private set; }

    private Assignment() { }

    public static Assignment Create(Guid workspaceId, Guid learningActivityId, Guid learningProductId, Guid creatorMembershipId)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("An Assignment belongs to exactly one Workspace.", nameof(workspaceId));
        if (learningActivityId == Guid.Empty)
            throw new ArgumentException("An Assignment references exactly one Learning Activity (INV-001).", nameof(learningActivityId));
        if (learningProductId == Guid.Empty)
            throw new ArgumentException("An Assignment's recipients are resolved from a Learning Product's Enrollments (INV-004).", nameof(learningProductId));
        if (creatorMembershipId == Guid.Empty)
            throw new ArgumentException("An Assignment is created by exactly one Membership.", nameof(creatorMembershipId));

        var now = DateTime.UtcNow;
        return new Assignment
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            LearningActivityId = learningActivityId,
            LearningProductId = learningProductId,
            CreatorMembershipId = creatorMembershipId,
            Status = AssignmentStatus.Draft,
            AvailabilityMode = AssignmentAvailabilityMode.Immediate,
            DueDateMode = AssignmentDueDateMode.None,
            AttemptMode = AssignmentAttemptMode.Single,
            MaxAttempts = 1,
            EvaluationMethod = AssignmentEvaluationMethod.Manual,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    /// <summary>
    /// Sets the Assignment's delivery policy — Assignment Business Analysis
    /// §8's full configuration surface in one call, matching the BA's own
    /// "Configure Assignment" workflow step. Callable in any status except
    /// Archived (BA-009: operational fields, editable after publication,
    /// never create a new version).
    /// </summary>
    public void Configure(
        AssignmentAvailabilityMode availabilityMode, DateTime? scheduledAvailabilityAt,
        AssignmentDueDateMode dueDateMode, DateTime? dueAt,
        DateTime? submissionWindowStartAt, DateTime? submissionWindowEndAt,
        AssignmentAttemptMode attemptMode, int? maxAttempts,
        AssignmentEvaluationMethod evaluationMethod, bool notifyOnPublish, bool notifyOnFeedbackPublished)
    {
        RequireNotArchived();
        if (availabilityMode == AssignmentAvailabilityMode.Scheduled && scheduledAvailabilityAt is null)
            throw new ArgumentException("Scheduled availability needs a date.", nameof(scheduledAvailabilityAt));
        if (dueDateMode == AssignmentDueDateMode.Fixed && dueAt is null)
            throw new ArgumentException("A fixed due date mode needs a date.", nameof(dueAt));
        if (submissionWindowStartAt is { } start && submissionWindowEndAt is { } end && start > end)
            throw new ArgumentException("The submission window cannot end before it starts.", nameof(submissionWindowEndAt));
        if (attemptMode == AssignmentAttemptMode.Multiple && maxAttempts is not > 0)
            throw new ArgumentException("Multiple-attempt mode needs a positive attempt limit.", nameof(maxAttempts));
        // Automatic/AiAssisted/Hybrid are real values in the enum (Assignment
        // Business Analysis §8) but no automatic-evaluation engine exists yet
        // for an Assignment-target Submission — EvaluateSubmissionAsync only
        // ever records a human tutor's Pass/Fail regardless of this setting.
        // Letting a tutor select one of them was a configuration knob that
        // silently did nothing at runtime; rejecting it here is more honest
        // than accepting a promise this codebase can't keep.
        if (evaluationMethod != AssignmentEvaluationMethod.Manual)
            throw new ArgumentException(
                "Automatic, AI-Assisted, and Hybrid evaluation are not implemented yet — every submission requires manual evaluation for now.",
                nameof(evaluationMethod));

        AvailabilityMode = availabilityMode;
        ScheduledAvailabilityAt = availabilityMode == AssignmentAvailabilityMode.Scheduled ? scheduledAvailabilityAt : null;
        DueDateMode = dueDateMode;
        DueAt = dueDateMode == AssignmentDueDateMode.Fixed ? dueAt : null;
        SubmissionWindowStartAt = submissionWindowStartAt;
        SubmissionWindowEndAt = submissionWindowEndAt;
        AttemptMode = attemptMode;
        MaxAttempts = attemptMode switch
        {
            AssignmentAttemptMode.Single => 1,
            AssignmentAttemptMode.Multiple => maxAttempts,
            _ => null
        };
        EvaluationMethod = evaluationMethod;
        NotifyOnPublish = notifyOnPublish;
        NotifyOnFeedbackPublished = notifyOnFeedbackPublished;
        Configured = true;
        Touch();
    }

    /// <summary>Why publication is refused right now, or null when it is allowed (INV-003) — returned rather than thrown, matching Assessment.PublicationBlocker/Curriculum.PublicationBlocker.</summary>
    public string? PublicationBlocker()
    {
        if (!Configured)
            return "Configure this assignment's availability, due date, attempts, and evaluation method before publishing.";
        return null;
    }

    /// <summary>Draft → Scheduled (a future Scheduled availability date) or Draft → Published (Immediate, Hidden, or a Scheduled date that has already arrived) — Assignment BA §7's "Publish Assignment" step.</summary>
    public void Publish(DateTime now)
    {
        if (Status != AssignmentStatus.Draft)
            throw new InvalidOperationException("Only a Draft assignment can be published.");
        var blocker = PublicationBlocker();
        if (blocker is not null) throw new InvalidOperationException(blocker);

        if (AvailabilityMode == AssignmentAvailabilityMode.Scheduled && ScheduledAvailabilityAt is { } at && at > now)
        {
            Status = AssignmentStatus.Scheduled;
        }
        else
        {
            Status = AssignmentStatus.Published;
            PublishedAt = now;
            // "Hidden until release" (Assignment BA §8): published, but the
            // tutor must manually flip visibility on via ChangeVisibility
            // when ready — Hidden is a manual-release gate, not a timer.
            if (AvailabilityMode == AssignmentAvailabilityMode.Hidden)
                Visible = false;
        }
        Touch(now);
    }

    /// <summary>Assignment BA §6's "Withdraw assignment" — closing prevents new submissions (BA "Availability Rules") without invalidating history already recorded (INV-006). Callable from any pre-Archived status.</summary>
    public void Close(DateTime now)
    {
        if (Status is AssignmentStatus.Closed or AssignmentStatus.Archived)
            throw new InvalidOperationException($"This assignment is already {Status}.");
        Status = AssignmentStatus.Closed;
        ClosedAt = now;
        Touch(now);
    }

    public void Archive()
    {
        if (Status != AssignmentStatus.Closed)
            throw new InvalidOperationException("Only a closed assignment can be archived.");
        Status = AssignmentStatus.Archived;
        ArchivedAt = DateTime.UtcNow;
        Touch(ArchivedAt.Value);
    }

    /// <summary>Assignment BA-007 — a due date may only move later, never earlier.</summary>
    public void ExtendDueDate(DateTime newDueAt)
    {
        RequireNotArchived();
        if (DueDateMode != AssignmentDueDateMode.Fixed || DueAt is null)
            throw new InvalidOperationException("This assignment has no fixed due date to extend.");
        if (newDueAt <= DueAt)
            throw new ArgumentException("A due date extension must move the due date later, never earlier (Assignment BA-007).", nameof(newDueAt));
        DueAt = newDueAt;
        Touch();
    }

    /// <summary>
    /// INV-006 — the limit may be raised freely but never lowered below the
    /// most attempts any one learner has already used.
    /// <paramref name="maxAttemptsUsedByAnyLearner"/> is a cross-aggregate
    /// fact the caller (AssignmentService) must supply from Submission —
    /// this aggregate has no visibility into Submission state itself.
    /// </summary>
    public void ChangeAttemptLimit(int newMaxAttempts, int maxAttemptsUsedByAnyLearner)
    {
        RequireNotArchived();
        if (AttemptMode == AssignmentAttemptMode.Unlimited)
            throw new InvalidOperationException("This assignment allows unlimited attempts — there is no limit to change.");
        if (newMaxAttempts <= 0)
            throw new ArgumentException("An attempt limit must be positive.", nameof(newMaxAttempts));
        if (newMaxAttempts < maxAttemptsUsedByAnyLearner)
            throw new InvalidOperationException(
                $"Cannot lower the attempt limit below {maxAttemptsUsedByAnyLearner}, the most attempts a learner has already used (Assignment BA-011).");

        MaxAttempts = newMaxAttempts;
        AttemptMode = AssignmentAttemptMode.Multiple;
        Touch();
    }

    public void ChangeVisibility(bool visible)
    {
        RequireNotArchived();
        Visible = visible;
        Touch();
    }

    public void UpdateNotificationSettings(bool notifyOnPublish, bool notifyOnFeedbackPublished)
    {
        RequireNotArchived();
        NotifyOnPublish = notifyOnPublish;
        NotifyOnFeedbackPublished = notifyOnFeedbackPublished;
        Touch();
    }

    /// <summary>
    /// Advances the date-driven edges of the state machine (§10 of the
    /// design document) without a background scheduler — the same lazy
    /// "promoted the moment anyone looks" pattern already used elsewhere in
    /// this codebase (e.g. Invitation expiry). Called by AssignmentService
    /// at the top of every read/mutate path. Loops so a single call can
    /// roll through more than one edge at once (e.g. a Scheduled assignment
    /// whose submission window already opened by the time anyone looks
    /// jumps straight to Active). Returns true if Status changed.
    /// </summary>
    public bool PromoteIfDue(DateTime now)
    {
        var before = Status;
        bool advanced;
        do
        {
            advanced = false;
            switch (Status)
            {
                case AssignmentStatus.Scheduled when ScheduledAvailabilityAt is { } at && now >= at:
                    Status = AssignmentStatus.Published;
                    PublishedAt = now;
                    advanced = true;
                    break;

                case AssignmentStatus.Published when SubmissionWindowStartAt is null || now >= SubmissionWindowStartAt:
                    Status = AssignmentStatus.Active;
                    advanced = true;
                    break;

                case AssignmentStatus.Active when (SubmissionWindowEndAt ?? DueAt) is { } deadline && now >= deadline:
                    Status = AssignmentStatus.Closed;
                    ClosedAt = now;
                    advanced = true;
                    break;
            }
        } while (advanced);

        if (Status == before) return false;
        Touch(now);
        return true;
    }

    private void RequireNotArchived()
    {
        if (Status == AssignmentStatus.Archived)
            throw new InvalidOperationException("An archived assignment can no longer be edited.");
    }

    private void Touch(DateTime? now = null) => UpdatedAt = now ?? DateTime.UtcNow;
}
