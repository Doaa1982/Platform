using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Domain;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Regression coverage for the AI credit debit boundary (V1 Launch Readiness
/// Report): concurrent usage against a known, small allowance must never
/// overdraft, and every rejection must be a clean, structured error rather
/// than a silent failure or an inconsistent balance.
/// </summary>
public class AiUsageBoundaryTests(PlatformApiTestFixture fixture) : IClassFixture<PlatformApiTestFixture>
{
    private const string GenerateWorkspaceProfileSkillCost = "GenerateWorkspaceProfileSkill"; // 10 credits flat, seeded by Program.cs's bootstrap

    [Fact]
    public async Task Concurrent_Requests_Against_A_Small_Allowance_Never_Overdraft()
    {
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "boundary-test-tutor@integrationtest.local", "boundary-test-workspace");
        // Professional plan is what actually turns on ai:Branding (Assist),
        // which api/.../setup/ai-suggest-description requires.
        await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-professional");

        // Arrange a known, small, exact balance — the real-world equivalent
        // of "wait until a workspace has almost run out" without waiting.
        // Same technique the live manual run used (expire the large grants),
        // done here as an explicit, honest test fixture setup rather than to
        // paper over anything: the balance value asserted below is exactly
        // what was deliberately set up, nothing hidden.
        const int startingBalance = 95; // deliberately not a multiple of the 10-credit skill cost
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var workspaceId = await GetWorkspaceId(db, tutor.WorkspaceSlug);

            // Every existing entry, not just grants (Amount > 0): a free→paid
            // upgrade (UpgradePlanAsync, above) now also leaves a compensating
            // negative Expiration entry offsetting the trial grant (§A4,
            // CreditLedgerService.ExpireTrialCreditsAsync) — it carries the
            // same real expiry the trial grant it offsets had, so in actual
            // wall-clock time it would lapse alongside it, but rewinding only
            // the grants here and leaving that entry's still-future expiry
            // untouched would double-count the removal (its −200 would keep
            // subtracting from the "clean slate" this setup wants to establish).
            var existingEntries = await db.CreditLedgerEntries
                .Where(e => e.WorkspaceId == workspaceId)
                .ToListAsync();
            foreach (var entry in existingEntries)
                db.Entry(entry).Property("ExpiresAtUtc").CurrentValue = DateTime.UtcNow.AddSeconds(-1);

            db.CreditLedgerEntries.Add(CreditLedgerEntry.Grant(
                workspaceId, CreditLedgerEntryType.PromotionalGrant, startingBalance, expiresAtUtc: DateTime.UtcNow.AddDays(1)));
            await db.SaveChangesAsync();
        }

        var balanceBeforeCalls = await TestOnboarding.GetAiCreditsRemainingAsync(client, tutor.Token, tutor.WorkspaceSlug);
        Assert.Equal(startingBalance, balanceBeforeCalls);

        // 15 concurrent, genuinely distinct AI calls (unique content each,
        // so the retry-idempotency fingerprint never dedups any of them) —
        // at 10 credits each against a 95-credit balance, exactly 9 can
        // succeed and 6 must be cleanly rejected.
        var concurrentCalls = Enumerable.Range(0, 15).Select(async i =>
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{tutor.WorkspaceSlug}/setup/ai-suggest-description");
            req.Headers.Authorization = new("Bearer", tutor.Token);
            req.Content = JsonContent.Create(new { name = $"Boundary Test Workspace {i}", courseCategories = new[] { $"Topic{i}" } });
            var res = await client.SendAsync(req);
            return res.StatusCode;
        });
        var results = await Task.WhenAll(concurrentCalls);

        var successCount = results.Count(s => s == HttpStatusCode.OK);
        var rejectedCount = results.Count(s => s == HttpStatusCode.PaymentRequired);

        Assert.Equal(9, successCount);
        Assert.Equal(6, rejectedCount);
        Assert.Equal(15, successCount + rejectedCount); // every request got a definitive, clean outcome — nothing hung or errored unexpectedly

        var finalBalance = await TestOnboarding.GetAiCreditsRemainingAsync(client, tutor.Token, tutor.WorkspaceSlug);
        Assert.Equal(5, finalBalance); // 95 - (9 * 10) — exact, never negative

        using var finalScope = fixture.Services.CreateScope();
        var finalDb = finalScope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceIdFinal = await GetWorkspaceId(finalDb, tutor.WorkspaceSlug);
        var consumptionCount = await finalDb.CreditLedgerEntries
            .CountAsync(e => e.WorkspaceId == workspaceIdFinal && e.EntryType == CreditLedgerEntryType.Consumption);
        Assert.Equal(9, consumptionCount);
    }

    [Fact]
    public async Task Exhausted_Balance_Returns_A_Clean_Structured_Error()
    {
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "exhausted-test-tutor@integrationtest.local", "exhausted-test-workspace");
        await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-professional");

        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var workspaceId = await GetWorkspaceId(db, tutor.WorkspaceSlug);
            // All entries, not just grants — see the sibling test's comment on
            // why the compensating Expiration entry (§A4) needs the same treatment.
            var entries = await db.CreditLedgerEntries.Where(e => e.WorkspaceId == workspaceId).ToListAsync();
            foreach (var e in entries) db.Entry(e).Property("ExpiresAtUtc").CurrentValue = DateTime.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        }

        Assert.Equal(0, await TestOnboarding.GetAiCreditsRemainingAsync(client, tutor.Token, tutor.WorkspaceSlug));

        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{tutor.WorkspaceSlug}/setup/ai-suggest-description");
        req.Headers.Authorization = new("Bearer", tutor.Token);
        req.Content = JsonContent.Create(new { name = "Exhausted Test", courseCategories = Array.Empty<string>() });
        var res = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.PaymentRequired, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<System.Text.Json.Nodes.JsonObject>();
        Assert.Equal("credits_exhausted", body!["code"]!.GetValue<string>());
        Assert.Equal(0, body["remainingCredits"]!.GetValue<int>());
    }

    private static async Task<Guid> GetWorkspaceId(PlatformDbContext db, string slug)
        => await db.Workspaces.Where(w => w.Slug == slug).Select(w => w.Id).SingleAsync();
}
