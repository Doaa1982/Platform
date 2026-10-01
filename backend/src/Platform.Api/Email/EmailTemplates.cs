using Platform.Domain;

namespace Platform.Api.Email;

/// <summary>The emails this platform sends. Names are stable — used by the preview endpoint and in logs.</summary>
public enum EmailTemplate
{
    WorkspaceInvitation,
    OwnerInvitation,
    PasswordReset,
    JoinRequestReceipt,
    SignupReceived,
}

/// <summary>
/// Builds each email's content in the recipient's language. Pure: no I/O, no clock (the time left
/// on a link is passed in), so the same builders back real sends, the admin preview, and tests.
/// Every user-supplied value is passed through as plain text — <see cref="EmailLayout"/> escapes it.
/// </summary>
public static class EmailTemplates
{
    /// <summary>A workspace (tutor/academy) inviting someone to join it — sent "via Teach Tandem", replies to the inviter.</summary>
    public static EmailContent WorkspaceInvitation(
        string language, string? recipientName, string workspaceName, WorkspaceRoleName role,
        string inviterName, string? inviterEmail, string link, TimeSpan validFor)
    {
        string T(string key) => EmailText.Get(language, key,
            ("workspace", workspaceName), ("inviter", inviterName), ("role", Role(language, role)));
        return new EmailContent(
            language,
            new EmailSender.Workspace(workspaceName, inviterEmail),
            T("workspaceInvitation.subject"),
            T("workspaceInvitation.preheader"),
            Greeting(language, recipientName),
            [T("workspaceInvitation.body"), T("workspaceInvitation.body2")],
            T("workspaceInvitation.button"),
            link,
            Expiry(language, validFor, singleUse: true),
            EmailText.Get(language, "safety.default"));
    }

    /// <summary>The platform inviting someone to own/run a newly provisioned workspace.</summary>
    public static EmailContent OwnerInvitation(
        string language, string? recipientName, string workspaceName, WorkspaceRoleName role, string link, TimeSpan validFor)
    {
        string T(string key) => EmailText.Get(language, key, ("workspace", workspaceName), ("role", Role(language, role)));
        return new EmailContent(
            language,
            new EmailSender.Platform(),
            T("ownerInvitation.subject"),
            T("ownerInvitation.preheader"),
            Greeting(language, recipientName),
            [T("ownerInvitation.body"), T("ownerInvitation.body2")],
            T("ownerInvitation.button"),
            link,
            Expiry(language, validFor, singleUse: true),
            EmailText.Get(language, "safety.default"));
    }

    public static EmailContent PasswordReset(string language, string recipientName, string link, TimeSpan validFor) => new(
        language,
        new EmailSender.Platform(),
        EmailText.Get(language, "passwordReset.subject"),
        EmailText.Get(language, "passwordReset.preheader"),
        Greeting(language, recipientName),
        [EmailText.Get(language, "passwordReset.body")],
        EmailText.Get(language, "passwordReset.button"),
        link,
        Expiry(language, validFor, singleUse: true),
        EmailText.Get(language, "passwordReset.safety"));

    /// <summary>Acknowledges someone's request to join a workspace — on the workspace's behalf, replies to its owner.</summary>
    public static EmailContent JoinRequestReceipt(
        string language, string? recipientName, string workspaceName, string? ownerEmail, string link, TimeSpan validFor)
    {
        string T(string key) => EmailText.Get(language, key, ("workspace", workspaceName));
        return new EmailContent(
            language,
            new EmailSender.Workspace(workspaceName, ownerEmail),
            T("joinRequestReceipt.subject"),
            T("joinRequestReceipt.preheader"),
            Greeting(language, recipientName),
            [T("joinRequestReceipt.body"), T("joinRequestReceipt.body2")],
            T("joinRequestReceipt.button"),
            link,
            Expiry(language, validFor, singleUse: false),
            EmailText.Get(language, "safety.default"));
    }

    /// <summary>Acknowledges a prospective tutor's application to teach on the platform.</summary>
    public static EmailContent SignupReceived(string language, string recipientName, string link, TimeSpan validFor) => new(
        language,
        new EmailSender.Platform(),
        EmailText.Get(language, "signupReceived.subject"),
        EmailText.Get(language, "signupReceived.preheader"),
        Greeting(language, recipientName),
        [EmailText.Get(language, "signupReceived.body"), EmailText.Get(language, "signupReceived.body2")],
        EmailText.Get(language, "signupReceived.button"),
        link,
        Expiry(language, validFor, singleUse: false),
        EmailText.Get(language, "safety.default"));

    private static string Greeting(string language, string? name) =>
        string.IsNullOrWhiteSpace(name)
            ? EmailText.Get(language, "greeting.anonymous")
            : EmailText.Get(language, "greeting.named", ("name", name.Trim()));

    private static string Role(string language, WorkspaceRoleName role) => EmailText.Get(language, $"role.{role}");

    private static string Expiry(string language, TimeSpan validFor, bool singleUse) =>
        EmailText.Get(language, singleUse ? "expiry.singleUse" : "expiry", ("duration", EmailText.Duration(language, validFor)));
}
