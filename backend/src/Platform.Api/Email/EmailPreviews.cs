using Platform.Domain;

namespace Platform.Api.Email;

/// <summary>
/// Sample data for reviewing every template before email is switched on — rendered through exactly
/// the same templates and layout as a real send, with obviously fake links.
/// </summary>
public static class EmailPreviews
{
    private const string SampleLink = "https://app.teachtandem.com/invite/SAMPLE-TOKEN-not-a-real-link";

    public static EmailContent Build(EmailTemplate template, string language)
    {
        var ar = language == SupportedLanguage.Arabic;
        var person = ar ? "سارة أحمد" : "Sara Ahmed";
        var tutor = ar ? "أ. محمد علي" : "Mohamed Ali";
        var workspace = ar ? "أكاديمية النور" : "Al Noor Academy";

        return template switch
        {
            EmailTemplate.WorkspaceInvitation => EmailTemplates.WorkspaceInvitation(
                language, null, workspace, WorkspaceRoleName.Learner, tutor, "tutor@example.com", SampleLink, TimeSpan.FromDays(7)),
            EmailTemplate.OwnerInvitation => EmailTemplates.OwnerInvitation(
                language, null, workspace, WorkspaceRoleName.Owner, SampleLink, TimeSpan.FromDays(7)),
            EmailTemplate.PasswordReset => EmailTemplates.PasswordReset(
                language, person, SampleLink.Replace("/invite/", "/reset-password/"), TimeSpan.FromMinutes(60)),
            EmailTemplate.JoinRequestReceipt => EmailTemplates.JoinRequestReceipt(
                language, person, workspace, "owner@example.com", SampleLink.Replace("/invite/", "/join-request/"), TimeSpan.FromDays(90)),
            EmailTemplate.SignupReceived => EmailTemplates.SignupReceived(
                language, person, SampleLink.Replace("/invite/", "/signup/status/"), TimeSpan.FromDays(90)),
            _ => throw new ArgumentOutOfRangeException(nameof(template)),
        };
    }
}
