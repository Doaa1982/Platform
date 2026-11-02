namespace Platform.Domain;

public enum ParentReportKind { Confirmation, AssignmentResult, QuizResult, MonthlySummary }

/// <summary>
/// One message sent (or attempted) to one parent contact — the record that keeps the same report
/// from going out twice (a successful row for the same contact, kind and <see cref="SubjectKey"/>
/// means "already sent"), and later the count the WhatsApp add-on's limits will read.
/// </summary>
public class ParentReportDelivery
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid ParentContactId { get; private set; }
    public Guid LearnerMembershipId { get; private set; }
    public ParentReportKind Kind { get; private set; }

    /// <summary>
    /// What the message was about: the submission id for a result, "2026-10" for a monthly
    /// summary, the link version for a confirmation.
    /// </summary>
    public string SubjectKey { get; private set; } = string.Empty;

    /// <summary>"email" in V1; "whatsapp" later.</summary>
    public string Channel { get; private set; } = "email";
    public bool Succeeded { get; private set; }
    public string? Error { get; private set; }
    public DateTime SentAt { get; private set; }

    // Required by EF Core — not for application use
    private ParentReportDelivery() { }

    public static ParentReportDelivery Record(
        ParentContact contact, ParentReportKind kind, string subjectKey, bool succeeded, string? error, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        WorkspaceId = contact.WorkspaceId,
        ParentContactId = contact.Id,
        LearnerMembershipId = contact.LearnerMembershipId,
        Kind = kind,
        SubjectKey = subjectKey,
        Channel = "email",
        Succeeded = succeeded,
        Error = error is null ? null : (error.Length > 500 ? error[..500] : error),
        SentAt = now,
    };
}
