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
            EmailTemplate.ParentConfirmation => EmailTemplates.ParentConfirmation(
                language, ar ? "هالة أحمد" : "Hala Ahmed", ar ? "سارة" : "Sara", workspace, "owner@example.com",
                SampleLink.Replace("/invite/", "/parent/confirm/"), TimeSpan.FromDays(14)),
            EmailTemplate.ParentAssignmentResult => EmailTemplates.ParentAssignmentResult(
                language, ar ? "هالة أحمد" : "Hala Ahmed", ar ? "سارة" : "Sara", workspace, "owner@example.com",
                ar ? "واجب: حل المعادلات" : "Homework: solving equations", ar ? "الرياضيات للصف الثامن" : "Grade 8 Maths",
                true, ar ? "عمل ممتاز يا سارة، خطواتك واضحة. راجعي السؤال الرابع." : "Great work, Sara. Your steps are clear — have another look at question 4.",
                SampleLink.Replace("/invite/", "/parent/unsubscribe/")),
            EmailTemplate.ParentQuizResult => EmailTemplates.ParentQuizResult(
                language, ar ? "هالة أحمد" : "Hala Ahmed", ar ? "سارة" : "Sara", workspace, "owner@example.com",
                ar ? "اختبار: مساحة الدائرة" : "Quiz: area of a circle", ar ? "الرياضيات للصف الثامن" : "Grade 8 Maths",
                80, true, null, SampleLink.Replace("/invite/", "/parent/unsubscribe/")),
            EmailTemplate.ParentMonthlySummary => EmailTemplates.ParentMonthlySummary(
                language, ar ? "هالة أحمد" : "Hala Ahmed", ar ? "سارة" : "Sara", workspace, "owner@example.com",
                new DateOnly(2026, 10, 1),
                new ParentMonthlyFigures(4, 3, 1, 78, 72, ar ? "اختبار: الكسور" : "Quiz: fractions", "55%"),
                SampleLink.Replace("/invite/", "/parent/unsubscribe/")),
            _ => throw new ArgumentOutOfRangeException(nameof(template)),
        };
    }
}
