using Microsoft.Extensions.Logging;
using Platform.Api.Email;
using Platform.Domain;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// The shared email layout and every template: renders in both languages with an HTML and a
/// plain-text part, escapes user-supplied values, and never leaks a link into the log.
/// </summary>
public class EmailTemplateTests
{
    private static readonly EmailBrandingOptions Branding = new();

    public static TheoryData<EmailTemplate, string> EveryTemplateInBothLanguages()
    {
        var data = new TheoryData<EmailTemplate, string>();
        foreach (var template in Enum.GetValues<EmailTemplate>())
        foreach (var language in new[] { SupportedLanguage.English, SupportedLanguage.Arabic })
            data.Add(template, language);
        return data;
    }

    [Theory]
    [MemberData(nameof(EveryTemplateInBothLanguages))]
    public void Renders_html_and_plain_text_with_every_shared_layout_part(EmailTemplate template, string language)
    {
        var content = EmailPreviews.Build(template, language);
        var email = EmailLayout.Render(content, Branding, 2026);
        string T(string key) => EmailText.Get(language, key);

        Assert.False(string.IsNullOrWhiteSpace(email.Subject));
        Assert.Contains($"lang=\"{language}\"", email.Html);
        Assert.Contains(language == SupportedLanguage.Arabic ? "dir=\"rtl\"" : "dir=\"ltr\"", email.Html);
        if (language == SupportedLanguage.Arabic) Assert.Contains("text-align:right", email.Html);

        Assert.Contains(System.Net.WebUtility.HtmlEncode(content.Preheader), email.Html);   // hidden preheader
        Assert.Contains("max-width:600px", email.Html);
        Assert.Contains($"href=\"{content.ButtonUrl}\"", email.Html);                       // the main button
        Assert.Contains(System.Net.WebUtility.HtmlEncode(T("button.fallback")), email.Html); // "Button not working?"
        Assert.NotNull(content.ExpiryNote);
        Assert.Contains(System.Net.WebUtility.HtmlEncode(content.SafetyNote), email.Html);
        Assert.Contains("© 2026 Teach Tandem", System.Net.WebUtility.HtmlDecode(email.Html));
        Assert.Contains("teachtandem.com", email.Html);

        // Plain-text part exists and carries the same essentials.
        Assert.False(string.IsNullOrWhiteSpace(email.Text));
        Assert.Contains(content.Greeting, email.Text);
        Assert.Contains(content.ButtonUrl, email.Text);
        Assert.Contains(content.SafetyNote, email.Text);
        Assert.DoesNotContain("<", email.Text);
    }

    [Theory]
    [MemberData(nameof(EveryTemplateInBothLanguages))]
    public void Sender_matches_the_audience(EmailTemplate template, string language)
    {
        var content = EmailPreviews.Build(template, language);
        var email = EmailLayout.Render(content, Branding, 2026);
        var from = TransactionalEmails.FromDisplayName(content);

        if (template is EmailTemplate.WorkspaceInvitation or EmailTemplate.JoinRequestReceipt)
        {
            var workspace = Assert.IsType<EmailSender.Workspace>(content.Sender);
            Assert.Contains(workspace.Name, from);
            Assert.Contains("Teach Tandem", from);
            Assert.NotNull(workspace.ReplyToEmail);
            Assert.Contains(EmailText.Get(language, "footer.sentVia"), email.Text);
        }
        else
        {
            Assert.IsType<EmailSender.Platform>(content.Sender);
            Assert.Equal("Teach Tandem", from);
            Assert.Contains(EmailText.Get(language, "signature.team"), email.Text);
            Assert.DoesNotContain(EmailText.Get(language, "footer.sentVia"), email.Text);
        }
    }

    [Fact]
    public void User_supplied_values_are_html_escaped()
    {
        const string hostileName = "<script>alert('name')</script>";
        const string hostileWorkspace = "\"><img src=x onerror=alert(1)>";
        var content = EmailTemplates.WorkspaceInvitation(
            SupportedLanguage.English, hostileName, hostileWorkspace, WorkspaceRoleName.Learner,
            "<b>Tutor</b>", "tutor@example.com", "https://app.example.com/invite/abc", TimeSpan.FromDays(7));

        var html = EmailLayout.Render(content, Branding, 2026).Html;

        Assert.DoesNotContain("<script>", html);
        Assert.DoesNotContain("<img src=x", html);
        Assert.DoesNotContain("<b>Tutor</b>", html);
        Assert.Contains("&lt;script&gt;", html);
        Assert.Contains("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;", html);
    }

    [Fact]
    public void A_value_containing_a_placeholder_is_inserted_literally()
    {
        var content = EmailTemplates.WorkspaceInvitation(
            SupportedLanguage.English, null, "{inviter}", WorkspaceRoleName.Learner,
            "Mohamed", null, "https://app.example.com/invite/abc", TimeSpan.FromDays(7));

        Assert.Equal("You're invited to join {inviter} on Teach Tandem", content.Subject);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("/invite/relative")]
    public void Refuses_a_button_link_that_is_not_absolute_http(string link)
    {
        var content = EmailTemplates.PasswordReset(SupportedLanguage.English, "Sara", link, TimeSpan.FromHours(1));
        var ex = Assert.Throws<ArgumentException>(() => EmailLayout.Render(content, Branding, 2026));
        Assert.DoesNotContain(link, ex.Message); // a link may carry a token — never echo it
    }

    [Fact]
    public void Shows_a_hosted_logo_with_alt_text_when_configured_and_a_text_wordmark_otherwise()
    {
        var content = EmailPreviews.Build(EmailTemplate.PasswordReset, SupportedLanguage.English);

        var withLogo = EmailLayout.Render(content, new EmailBrandingOptions { LogoUrl = "https://cdn.example.com/logo.png" }, 2026).Html;
        Assert.Contains("<img src=\"https://cdn.example.com/logo.png\" alt=\"Teach Tandem\"", withLogo);

        var withoutLogo = EmailLayout.Render(content, Branding, 2026).Html;
        Assert.DoesNotContain("<img", withoutLogo);
        Assert.Contains("class=\"tt-wordmark\"", withoutLogo);
    }

    [Fact]
    public void English_and_Arabic_define_exactly_the_same_text_keys()
    {
        Assert.Equal(EmailText.EnglishKeys.OrderBy(k => k), EmailText.ArabicKeys.OrderBy(k => k));
    }

    [Theory]
    [InlineData("en", 7 * 24 * 60, "7 days")]
    [InlineData("en", 60, "1 hour")]
    [InlineData("en", 7 * 24 * 60 - 0.01, "7 days")] // measured a moment after issue
    [InlineData("ar", 24 * 60, "يوم واحد")]
    [InlineData("ar", 2 * 24 * 60, "يومين")]
    [InlineData("ar", 7 * 24 * 60, "7 أيام")]
    [InlineData("ar", 90 * 24 * 60, "90 يومًا")]
    [InlineData("ar", 60, "ساعة واحدة")]
    public void Durations_read_naturally(string language, double minutes, string expected)
    {
        Assert.Equal(expected, EmailText.Duration(language, TimeSpan.FromMinutes(minutes)));
    }

    [Fact]
    public async Task Disabled_delivery_never_logs_the_link()
    {
        var logger = new CapturingLogger<DisabledEmailDelivery>();
        var delivery = new DisabledEmailDelivery(logger);
        const string link = "https://app.example.com/reset-password/SECRET-TOKEN-123";
        var content = EmailTemplates.PasswordReset(SupportedLanguage.English, "Sara", link, TimeSpan.FromHours(1));
        var rendered = EmailLayout.Render(content, Branding, 2026);

        var outcome = await delivery.SendAsync(new OutgoingEmail(
            EmailTemplate.PasswordReset, "sara@example.com", "Sara", "Teach Tandem", null, rendered));

        Assert.False(outcome.Delivered);
        Assert.NotEmpty(logger.Messages);
        Assert.All(logger.Messages, m => Assert.DoesNotContain("SECRET-TOKEN-123", m));
    }

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => Messages.Add(formatter(state, exception));
    }
}
