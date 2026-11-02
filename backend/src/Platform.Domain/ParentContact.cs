using System.Net.Mail;

namespace Platform.Domain;

public enum ParentContactStatus
{
    /// <summary>Added; the welcome email asks the parent to confirm. Nothing else is sent yet.</summary>
    PendingConfirmation,
    /// <summary>The parent said yes — reports may go out (when the academy has them switched on).</summary>
    Confirmed,
    /// <summary>The parent unsubscribed. Nothing is sent until the tutor re-invites and the parent confirms again.</summary>
    Unsubscribed,
    /// <summary>Removed by the tutor or the learner. Terminal; a new contact is a new record.</summary>
    Removed,
}

/// <summary>Who added a parent contact — kept for support questions ("who put this email here?").</summary>
public enum ParentContactSource { Tutor, Learner, Invitation, Import }

/// <summary>
/// Parent Contact Aggregate Root (Parent Progress Reports Business Analysis §5).
///
/// A parent is not a user: no Identity, no Membership, no login. A Parent Contact is a name and an
/// email attached to ONE learner (a Membership) in ONE Workspace, who may receive progress reports
/// about that learner by email once they have confirmed they want them. (WorkspaceRoleName.Parent
/// is reserved for a future parent login and is not used here.)
///
/// Rules enforced here:
///   PR-INV-001 — consent first: only a Confirmed contact can receive reports (<see cref="CanReceiveReports"/>).
///   PR-INV-002 — a confirmation link works only for the current invitation round
///                (<see cref="LinkVersion"/>) and only within <see cref="ConfirmationWindow"/>.
///   PR-INV-003 — after unsubscribing, only a tutor re-invite (and a new confirmation) restarts reports.
///   PR-INV-004 — Removed is terminal.
///
/// Enforced outside this class (they span rows): at most <see cref="MaxPerLearner"/> non-removed
/// contacts per learner, and no two of them with the same email (ParentContactService).
/// </summary>
public class ParentContact
{
    public const int MaxPerLearner = 2;
    public static readonly TimeSpan ConfirmationWindow = TimeSpan.FromDays(14);

    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }

    /// <summary>The learner this parent receives reports about — a Membership, by identifier only.</summary>
    public Guid LearnerMembershipId { get; private set; }

    public string Name { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;

    /// <summary>"ar" or "en" — the language of every email this parent gets. Arabic by default.</summary>
    public string Language { get; private set; } = SupportedLanguage.Arabic;

    /// <summary>Stored for the future WhatsApp add-on; nothing is sent to it in V1.</summary>
    public string? WhatsAppPhone { get; private set; }

    public ParentContactStatus Status { get; private set; }
    public ParentContactSource Source { get; private set; }

    /// <summary>
    /// Bumped every time a new confirmation round starts (re-invite, resend, email change). A
    /// confirmation link carries the version it was issued for, so an older link stops working.
    /// </summary>
    public int LinkVersion { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime ConfirmationExpiresAt { get; private set; }
    public DateTime? ConfirmedAt { get; private set; }
    public DateTime? UnsubscribedAt { get; private set; }
    public DateTime? RemovedAt { get; private set; }

    // Required by EF Core — not for application use
    private ParentContact() { }

    public static ParentContact Create(
        Guid workspaceId, Guid learnerMembershipId, string name, string email, string? language, string? whatsAppPhone,
        ParentContactSource source, DateTime now)
    {
        if (workspaceId == Guid.Empty) throw new ArgumentException("A parent contact belongs to one Workspace.", nameof(workspaceId));
        if (learnerMembershipId == Guid.Empty) throw new ArgumentException("A parent contact belongs to one learner.", nameof(learnerMembershipId));

        var contact = new ParentContact
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            LearnerMembershipId = learnerMembershipId,
            Source = source,
            CreatedAt = now,
        };
        contact.SetDetails(name, email, language, whatsAppPhone);
        contact.StartConfirmationRound(now);
        return contact;
    }

    /// <summary>Only a confirmed parent receives reports (PR-INV-001).</summary>
    public bool CanReceiveReports => Status == ParentContactStatus.Confirmed;

    public bool IsActive => Status != ParentContactStatus.Removed;

    /// <summary>Waiting for the parent, but the 14 days to confirm are over — nothing goes out.</summary>
    public bool ConfirmationLapsed(DateTime now) =>
        Status == ParentContactStatus.PendingConfirmation && ConfirmationExpiresAt <= now;

    /// <summary>
    /// Edits the contact. A changed email is a different person's inbox, so consent starts over:
    /// back to waiting, with a new confirmation round. Returns whether a confirmation email is due.
    /// </summary>
    public bool Update(string name, string email, string? language, string? whatsAppPhone, DateTime now)
    {
        RequireNotRemoved();
        var emailChanged = !string.Equals(NormalizeEmail(email), Email, StringComparison.Ordinal);
        SetDetails(name, email, language, whatsAppPhone);
        UpdatedAt = now;
        if (!emailChanged) return false;
        StartConfirmationRound(now);
        return true;
    }

    /// <summary>
    /// The parent clicked "Yes, send me updates" (PR-INV-002). Idempotent for an already
    /// confirmed contact on the same round; refuses an old round's link, a lapsed one, and a
    /// contact that unsubscribed or was removed since.
    /// </summary>
    public void Confirm(int linkVersion, DateTime now)
    {
        if (linkVersion != LinkVersion)
            throw new InvalidOperationException("This confirmation link has been replaced by a newer one.");
        if (Status == ParentContactStatus.Confirmed) return;
        if (Status != ParentContactStatus.PendingConfirmation)
            throw new InvalidOperationException("This confirmation link is no longer valid.");
        if (ConfirmationExpiresAt <= now)
            throw new InvalidOperationException("This confirmation link has expired. Ask the academy to send a new one.");

        Status = ParentContactStatus.Confirmed;
        ConfirmedAt = now;
        UpdatedAt = now;
    }

    /// <summary>One-click unsubscribe. Idempotent; a removed contact simply stays removed.</summary>
    public void Unsubscribe(DateTime now)
    {
        if (Status is ParentContactStatus.Unsubscribed or ParentContactStatus.Removed) return;
        Status = ParentContactStatus.Unsubscribed;
        UnsubscribedAt = now;
        UpdatedAt = now;
    }

    /// <summary>
    /// The tutor sends the confirmation again: after an unsubscribe (PR-INV-003), or when the
    /// parent never confirmed. A confirmed contact needs no new round.
    /// </summary>
    public void Reinvite(DateTime now)
    {
        RequireNotRemoved();
        if (Status == ParentContactStatus.Confirmed)
            throw new InvalidOperationException("This parent has already confirmed.");
        StartConfirmationRound(now);
    }

    public void Remove(DateTime now)
    {
        if (Status == ParentContactStatus.Removed) return;
        Status = ParentContactStatus.Removed;
        RemovedAt = now;
        UpdatedAt = now;
    }

    public static string NormalizeEmail(string email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    /// <summary>A plausible single address — the same bar the invite form uses, plus MailAddress's own parse.</summary>
    public static bool IsValidEmail(string? email)
    {
        var e = NormalizeEmail(email ?? string.Empty);
        if (e.Length is 0 or > 256 || e.Contains(' ') || e.Count(c => c == '@') != 1) return false;
        var at = e.IndexOf('@');
        if (at == 0 || !e[(at + 1)..].Contains('.') || e.EndsWith('.')) return false;
        return MailAddress.TryCreate(e, out _);
    }

    /// <summary>Digits with an optional leading +; spaces, dashes and brackets are dropped.</summary>
    public static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var trimmed = phone.Trim();
        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (digits.Length is < 7 or > 15)
            throw new ArgumentException("A WhatsApp number needs 7 to 15 digits.", nameof(phone));
        return trimmed.StartsWith('+') ? "+" + digits : digits;
    }

    private void SetDetails(string name, string email, string? language, string? whatsAppPhone)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("A parent needs a name.", nameof(name));
        if (name.Trim().Length > 120) throw new ArgumentException("A parent's name can be at most 120 characters.", nameof(name));
        if (!IsValidEmail(email)) throw new ArgumentException("That doesn't look like a valid email address.", nameof(email));

        Name = name.Trim();
        Email = NormalizeEmail(email);
        Language = SupportedLanguage.Require(language) ?? SupportedLanguage.Arabic;
        WhatsAppPhone = NormalizePhone(whatsAppPhone);
    }

    private void StartConfirmationRound(DateTime now)
    {
        Status = ParentContactStatus.PendingConfirmation;
        LinkVersion++;
        ConfirmationExpiresAt = now.Add(ConfirmationWindow);
        ConfirmedAt = null;
        UnsubscribedAt = null;
        UpdatedAt = now;
    }

    private void RequireNotRemoved()
    {
        if (Status == ParentContactStatus.Removed)
            throw new InvalidOperationException("This parent contact was removed.");
    }
}
