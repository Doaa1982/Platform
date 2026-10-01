namespace Platform.Api.Email;

/// <summary>
/// Product-level links and assets shown in every email's header/footer — section "EmailBranding".
/// LogoUrl is optional: without it the header shows a text wordmark. HelpUrl falls back to
/// WebsiteUrl when unset.
/// </summary>
public class EmailBrandingOptions
{
    public const string Section = "EmailBranding";

    public string? LogoUrl { get; set; }
    public string WebsiteUrl { get; set; } = "https://teachtandem.com";
    public string? HelpUrl { get; set; }
}

/// <summary>Who an email is from, as the recipient sees it.</summary>
public abstract record EmailSender
{
    /// <summary>Account, password reset, billing, platform invitations — from "Teach Tandem", signed by the team.</summary>
    public sealed record Platform : EmailSender;

    /// <summary>
    /// Sent on behalf of a tutor or academy — "{Name} via Teach Tandem", signed with their name,
    /// with replies going to <paramref name="ReplyToEmail"/> (null when there's no one to reply to).
    /// </summary>
    public sealed record Workspace(string Name, string? ReplyToEmail) : EmailSender;
}

/// <summary>
/// One email's words, already in the recipient's language, as plain text. Nothing here is HTML —
/// <see cref="EmailLayout"/> escapes every field when it renders, so a value that came from a user
/// (a name, a workspace name) can be placed here as-is.
/// </summary>
public record EmailContent(
    string Language,
    EmailSender Sender,
    string Subject,
    string Preheader,
    string Greeting,
    IReadOnlyList<string> Paragraphs,
    string ButtonLabel,
    string ButtonUrl,
    string? ExpiryNote,
    string SafetyNote);

public record RenderedEmail(string Subject, string Html, string Text);
