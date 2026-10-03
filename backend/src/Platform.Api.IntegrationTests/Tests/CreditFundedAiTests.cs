using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Platform.Domain;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// EntitlementResolutionService.CreditFundedAiDomains: on any plan, while a workspace has AI
/// credits, Learning and Branding AI are on (Assist) — the welcome gift's credits work for lesson
/// content and branding text without a paid plan. Only the AI level moves; the capability profile
/// stays the plan's, Assessment AI still follows the plan, and no credits means no AI.
/// </summary>
public class CreditFundedAiTests(PlatformApiTestFixture fixture) : IClassFixture<PlatformApiTestFixture>
{
    [Fact]
    public async Task Free_Plan_With_Gift_Credits_Can_Use_Branding_Ai_But_Not_Assessment_Ai()
    {
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-free@integrationtest.local", "credit-ai-free");
        Assert.True(await TestOnboarding.GetAiCreditsRemainingAsync(client, tutor.Token, tutor.WorkspaceSlug) > 0);

        var levels = await EntitlementsAsync(tutor.WorkspaceSlug);
        Assert.Equal("Assist", levels["ai:Branding"]);
        Assert.Equal("Foundation", levels["profile:Branding"]);   // the plan's profile is untouched
        Assert.Equal("Assist", levels["ai:Learning"]);
        Assert.Equal("Manual", levels["ai:Assessment"]);         // not credit-funded: still the plan's

        // The production report: this returned 403 on Free with the gift's credits.
        Assert.Equal(HttpStatusCode.OK, await SuggestDescriptionAsync(client, tutor));
        Assert.Equal(HttpStatusCode.OK, await PostAsync(client, tutor, "setup/ai-suggest-welcome", new { name = "Credit AI Free", description = "Math", courseCategories = new[] { "Math" } }));
    }

    [Fact]
    public async Task Essential_Plan_Gets_The_Same_Credit_Funded_Ai_As_Free()
    {
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-essential@integrationtest.local", "credit-ai-essential");
        await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-essential");
        await GrantCreditsAndRecomputeAsync(tutor, 100);

        var levels = await EntitlementsAsync(tutor.WorkspaceSlug);
        Assert.Equal("Assist", levels["ai:Learning"]);
        Assert.Equal("Foundation", levels["profile:Learning"]);
        Assert.Equal("Assist", levels["ai:Branding"]);
        Assert.Equal("Manual", levels["ai:Assessment"]);
        Assert.Equal(HttpStatusCode.OK, await SuggestDescriptionAsync(client, tutor));
    }

    [Fact]
    public async Task No_Credits_Means_No_Credit_Funded_Ai()
    {
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-empty@integrationtest.local", "credit-ai-empty");
        await ExpireAllCreditsAsync(tutor.WorkspaceSlug);
        await RecomputeAsync(tutor);

        var levels = await EntitlementsAsync(tutor.WorkspaceSlug);
        Assert.Equal("Manual", levels["ai:Branding"]);
        Assert.Equal("Manual", levels["ai:Learning"]);
        Assert.Equal(HttpStatusCode.Forbidden, await SuggestDescriptionAsync(client, tutor));
    }

    [Fact]
    public async Task A_Workspace_Out_Of_Credits_Can_Still_Buy_More()
    {
        // Upgrading Free → Essential ends the trial credits, and Essential includes none: before this
        // change every AI level was Manual here and the purchase was refused, so AI could never return.
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-buy@integrationtest.local", "credit-ai-buy");
        await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-essential");
        await ExpireAllCreditsAsync(tutor.WorkspaceSlug);
        await RecomputeAsync(tutor);
        Assert.Equal("Manual", (await EntitlementsAsync(tutor.WorkspaceSlug))["ai:Learning"]);

        Assert.Equal(HttpStatusCode.OK, await PostAsync(client, tutor, "credit-purchases", new { creditPackCode = "credits-s" }));
    }

    [Fact]
    public async Task The_Sweep_Refreshes_Workspaces_Resolved_Before_The_Rule_Existed()
    {
        var client = fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-stale@integrationtest.local", "credit-ai-stale");

        // What an existing production workspace looks like before the deploy: credits in hand,
        // but ai:Branding materialized as Manual by the old resolution.
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var licenseId = await LicenseIdAsync(db, tutor.WorkspaceSlug);
            await db.Set<Entitlement>()
                .Where(e => e.LicenseId == licenseId && e.Key == "ai:Branding" && e.EffectiveUntil == null)
                .ExecuteUpdateAsync(u => u.SetProperty(e => e.Value, "Manual"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, await SuggestDescriptionAsync(client, tutor));

        using (var scope = fixture.Services.CreateScope())
        {
            var ops = scope.ServiceProvider.GetRequiredService<CommercialOpsService>();
            Assert.True(await ops.SweepStaleAiEntitlementsAsync() >= 1);
            Assert.Equal(0, await ops.SweepStaleAiEntitlementsAsync());   // nothing left to pick up the second time round
        }

        Assert.Equal("Assist", (await EntitlementsAsync(tutor.WorkspaceSlug))["ai:Branding"]);
        Assert.Equal(HttpStatusCode.OK, await SuggestDescriptionAsync(client, tutor));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static Task<HttpStatusCode> SuggestDescriptionAsync(HttpClient client, TestOnboarding.OnboardedTutor tutor)
        => PostAsync(client, tutor, "setup/ai-suggest-description", new { name = $"{tutor.WorkspaceSlug} academy", courseCategories = new[] { "Math" } });

    private static async Task<HttpStatusCode> PostAsync(HttpClient client, TestOnboarding.OnboardedTutor tutor, string path, object body)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{tutor.WorkspaceSlug}/{path}");
        req.Headers.Authorization = new("Bearer", tutor.Token);
        req.Content = JsonContent.Create(body);
        return (await client.SendAsync(req)).StatusCode;
    }

    private async Task<Dictionary<string, string>> EntitlementsAsync(string slug)
    {
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var licenseId = await LicenseIdAsync(db, slug);
        return await db.Set<Entitlement>().AsNoTracking()
            .Where(e => e.LicenseId == licenseId && e.EffectiveUntil == null)
            .ToDictionaryAsync(e => e.Key, e => e.Value);
    }

    private static async Task<Guid> LicenseIdAsync(PlatformDbContext db, string slug)
    {
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, slug);
        return await db.WorkspaceLicenses.Where(l => l.WorkspaceId == workspaceId).Select(l => l.Id).SingleAsync();
    }

    private async Task ExpireAllCreditsAsync(string slug)
    {
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, slug);
        foreach (var entry in await db.CreditLedgerEntries.Where(e => e.WorkspaceId == workspaceId).ToListAsync())
            db.Entry(entry).Property("ExpiresAtUtc").CurrentValue = DateTime.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();
    }

    private async Task GrantCreditsAndRecomputeAsync(TestOnboarding.OnboardedTutor tutor, int amount)
    {
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, tutor.WorkspaceSlug);
            db.CreditLedgerEntries.Add(CreditLedgerEntry.Grant(
                workspaceId, CreditLedgerEntryType.PromotionalGrant, amount, expiresAtUtc: DateTime.UtcNow.AddDays(1)));
            await db.SaveChangesAsync();
        }
        await RecomputeAsync(tutor);
    }

    private async Task RecomputeAsync(TestOnboarding.OnboardedTutor tutor)
    {
        using var scope = fixture.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<LicensingService>().RecomputeLicenseAsync(tutor.SubscriptionId);
    }
}
