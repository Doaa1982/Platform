using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Platform.Api.Email;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// End to end through the real services: which language an email goes out in, who it's from, and
/// the operator-only preview endpoint. A capturing IEmailDelivery stands in for SMTP.
/// </summary>
public class EmailLanguageAndPreviewTests(PlatformApiTestFixture fixture) : IClassFixture<PlatformApiTestFixture>
{
    private sealed class CapturingEmailDelivery : IEmailDelivery
    {
        public ConcurrentQueue<OutgoingEmail> Sent { get; } = new();
        public Task<DeliveryOutcome> SendAsync(OutgoingEmail email, CancellationToken ct = default)
        {
            Sent.Enqueue(email);
            return Task.FromResult(DeliveryOutcome.Sent("test"));
        }
    }

    private (WebApplicationFactory<Program> Host, CapturingEmailDelivery Outbox) HostWithOutbox()
    {
        var outbox = new CapturingEmailDelivery();
        var host = fixture.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<IEmailDelivery>();
            s.AddSingleton<IEmailDelivery>(outbox);
        }));
        return (host, outbox);
    }

    private static OutgoingEmail Last(CapturingEmailDelivery outbox, EmailTemplate template, string to) =>
        outbox.Sent.Last(e => e.Template == template && e.ToAddress == to);

    [Fact]
    public async Task Signup_receipt_goes_out_in_the_language_the_applicant_is_using()
    {
        var (host, outbox) = HostWithOutbox();
        using var _ = host;
        var client = host.CreateClient();
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("ar");

        var res = await client.PostAsJsonAsync("/api/signup-requests",
            new { fullName = "سارة أحمد", email = "elp-signup@integrationtest.local", about = "x" });
        res.EnsureSuccessStatusCode();

        var email = Last(outbox, EmailTemplate.SignupReceived, "elp-signup@integrationtest.local");
        Assert.Contains("dir=\"rtl\"", email.Content.Html);
        Assert.Equal(EmailText.Get("ar", "signupReceived.subject"), email.Content.Subject);
        Assert.Equal("Teach Tandem", email.FromDisplayName);
        Assert.Null(email.ReplyTo);
    }

    [Fact]
    public async Task Password_reset_uses_the_saved_preference_over_the_request_language()
    {
        var (host, outbox) = HostWithOutbox();
        using var _ = host;
        var client = host.CreateClient();
        var admin = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, admin, "elp-reset@integrationtest.local", "elp-reset");

        using (var req = new HttpRequestMessage(HttpMethod.Put, "/api/me/language"))
        {
            req.Headers.Authorization = new("Bearer", tutor.Token);
            req.Content = JsonContent.Create(new { language = "ar" });
            Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(req)).StatusCode);
        }

        using (var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/forgot-password"))
        {
            req.Headers.AcceptLanguage.ParseAdd("en");
            req.Content = JsonContent.Create(new { email = "elp-reset@integrationtest.local" });
            (await client.SendAsync(req)).EnsureSuccessStatusCode();
        }

        var email = Last(outbox, EmailTemplate.PasswordReset, "elp-reset@integrationtest.local");
        Assert.Equal(EmailText.Get("ar", "passwordReset.subject"), email.Content.Subject);
        Assert.Contains("ساعة واحدة", email.Content.Text); // 60-minute link, Arabic wording
    }

    [Fact]
    public async Task Member_invitation_falls_back_to_the_workspace_language_and_replies_to_the_inviter()
    {
        var (host, outbox) = HostWithOutbox();
        using var _ = host;
        var client = host.CreateClient();
        var admin = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, admin, "elp-owner@integrationtest.local", "elp-invite", fullName: "Mohamed Ali");

        using (var req = new HttpRequestMessage(HttpMethod.Put, $"/api/workspaces/{tutor.WorkspaceSlug}/setup/language"))
        {
            req.Headers.Authorization = new("Bearer", tutor.Token);
            req.Content = JsonContent.Create(new { language = "ar" });
            var res = await client.SendAsync(req);
            res.EnsureSuccessStatusCode();
            Assert.Equal("ar", (await res.Content.ReadFromJsonAsync<JsonObject>())!["defaultLanguage"]!.GetValue<string>());
        }

        using (var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{tutor.WorkspaceSlug}/invitations"))
        {
            req.Headers.Authorization = new("Bearer", tutor.Token);
            req.Headers.AcceptLanguage.ParseAdd("en"); // the inviter's language must not decide the invitee's
            req.Content = JsonContent.Create(new { email = "elp-invitee@integrationtest.local", role = "Learner" });
            (await client.SendAsync(req)).EnsureSuccessStatusCode();
        }

        var email = Last(outbox, EmailTemplate.WorkspaceInvitation, "elp-invitee@integrationtest.local");
        Assert.Contains("dir=\"rtl\"", email.Content.Html);
        Assert.Equal("elp-owner@integrationtest.local", email.ReplyTo);
        Assert.Equal(EmailText.Get("ar", "from.via", ("name", "elp-invite")), email.FromDisplayName);
    }

    [Fact]
    public async Task An_unsupported_language_is_rejected()
    {
        var client = fixture.CreateClient();
        var admin = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);

        using var req = new HttpRequestMessage(HttpMethod.Put, "/api/me/language");
        req.Headers.Authorization = new("Bearer", admin);
        req.Content = JsonContent.Create(new { language = "fr" });
        Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(req)).StatusCode);
    }

    [Fact]
    public async Task Previews_render_every_template_for_operators_only()
    {
        var client = fixture.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/admin/email-previews")).StatusCode);

        var admin = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        using (var req = new HttpRequestMessage(HttpMethod.Get, "/api/admin/email-previews"))
        {
            req.Headers.Authorization = new("Bearer", admin);
            var list = await (await client.SendAsync(req)).Content.ReadFromJsonAsync<JsonArray>();
            Assert.Equal(Enum.GetValues<EmailTemplate>().Length, list!.Count);
        }

        foreach (var template in Enum.GetValues<EmailTemplate>())
        foreach (var language in new[] { "en", "ar" })
        {
            var preview = await TestOnboarding.GetJsonAuthorizedAsync(client, admin, $"/api/admin/email-previews/{template}?language={language}");
            Assert.Equal(language, preview["language"]!.GetValue<string>());
            Assert.Contains("<!DOCTYPE html>", preview["html"]!.GetValue<string>());
            Assert.False(string.IsNullOrWhiteSpace(preview["text"]!.GetValue<string>()));
        }
    }
}
