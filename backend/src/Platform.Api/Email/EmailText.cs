using Platform.Domain;

namespace Platform.Api.Email;

/// <summary>
/// Every word that appears in an outgoing email, in English and Arabic. The layout and the
/// templates only ever look strings up here — none of them hard-code copy. Values are plain text
/// with {placeholders}; HTML-escaping happens once, in <see cref="EmailLayout"/>, never here.
/// </summary>
public static class EmailText
{
    private static readonly Dictionary<string, string> En = new()
    {
        ["brand.name"] = "Teach Tandem",
        ["greeting.named"] = "Hi {name},",
        ["greeting.anonymous"] = "Hi,",
        ["button.fallback"] = "Button not working? Copy this link:",
        ["safety.default"] = "If you weren't expecting this email, you can ignore it.",
        ["expiry"] = "This link expires in {duration}.",
        ["expiry.singleUse"] = "This link expires in {duration} and can only be used once.",
        ["signature.team"] = "The Teach Tandem Team",
        ["from.via"] = "{name} via Teach Tandem",
        ["footer.sentVia"] = "Sent via Teach Tandem",
        ["footer.help"] = "Need help?",
        ["footer.helpLink"] = "Contact us",
        ["footer.copyright"] = "© {year} Teach Tandem",

        ["role.Owner"] = "the owner",
        ["role.Administrator"] = "an administrator",
        ["role.Teacher"] = "a teacher",
        ["role.AssistantTeacher"] = "an assistant teacher",
        ["role.Learner"] = "a learner",
        ["role.Parent"] = "a parent",
        ["role.FinanceManager"] = "a finance manager",

        ["workspaceInvitation.subject"] = "You're invited to join {workspace} on Teach Tandem",
        ["workspaceInvitation.preheader"] = "{inviter} invited you to join {workspace}.",
        ["workspaceInvitation.body"] = "{inviter} has invited you to join {workspace} on Teach Tandem as {role}.",
        ["workspaceInvitation.body2"] = "Accept the invitation to set up your account and get started.",
        ["workspaceInvitation.button"] = "Accept invitation",

        ["ownerInvitation.subject"] = "Your workspace {workspace} is ready on Teach Tandem",
        ["ownerInvitation.preheader"] = "Accept your invitation to start setting up {workspace}.",
        ["ownerInvitation.body"] = "Your Teach Tandem workspace, {workspace}, has been created and you've been invited to manage it as {role}.",
        ["ownerInvitation.body2"] = "Accept the invitation to create your account and start setting it up.",
        ["ownerInvitation.button"] = "Accept invitation",

        ["passwordReset.subject"] = "Reset your Teach Tandem password",
        ["passwordReset.preheader"] = "Use this link to choose a new password.",
        ["passwordReset.body"] = "We received a request to reset your password. Choose a new one with the button below.",
        ["passwordReset.button"] = "Choose a new password",
        ["passwordReset.safety"] = "If you didn't ask for this, you can ignore this email. Your password hasn't changed.",

        ["joinRequestReceipt.subject"] = "We received your request to join {workspace}",
        ["joinRequestReceipt.preheader"] = "{workspace} will review your request soon.",
        ["joinRequestReceipt.body"] = "Thanks for asking to join {workspace}. Your request is waiting for review.",
        ["joinRequestReceipt.body2"] = "You can check its status at any time.",
        ["joinRequestReceipt.button"] = "Check request status",

        ["signupReceived.subject"] = "We received your application to teach on Teach Tandem",
        ["signupReceived.preheader"] = "We'll review your application and get back to you.",
        ["signupReceived.body"] = "Thanks for applying to teach on Teach Tandem. We've received your application and will review it soon.",
        ["signupReceived.body2"] = "You can check its status at any time.",
        ["signupReceived.button"] = "Check application status",
    };

    private static readonly Dictionary<string, string> Ar = new()
    {
        ["brand.name"] = "Teach Tandem",
        ["greeting.named"] = "مرحبًا {name}،",
        ["greeting.anonymous"] = "مرحبًا،",
        ["button.fallback"] = "الزر لا يعمل؟ انسخ هذا الرابط:",
        ["safety.default"] = "إذا لم تكن تتوقع هذه الرسالة، يمكنك تجاهلها.",
        ["expiry"] = "تنتهي صلاحية هذا الرابط خلال {duration}.",
        ["expiry.singleUse"] = "تنتهي صلاحية هذا الرابط خلال {duration}، ولا يمكن استخدامه إلا مرة واحدة.",
        ["signature.team"] = "فريق Teach Tandem",
        ["from.via"] = "{name} عبر Teach Tandem",
        ["footer.sentVia"] = "أُرسلت عبر Teach Tandem",
        ["footer.help"] = "تحتاج إلى مساعدة؟",
        ["footer.helpLink"] = "تواصل معنا",
        ["footer.copyright"] = "© {year} Teach Tandem",

        ["role.Owner"] = "المالك",
        ["role.Administrator"] = "مسؤول",
        ["role.Teacher"] = "معلّم",
        ["role.AssistantTeacher"] = "معلّم مساعد",
        ["role.Learner"] = "متعلّم",
        ["role.Parent"] = "وليّ أمر",
        ["role.FinanceManager"] = "مسؤول مالي",

        ["workspaceInvitation.subject"] = "دعوة للانضمام إلى {workspace} على Teach Tandem",
        ["workspaceInvitation.preheader"] = "دعاك {inviter} للانضمام إلى {workspace}.",
        ["workspaceInvitation.body"] = "دعاك {inviter} للانضمام إلى {workspace} على Teach Tandem بدور {role}.",
        ["workspaceInvitation.body2"] = "اقبل الدعوة لإعداد حسابك والبدء.",
        ["workspaceInvitation.button"] = "قبول الدعوة",

        ["ownerInvitation.subject"] = "مساحة العمل {workspace} جاهزة على Teach Tandem",
        ["ownerInvitation.preheader"] = "اقبل دعوتك لبدء إعداد {workspace}.",
        ["ownerInvitation.body"] = "تم إنشاء مساحة العمل {workspace} على Teach Tandem، وتمت دعوتك لإدارتها بدور {role}.",
        ["ownerInvitation.body2"] = "اقبل الدعوة لإنشاء حسابك والبدء في إعدادها.",
        ["ownerInvitation.button"] = "قبول الدعوة",

        ["passwordReset.subject"] = "إعادة تعيين كلمة المرور في Teach Tandem",
        ["passwordReset.preheader"] = "استخدم هذا الرابط لاختيار كلمة مرور جديدة.",
        ["passwordReset.body"] = "تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بك. اختر كلمة مرور جديدة من خلال الزر أدناه.",
        ["passwordReset.button"] = "اختيار كلمة مرور جديدة",
        ["passwordReset.safety"] = "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة. لم تتغير كلمة المرور الخاصة بك.",

        ["joinRequestReceipt.subject"] = "تلقينا طلبك للانضمام إلى {workspace}",
        ["joinRequestReceipt.preheader"] = "ستراجع {workspace} طلبك قريبًا.",
        ["joinRequestReceipt.body"] = "شكرًا لطلبك الانضمام إلى {workspace}. طلبك قيد المراجعة الآن.",
        ["joinRequestReceipt.body2"] = "يمكنك متابعة حالته في أي وقت.",
        ["joinRequestReceipt.button"] = "متابعة حالة الطلب",

        ["signupReceived.subject"] = "تلقينا طلبك للتدريس على Teach Tandem",
        ["signupReceived.preheader"] = "سنراجع طلبك ونعود إليك.",
        ["signupReceived.body"] = "شكرًا لتقديمك طلب التدريس على Teach Tandem. تلقينا طلبك وسنراجعه قريبًا.",
        ["signupReceived.body2"] = "يمكنك متابعة حالته في أي وقت.",
        ["signupReceived.button"] = "متابعة حالة الطلب",
    };

    /// <summary>Every key, for tests that check both languages define exactly the same set.</summary>
    public static IReadOnlyCollection<string> EnglishKeys => En.Keys;
    public static IReadOnlyCollection<string> ArabicKeys => Ar.Keys;

    public static string Get(string language, string key, params (string Name, string Value)[] args)
    {
        var table = language == SupportedLanguage.Arabic ? Ar : En;
        if (!table.TryGetValue(key, out var text))
            throw new KeyNotFoundException($"No email text \"{key}\" for language \"{language}\".");
        if (args.Length == 0) return text;

        // One pass over the template: a value that itself contains "{something}" (a workspace
        // literally named "{inviter}") is inserted as-is, never substituted again.
        var values = args.ToDictionary(a => a.Name, a => a.Value);
        return System.Text.RegularExpressions.Regex.Replace(text, @"\{(\w+)\}",
            m => values.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value);
    }

    /// <summary>
    /// "7 days", "1 hour", "يومين" — the largest whole unit, rounded to nearest, at least 1 minute.
    /// Rounded rather than truncated because the span is measured a moment after the link was
    /// issued: 6d 23h 59m 59s is "7 days", not "6 days".
    /// </summary>
    public static string Duration(string language, TimeSpan span)
    {
        var minutes = Math.Max(1, (int)Math.Round(span.TotalMinutes, MidpointRounding.AwayFromZero));
        var (count, unit) = minutes >= 1440 ? ((int)Math.Round(minutes / 1440.0, MidpointRounding.AwayFromZero), "day")
            : minutes >= 60 ? ((int)Math.Round(minutes / 60.0, MidpointRounding.AwayFromZero), "hour")
            : (minutes, "minute");

        if (language != SupportedLanguage.Arabic)
            return $"{count} {unit}{(count == 1 ? "" : "s")}";

        // Arabic number agreement: 1 and 2 use their own forms, 3–10 the plural, 11+ the singular accusative.
        var (one, two, few, many) = unit switch
        {
            "day" => ("يوم واحد", "يومين", "أيام", "يومًا"),
            "hour" => ("ساعة واحدة", "ساعتين", "ساعات", "ساعة"),
            _ => ("دقيقة واحدة", "دقيقتين", "دقائق", "دقيقة"),
        };
        return count switch
        {
            1 => one,
            2 => two,
            <= 10 => $"{count} {few}",
            _ => $"{count} {many}",
        };
    }
}
