namespace Platform.Domain;

/// <summary>
/// Parent details a tutor typed while inviting a student (Parent Progress Reports Business
/// Analysis §6.1). An invitation is not a membership, and a parent contact needs a learner — so
/// these wait here, referencing the Invitation by identifier only, and become
/// <see cref="ParentContact"/>s only when the student accepts and their Membership is Active.
/// Only then does the parent get the confirmation email: parents of a student who never joins are
/// never contacted. Cancelling an invitation deletes these rows; an expired invitation can't be
/// accepted, and resending one that expired deletes them too.
/// </summary>
public class InvitationParentContact
{
    public Guid Id { get; private set; }
    public Guid InvitationId { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string Language { get; private set; } = SupportedLanguage.Arabic;
    public string? WhatsAppPhone { get; private set; }
    public DateTime CreatedAt { get; private set; }

    // Required by EF Core — not for application use
    private InvitationParentContact() { }

    /// <summary>Validated with the same rules a <see cref="ParentContact"/> applies, so acceptance can't fail on them later.</summary>
    public static InvitationParentContact Create(
        Guid invitationId, Guid workspaceId, string name, string email, string? language, string? whatsAppPhone, DateTime now)
    {
        if (invitationId == Guid.Empty) throw new ArgumentException("Parent details belong to one invitation.", nameof(invitationId));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("A parent needs a name.", nameof(name));
        if (name.Trim().Length > 120) throw new ArgumentException("A parent's name can be at most 120 characters.", nameof(name));
        if (!ParentContact.IsValidEmail(email)) throw new ArgumentException("That doesn't look like a valid email address.", nameof(email));

        return new InvitationParentContact
        {
            Id = Guid.NewGuid(),
            InvitationId = invitationId,
            WorkspaceId = workspaceId,
            Name = name.Trim(),
            Email = ParentContact.NormalizeEmail(email),
            Language = SupportedLanguage.Require(language) ?? SupportedLanguage.Arabic,
            WhatsAppPhone = ParentContact.NormalizePhone(whatsAppPhone),
            CreatedAt = now,
        };
    }
}
