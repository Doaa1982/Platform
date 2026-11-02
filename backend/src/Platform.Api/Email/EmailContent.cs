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
///
/// A report to a parent has no button (parents have no login, so there is nothing to open):
/// <see cref="ButtonLabel"/>/<see cref="ButtonUrl"/> are null there. <see cref="Details"/> are
/// label/value rows (a result, a score), <see cref="Quote"/> is text quoted as the tutor wrote
/// it (feedback), and <see cref="UnsubscribeUrl"/> adds a one-click unsubscribe line to the footer.
/// </summary>
public record EmailContent(
    string Language,
    EmailSender Sender,
    string Subject,
    string Preheader,
    string Greeting,
    IReadOnlyList<string> Paragraphs,
    string? ButtonLabel,
    string? ButtonUrl,
    string? ExpiryNote,
    string? SafetyNote,
    IReadOnlyList<EmailDetail>? Details = null,
    string? QuoteLabel = null,
    string? Quote = null,
    string? UnsubscribeUrl = null,
    IReadOnlyList<string>? ClosingParagraphs = null);

/// <summary>One "label: value" row in an email (e.g. "Result: Passed").</summary>
public record EmailDetail(string Label, string Value);

public record RenderedEmail(string Subject, string Html, string Text);
