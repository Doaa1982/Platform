using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Authorization;
using Platform.Api.Email;
using Platform.Domain;

namespace Platform.Api.Controllers;

public record EmailPreviewSummary(string Template);

public record EmailPreviewResponse(
    string Template, string Language, string Subject, string FromDisplayName, string? ReplyTo, string Html, string Text);

/// <summary>
/// Platform operators only: every email template rendered with sample data, in English or Arabic,
/// without sending anything — for reviewing copy and layout before Email:Enabled is turned on.
/// </summary>
[ApiController]
[Route("api/admin/email-previews")]
[Authorize(Policy = PlatformOperatorRequirement.PolicyName)]
public class EmailPreviewController(EmailBrandingOptions branding, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public IReadOnlyList<EmailPreviewSummary> List() =>
        Enum.GetValues<EmailTemplate>()
            .Select(t => new EmailPreviewSummary(t.ToString()))
            .ToList();

    [HttpGet("{template}")]
    public ActionResult<EmailPreviewResponse> Get(string template, [FromQuery] string? language)
    {
        if (!Enum.TryParse<EmailTemplate>(template, ignoreCase: true, out var parsed))
            return NotFound(new { message = "No such email template." });

        var lang = SupportedLanguage.Normalize(language) ?? SupportedLanguage.English;
        var content = EmailPreviews.Build(parsed, lang);
        var rendered = EmailLayout.Render(content, branding, clock.GetUtcNow().Year);

        return new EmailPreviewResponse(
            parsed.ToString(), lang, rendered.Subject, TransactionalEmails.FromDisplayName(content),
            (content.Sender as EmailSender.Workspace)?.ReplyToEmail, rendered.Html, rendered.Text);
    }
}
