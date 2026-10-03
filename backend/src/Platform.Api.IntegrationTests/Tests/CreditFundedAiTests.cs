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
public class CreditFundedAiTests(PlatformApiTestFixture fixture) : CreditFundedAiTestBase(fixture), IClassFixture<PlatformApiTestFixture>
{
    [Fact]
    public async Task Free_Plan_With_Gift_Credits_Can_Use_Branding_Ai_But_Not_Assessment_Ai()
    {
        var client = Fixture.CreateClient();
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
    public async Task Upgrading_Free_To_Essential_Keeps_The_Gift_Credits_And_Ai()
    {
        // Essential is paid but includes no AI credits: ending the trial here would switch AI off.
        var client = Fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-essential@integrationtest.local", "credit-ai-essential");
        var before = await TestOnboarding.GetAiCreditsRemainingAsync(client, tutor.Token, tutor.WorkspaceSlug);

        var after = await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-essential");

        Assert.Equal(before, after);
        Assert.Equal(before, await TrialRemainingAsync(client, tutor));
        var levels = await EntitlementsAsync(tutor.WorkspaceSlug);
        Assert.Equal("Assist", levels["ai:Learning"]);
        Assert.Equal("Foundation", levels["profile:Learning"]);
        Assert.Equal("Assist", levels["ai:Branding"]);
        Assert.Equal("Manual", levels["ai:Assessment"]);
        Assert.Equal(HttpStatusCode.OK, await SuggestDescriptionAsync(client, tutor));
    }

    [Fact]
    public async Task Upgrading_Free_To_Professional_Still_Ends_The_Trial()
    {
        // Professional brings its own monthly credits, so the trial ends at conversion as before (§A4).
        var client = Fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-pro@integrationtest.local", "credit-ai-pro");
        Assert.True(await TrialRemainingAsync(client, tutor) > 0);

        var after = await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-professional");

        Assert.Equal(0, await TrialRemainingAsync(client, tutor));
        Assert.True(after > 0);                                   // the plan's own credits
        Assert.Equal("Assist", (await EntitlementsAsync(tutor.WorkspaceSlug))["ai:Assessment"]);
    }

    [Fact]
    public async Task No_Credits_Means_No_Credit_Funded_Ai()
    {
        var client = Fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-empty@integrationtest.local", "credit-ai-empty");
        await ExpireAllCreditsAsync(tutor.WorkspaceSlug);
        await RecomputeAsync(tutor);

        var levels = await EntitlementsAsync(tutor.WorkspaceSlug);
        Assert.Equal("Manual", levels["ai:Branding"]);
        Assert.Equal("Manual", levels["ai:Learning"]);
        Assert.Equal(HttpStatusCode.Forbidden, await SuggestDescriptionAsync(client, tutor));
    }
}

/// <summary>
/// Credits re-resolve AI the moment they change — a purchase marked paid, or (as a safety net) the
/// lifecycle sweep for a grant that didn't. Its own class: each onboarding counts against the
/// signup rate limit, which a fixture (one app instance) shares across its tests.
/// </summary>
public class CreditRecomputeTests(PlatformApiTestFixture fixture) : CreditFundedAiTestBase(fixture), IClassFixture<PlatformApiTestFixture>
{
    [Fact]
    public async Task Bought_Credits_Work_As_Soon_As_The_Purchase_Is_Marked_Paid()
    {
        // A workspace at zero has its AI levels stored as Manual. Buying must be allowed, and marking
        // the purchase paid must turn AI back on at once, not at the next 15-minute sweep.
        var client = Fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-buy@integrationtest.local", "credit-ai-buy");
        await TestOnboarding.UpgradePlanAsync(client, adminToken, tutor.Token, tutor.WorkspaceSlug, "solo-essential");
        await ExpireAllCreditsAsync(tutor.WorkspaceSlug);
        await RecomputeAsync(tutor);
        Assert.Equal("Manual", (await EntitlementsAsync(tutor.WorkspaceSlug))["ai:Learning"]);

        using var buy = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{tutor.WorkspaceSlug}/credit-purchases");
        buy.Headers.Authorization = new("Bearer", tutor.Token);
        buy.Content = JsonContent.Create(new { creditPackCode = "credits-s" });
        var bought = await client.SendAsync(buy);
        Assert.Equal(HttpStatusCode.OK, bought.StatusCode);
        var orderId = (await bought.Content.ReadFromJsonAsync<System.Text.Json.Nodes.JsonObject>())!["id"]!.GetValue<Guid>();

        using var pay = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/credit-purchases/{orderId}/mark-paid");
        pay.Headers.Authorization = new("Bearer", adminToken);
        pay.Content = JsonContent.Create(new { referenceNote = "Integration test" });
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(pay)).StatusCode);

        var levels = await EntitlementsAsync(tutor.WorkspaceSlug);                 // no sweep in between
        Assert.Equal("Assist", levels["ai:Learning"]);
        Assert.Equal("Assist", levels["ai:Branding"]);
        Assert.Equal(HttpStatusCode.OK, await SuggestDescriptionAsync(client, tutor));
    }

    [Fact]
    public async Task The_Sweep_Only_Picks_Up_Workspaces_With_A_Credit_Change_Since_Their_Last_Recompute()
    {
        var client = Fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, "credit-ai-stale@integrationtest.local", "credit-ai-stale");

        // ai:Branding stored as Manual although the workspace has credits.
        using (var scope = Fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            var licenseId = await LicenseIdAsync(db, tutor.WorkspaceSlug);
            await db.Set<Entitlement>()
                .Where(e => e.LicenseId == licenseId && e.Key == "ai:Branding" && e.EffectiveUntil == null)
                .ExecuteUpdateAsync(u => u.SetProperty(e => e.Value, "Manual"));
        }

        // No credits added since the last recompute: not the sweep's business.
        await SweepAsync();
        Assert.Equal("Manual", (await EntitlementsAsync(tutor.WorkspaceSlug))["ai:Branding"]);

        // Credits added without a recompute (a grant path that forgot to): the sweep catches it, once.
        await GrantCreditsAsync(tutor, 50);
        Assert.True(await SweepAsync() >= 1);
        Assert.Equal("Assist", (await EntitlementsAsync(tutor.WorkspaceSlug))["ai:Branding"]);
        Assert.Equal(0, await SweepAsync());
        Assert.Equal(HttpStatusCode.OK, await SuggestDescriptionAsync(client, tutor));
    }
}

public abstract class CreditFundedAiTestBase(PlatformApiTestFixture fixture)
{
    protected PlatformApiTestFixture Fixture => fixture;

    // ── helpers ───────────────────────────────────────────────────────────────

    protected static Task<HttpStatusCode> SuggestDescriptionAsync(HttpClient client, TestOnboarding.OnboardedTutor tutor)
        => PostAsync(client, tutor, "setup/ai-suggest-description", new { name = $"{tutor.WorkspaceSlug} academy", courseCategories = new[] { "Math" } });

    protected static async Task<HttpStatusCode> PostAsync(HttpClient client, TestOnboarding.OnboardedTutor tutor, string path, object body)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{tutor.WorkspaceSlug}/{path}");
        req.Headers.Authorization = new("Bearer", tutor.Token);
        req.Content = JsonContent.Create(body);
        return (await client.SendAsync(req)).StatusCode;
    }

    protected async Task<Dictionary<string, string>> EntitlementsAsync(string slug)
    {
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var licenseId = await LicenseIdAsync(db, slug);
        return await db.Set<Entitlement>().AsNoTracking()
            .Where(e => e.LicenseId == licenseId && e.EffectiveUntil == null)
            .ToDictionaryAsync(e => e.Key, e => e.Value);
    }

    protected static async Task<Guid> LicenseIdAsync(PlatformDbContext db, string slug)
    {
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, slug);
        return await db.WorkspaceLicenses.Where(l => l.WorkspaceId == workspaceId).Select(l => l.Id).SingleAsync();
    }

    protected async Task ExpireAllCreditsAsync(string slug)
    {
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, slug);
        foreach (var entry in await db.CreditLedgerEntries.Where(e => e.WorkspaceId == workspaceId).ToListAsync())
            db.Entry(entry).Property("ExpiresAtUtc").CurrentValue = DateTime.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();
    }

    /// <summary>Straight into the ledger, with no recompute — what a grant path that forgot one would leave.</summary>
    protected async Task GrantCreditsAsync(TestOnboarding.OnboardedTutor tutor, int amount)
    {
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var workspaceId = await TestOnboarding.GetWorkspaceIdAsync(db, tutor.WorkspaceSlug);
        db.CreditLedgerEntries.Add(CreditLedgerEntry.Grant(
            workspaceId, CreditLedgerEntryType.PromotionalGrant, amount, expiresAtUtc: DateTime.UtcNow.AddDays(1)));
        await db.SaveChangesAsync();
    }

    protected async Task<int> SweepAsync()
    {
        using var scope = fixture.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<CommercialOpsService>().SweepStaleAiEntitlementsAsync();
    }

    protected static async Task<int> TrialRemainingAsync(HttpClient client, TestOnboarding.OnboardedTutor tutor)
    {
        var json = await TestOnboarding.GetJsonAuthorizedAsync(client, tutor.Token, $"/api/workspaces/{tutor.WorkspaceSlug}/subscription");
        return json["aiCreditsTrialRemaining"]!.GetValue<int>();
    }

    protected async Task RecomputeAsync(TestOnboarding.OnboardedTutor tutor)
    {
        using var scope = fixture.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<LicensingService>().RecomputeLicenseAsync(tutor.SubscriptionId);
    }
}
