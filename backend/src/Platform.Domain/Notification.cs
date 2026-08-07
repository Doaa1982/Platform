namespace Platform.Domain;

/// <summary>
/// A learner-facing heads-up about something that changed under content they
/// have already engaged with. Lesson Editing &amp; Publication UX, Scenario 4:
/// editing Interactive Questions on a Published lesson is a safe in-place
/// update — no new Lesson Version, no republish — but a learner who already
/// has a LessonProgress row for that lesson (i.e. has opened it at least
/// once, whether or not they've completed it) still deserves to know the
/// questions changed.
///
/// Deliberately minimal: a persisted, per-recipient message a learner can
/// read and dismiss. No delivery channel beyond in-app (no email, no push,
/// no Notification/Communication bounded context) — that is future
/// evolution, not needed for the single notice this stands in for today.
/// </summary>
public class Notification
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid MembershipId { get; private set; }
    public NotificationKind Kind { get; private set; }
    public Guid LessonId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
    public DateTime? ReadAt { get; private set; }

    private Notification() { }

    public static Notification Create(
        Guid workspaceId, Guid membershipId, NotificationKind kind, Guid lessonId, string title, string message)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Notification belongs to exactly one Workspace.", nameof(workspaceId));
        if (membershipId == Guid.Empty)
            throw new ArgumentException("A Notification belongs to exactly one recipient Membership.", nameof(membershipId));
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(message);

        return new Notification
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            MembershipId = membershipId,
            Kind = kind,
            LessonId = lessonId,
            Title = title.Trim(),
            Message = message.Trim(),
            CreatedAt = DateTime.UtcNow
        };
    }

    public void MarkRead() => ReadAt ??= DateTime.UtcNow;
}
