using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// Drives the same real HTTP chain the live manual clean-environment run
/// used (V1 Launch Readiness Report, §2 "Journey A") — signup → admin
/// approval → provisioning → invitation acceptance — so every integration
/// test starts from a workspace that was actually provisioned through the
/// supported V1 process, not a row inserted directly into the DB.
/// </summary>
public static class TestOnboarding
{
    public static async Task<string> LoginAsync(HttpClient client, string email, string password)
    {
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        res.EnsureSuccessStatusCode();
        var json = await res.Content.ReadFromJsonAsync<JsonObject>();
        return json!["token"]!.GetValue<string>();
    }

    public sealed record OnboardedTutor(string Token, string WorkspaceSlug, Guid SubscriptionId);

    /// <summary>
    /// Full chain: anonymous signup request -> admin approves -> admin
    /// provisions (issues an invitation) -> tutor accepts (creates their
    /// Identity, becomes Owner, auto-checks-out the Free plan) -> workspace
    /// walked through Created -> Active. Returns the tutor's own bearer token.
    /// </summary>
    public static async Task<OnboardedTutor> OnboardTutorAsync(
        HttpClient client, string adminToken, string email, string workspaceSlug, string fullName = "Test Tutor")
    {
        var signup = await client.PostAsJsonAsync("/api/signup-requests",
            new { fullName, email, about = "Integration test tutor" });
        signup.EnsureSuccessStatusCode();
        var requestId = (await signup.Content.ReadFromJsonAsync<JsonObject>())!["requestId"]!.GetValue<Guid>();

        using (var req = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/signup-requests/{requestId}/approve"))
        {
            req.Headers.Authorization = new("Bearer", adminToken);
            (await client.SendAsync(req)).EnsureSuccessStatusCode();
        }

        JsonObject provisioned;
        using (var req = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/signup-requests/{requestId}/provision"))
        {
            req.Headers.Authorization = new("Bearer", adminToken);
            req.Content = JsonContent.Create(new { name = workspaceSlug, slug = workspaceSlug, ownerEmail = email, description = "Integration test workspace" });
            var res = await client.SendAsync(req);
            res.EnsureSuccessStatusCode();
            provisioned = (await res.Content.ReadFromJsonAsync<JsonObject>())!;
        }

        var invitationLink = provisioned["invitationLink"]!.GetValue<string>();
        var invitationToken = invitationLink.Split('/').Last();

        var accept = await client.PostAsJsonAsync($"/api/invitations/{invitationToken}/accept",
            new { password = "TutorSecure!2026", fullName });
        accept.EnsureSuccessStatusCode();
        var tutorToken = (await accept.Content.ReadFromJsonAsync<JsonObject>())!["token"]!.GetValue<string>();

        foreach (var step in new[] { "begin-configuration", "make-private", "publish", "activate" })
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{workspaceSlug}/setup/{step}");
            req.Headers.Authorization = new("Bearer", tutorToken);
            (await client.SendAsync(req)).EnsureSuccessStatusCode();
        }

        var subscription = await GetJsonAuthorizedAsync(client, tutorToken, $"/api/workspaces/{workspaceSlug}/subscription");
        var subscriptionId = subscription["subscriptionId"]!.GetValue<Guid>();

        return new OnboardedTutor(tutorToken, workspaceSlug, subscriptionId);
    }

    /// <summary>
    /// Requests an upgrade to a priced plan (issues a prorated invoice) and
    /// has the admin mark it paid — the real Manual Commercial Activation
    /// path (no payment processing exists in this platform by design).
    /// Returns the resulting AI credit balance.
    /// </summary>
    public static async Task<int> UpgradePlanAsync(HttpClient client, string adminToken, string tutorToken, string workspaceSlug, string planCode)
    {
        using var upgradeReq = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{workspaceSlug}/subscription/upgrade");
        upgradeReq.Headers.Authorization = new("Bearer", tutorToken);
        upgradeReq.Content = JsonContent.Create(new { planCode, packCodes = Array.Empty<string>() });
        var upgradeRes = await client.SendAsync(upgradeReq);
        upgradeRes.EnsureSuccessStatusCode();
        var upgraded = (await upgradeRes.Content.ReadFromJsonAsync<JsonObject>())!;
        var invoiceId = upgraded["currentInvoiceId"]!.GetValue<Guid>();

        using var payReq = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/invoices/{invoiceId}/mark-paid");
        payReq.Headers.Authorization = new("Bearer", adminToken);
        payReq.Content = JsonContent.Create(new { referenceNote = "Integration test activation" });
        var payRes = await client.SendAsync(payReq);
        payRes.EnsureSuccessStatusCode();
        var paid = (await payRes.Content.ReadFromJsonAsync<JsonObject>())!;
        return paid["aiCreditsRemaining"]!.GetValue<int>();
    }

    public static async Task<int> GetAiCreditsRemainingAsync(HttpClient client, string tutorToken, string workspaceSlug)
    {
        var json = await GetJsonAuthorizedAsync(client, tutorToken, $"/api/workspaces/{workspaceSlug}/subscription");
        return json["aiCreditsRemaining"]!.GetValue<int>();
    }

    public static async Task<Guid> GetWorkspaceIdAsync(Platform.Infrastructure.PlatformDbContext db, string slug)
        => await db.Workspaces.Where(w => w.Slug == slug).Select(w => w.Id).SingleAsync();

    public static async Task<JsonObject> GetJsonAuthorizedAsync(HttpClient client, string token, string path)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, path);
        req.Headers.Authorization = new("Bearer", token);
        var res = await client.SendAsync(req);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<JsonObject>())!;
    }
}
