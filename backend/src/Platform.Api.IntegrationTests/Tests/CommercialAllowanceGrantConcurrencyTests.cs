using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Domain;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Regression coverage for the AI-credit-grant race the live clean-environment
/// run found and this engagement fixed with an advisory lock in
/// LicensingService (V1 Launch Readiness Report, P0-1): a retried renewal or
/// a concurrent recompute call could previously grant a subscription period's
/// included credits twice.
/// </summary>
public class CommercialAllowanceGrantConcurrencyTests(PlatformApiTestFixture fixture) : IClassFixture<PlatformApiTestFixture>
{
    [Fact]
    public async Task Upgrade_Grants_The_Correct_Amount_Exactly_Once_And_Is_Historically_Auditable()
    {
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "grant-test-tutor@integrationtest.local", "grant-test-workspace");

        // solo-professional promises 20,000 included AI credits (CommercialCatalog.cs) —
        // plus the 200-credit trial grant every new workspace already received.
        var balanceAfterUpgrade = await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-professional");
        Assert.Equal(20_200, balanceAfterUpgrade);

        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, tutor.WorkspaceSlug);

        var grants = await db.CreditLedgerEntries
            .Where(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.SubscriptionGrant)
            .ToListAsync();
        var thisWorkspaceGrant = grants.Single(); // exactly one SubscriptionGrant for THIS workspace
        Assert.Equal(20_000, thisWorkspaceGrant.Amount);

        // Append-only / auditable: the pre-existing trial grant is still present, untouched.
        var trialGrants = await db.CreditLedgerEntries
            .Where(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.TrialGrant)
            .ToListAsync();
        Assert.Single(trialGrants);
        Assert.Equal(200, trialGrants[0].Amount);
    }

    [Fact]
    public async Task Concurrent_Recompute_Calls_Never_Double_Grant()
    {
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "concurrency-test-tutor@integrationtest.local", "concurrency-test-workspace");
        await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-professional");

        Guid workspaceId;
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, tutor.WorkspaceSlug);
            Assert.Equal(1, await db.CreditLedgerEntries.CountAsync(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.SubscriptionGrant));
        }

        var subscriptionId = tutor.SubscriptionId;

        // Fire the exact race the fix targets: N concurrent recompute calls
        // for the same subscription, the same request shape a retried
        // renewal webhook or a sweep racing an admin action would produce.
        var concurrentCalls = Enumerable.Range(0, 15).Select(async _ =>
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/subscriptions/{subscriptionId}/recompute-entitlements");
            req.Headers.Authorization = new("Bearer", adminToken);
            return await client.SendAsync(req);
        });
        var results = await Task.WhenAll(concurrentCalls);
        Assert.All(results, r => Assert.True(r.IsSuccessStatusCode));

        using var finalScope = fixture.Services.CreateScope();
        var finalDb = finalScope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var grantCount = await finalDb.CreditLedgerEntries.CountAsync(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.SubscriptionGrant);
        var grantTotal = await finalDb.CreditLedgerEntries
            .Where(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.SubscriptionGrant)
            .SumAsync(e => e.Amount);

        Assert.Equal(1, grantCount);
        Assert.Equal(20_000, grantTotal);
    }

    [Fact]
    public async Task Period_Renewal_Grants_A_New_Period_Once_While_Preserving_The_Previous_Periods_History()
    {
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "renewal-test-tutor@integrationtest.local", "renewal-test-workspace");
        await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-professional");

        // Simulate the period having elapsed — the same time-travel technique
        // the live manual run used, not a database repair covering up a
        // failure: it's the only way to test a month-long billing cycle
        // without waiting a month.
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var subscription = await db.Subscriptions.SingleAsync(s => s.Id == tutor.SubscriptionId);
            db.Entry(subscription).Property(nameof(Subscription.CurrentPeriodEnd)).CurrentValue = DateTime.UtcNow.AddDays(-1);
            await db.SaveChangesAsync();
        }

        using (var req = new HttpRequestMessage(HttpMethod.Post, "/api/admin/subscriptions/sweep-renewals"))
        {
            req.Headers.Authorization = new("Bearer", adminToken);
            var res = await client.SendAsync(req);
            Assert.True(res.IsSuccessStatusCode);
        }

        using var finalScope = fixture.Services.CreateScope();
        var finalDb = finalScope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(finalDb, tutor.WorkspaceSlug);
        var grants = await finalDb.CreditLedgerEntries
            .Where(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.SubscriptionGrant)
            .OrderBy(e => e.OccurredAtUtc)
            .ToListAsync();

        Assert.Equal(2, grants.Count); // original period + the renewed period, both present
        Assert.All(grants, g => Assert.Equal(20_000, g.Amount));
        Assert.NotEqual(grants[0].ExpiresAtUtc, grants[1].ExpiresAtUtc); // two genuinely distinct periods
    }
}
