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
    ParentConfirmation,
    ParentAssignmentResult,
    ParentQuizResult,
    ParentMonthlySummary,
}

/// <summary>What a monthly parent summary reports (Parent Progress Reports Business Analysis §9).</summary>
public record ParentMonthlyFigures(
    int AssignmentsCompleted,
    int QuizzesCompleted,
    int Missed,
    int? AverageQuizScore,
    int? PreviousAverageQuizScore,
    string? LowestActivityTitle,
    string? LowestResult);

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

    // ── Parent progress reports (Parent Progress Reports Business Analysis) ─────────────────
    // From the academy ("{Academy} via Teach Tandem", replies to its owner), never with a link into
    // the app — parents have no login. Reports carry a one-click unsubscribe link in the footer.
    // The learner is named by first name only; activity titles and feedback are quoted as written.

    /// <summary>The one email a parent gets before they confirm: "Yes, send me updates".</summary>
    public static EmailContent ParentConfirmation(
        string language, string parentName, string learnerFirstName, string workspaceName, string? replyTo,
        string confirmLink, TimeSpan validFor)
    {
        string T(string key) => EmailText.Get(language, key, ("workspace", workspaceName), ("learner", learnerFirstName));
        return new EmailContent(
            language,
            new EmailSender.Workspace(workspaceName, replyTo),
            T("parentConfirm.subject"),
            T("parentConfirm.preheader"),
            Greeting(language, parentName),
            [T("parentConfirm.body"), T("parentConfirm.body2")],
            T("parentConfirm.button"),
            confirmLink,
            Expiry(language, validFor, singleUse: false),
            T("parentConfirm.safety"));
    }

    /// <summary>The tutor issued an assignment result. <paramref name="passed"/> null = reviewed without pass/fail.</summary>
    public static EmailContent ParentAssignmentResult(
        string language, string parentName, string learnerFirstName, string workspaceName, string? replyTo,
        string activityTitle, string courseTitle, bool? passed, string? feedback, string unsubscribeLink)
    {
        string T(string key) => EmailText.Get(language, key,
            ("workspace", workspaceName), ("learner", learnerFirstName), ("activity", activityTitle), ("course", courseTitle));
        var trimmed = TrimFeedback(feedback);
        return new EmailContent(
            language,
            new EmailSender.Workspace(workspaceName, replyTo),
            T("parentAssignment.subject"),
            T("parentAssignment.preheader"),
            Greeting(language, parentName),
            [T("parentAssignment.body")],
            null, null, null, null,
            Details:
            [
                new(T("parentReport.labelAssignment"), activityTitle),
                new(T("parentReport.labelCourse"), courseTitle),
                new(T("parentReport.labelResult"), ResultWord(language, passed)),
            ],
            QuoteLabel: trimmed is null ? null : T("parentReport.feedbackLabel"),
            Quote: trimmed,
            UnsubscribeUrl: unsubscribeLink);
    }

    /// <summary>A learner's quiz attempt was graded.</summary>
    public static EmailContent ParentQuizResult(
        string language, string parentName, string learnerFirstName, string workspaceName, string? replyTo,
        string quizTitle, string courseTitle, int scorePercent, bool passed, string? feedback, string unsubscribeLink)
    {
        string T(string key) => EmailText.Get(language, key,
            ("workspace", workspaceName), ("learner", learnerFirstName), ("activity", quizTitle), ("course", courseTitle));
        var trimmed = TrimFeedback(feedback);
        return new EmailContent(
            language,
            new EmailSender.Workspace(workspaceName, replyTo),
            T("parentQuiz.subject"),
            T("parentQuiz.preheader"),
            Greeting(language, parentName),
            [T("parentQuiz.body")],
            null, null, null, null,
            Details:
            [
                new(T("parentReport.labelQuiz"), quizTitle),
                new(T("parentReport.labelCourse"), courseTitle),
                new(T("parentReport.labelScore"), $"{scorePercent}%"),
                new(T("parentReport.labelResult"), ResultWord(language, passed)),
            ],
            QuoteLabel: trimmed is null ? null : T("parentReport.feedbackLabel"),
            Quote: trimmed,
            UnsubscribeUrl: unsubscribeLink);
    }

    /// <summary>The previous calendar month for one learner. <paramref name="month"/> is its first day.</summary>
    public static EmailContent ParentMonthlySummary(
        string language, string parentName, string learnerFirstName, string workspaceName, string? replyTo,
        DateOnly month, ParentMonthlyFigures f, string unsubscribeLink)
    {
        var monthName = EmailText.MonthYear(language, month);
        var previousMonthName = EmailText.MonthYear(language, month.AddMonths(-1));
        string T(string key, params (string, string)[] extra) => EmailText.Get(language, key,
            [("workspace", workspaceName), ("learner", learnerFirstName), ("month", monthName), ("previousMonth", previousMonthName), .. extra]);

        var details = new List<EmailDetail>
        {
            new(T("parentMonthly.labelAssignments"), f.AssignmentsCompleted.ToString()),
            new(T("parentMonthly.labelQuizzes"), f.QuizzesCompleted.ToString()),
            new(T("parentMonthly.labelMissed"), f.Missed.ToString()),
            new(T("parentMonthly.labelAverage"), f.AverageQuizScore is { } avg ? $"{avg}%" : T("parentMonthly.noQuizzes")),
        };
        if (f.AverageQuizScore is { } current)
        {
            var change = f.PreviousAverageQuizScore is not { } previous ? T("parentMonthly.changeNone")
                : current == previous ? T("parentMonthly.changeSame")
                : current > previous ? T("parentMonthly.changeUp", ("points", (current - previous).ToString()))
                : T("parentMonthly.changeDown", ("points", (previous - current).ToString()));
            details.Add(new(T("parentMonthly.labelChange"), change));
        }
        if (f.LowestActivityTitle is not null)
            details.Add(new(T("parentMonthly.labelLowest"), $"{f.LowestActivityTitle} ({f.LowestResult})"));

        return new EmailContent(
            language,
            new EmailSender.Workspace(workspaceName, replyTo),
            T("parentMonthly.subject"),
            T("parentMonthly.preheader"),
            Greeting(language, parentName),
            [T("parentMonthly.body")],
            null, null, null, null,
            Details: details,
            UnsubscribeUrl: unsubscribeLink);
    }

    /// <summary>"Passed" / "Not passed" / "Reviewed" in the parent's language.</summary>
    public static string ResultWord(string language, bool? passed) => EmailText.Get(language, passed switch
    {
        true => "parentReport.passed",
        false => "parentReport.notPassed",
        null => "parentReport.reviewed",
    });

    /// <summary>About 300 characters, cut at a word where possible, with an ellipsis.</summary>
    public static string? TrimFeedback(string? feedback)
    {
        if (string.IsNullOrWhiteSpace(feedback)) return null;
        var text = feedback.Trim();
        const int max = 300;
        if (text.Length <= max) return text;
        var cut = text.LastIndexOf(' ', max);
        return text[..(cut > max - 60 ? cut : max)].TrimEnd() + "…";
    }

    private static string Greeting(string language, string? name) =>
        string.IsNullOrWhiteSpace(name)
            ? EmailText.Get(language, "greeting.anonymous")
            : EmailText.Get(language, "greeting.named", ("name", name.Trim()));

    private static string Role(string language, WorkspaceRoleName role) => EmailText.Get(language, $"role.{role}");

    private static string Expiry(string language, TimeSpan validFor, bool singleUse) =>
        EmailText.Get(language, singleUse ? "expiry.singleUse" : "expiry", ("duration", EmailText.Duration(language, validFor)));
}
