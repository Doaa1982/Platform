using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Proves the production bootstrap (V1 Launch Readiness Report, P0-2) is
/// genuinely idempotent across separate app startups against the same
/// database — not just "doesn't throw once" but "running it twice never
/// duplicates the catalog or the first Platform Operator" — then proves the
/// bootstrapped state is actually enough for a real onboarding chain to
/// complete with zero manual database repair.
/// </summary>
public class ProductionBootstrapTests(PostgresOnlyFixture postgres) : IClassFixture<PostgresOnlyFixture>
{
    private const string AdminEmail = "admin@bootstraptest.local";
    private const string AdminPassword = "BootstrapTestAdmin!2026";

    [Fact]
    public async Task Bootstrap_Is_Idempotent_Across_Two_Separate_App_Startups()
    {
        // First "app startup" — genuinely empty database.
        await using (var first = new ApiHostFactory(postgres.ConnectionString, AdminEmail, AdminPassword))
        {
            using var client = first.CreateClient(); // forces the host (and its startup bootstrap) to actually build

            using var scope = first.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();

            Assert.True(await db.CommercialProducts.AnyAsync(), "Commercial catalog must exist after bootstrap.");
            Assert.True(await db.SkillCreditCosts.AnyAsync(), "AI skill pricing must exist after bootstrap.");
            Assert.Equal(1, await db.PlatformOperators.CountAsync());

            var operatorIdentityId = await db.PlatformOperators.Select(o => o.IdentityId).SingleAsync();
            Assert.True(await db.Identities.AnyAsync(i => i.Id == operatorIdentityId && i.Email == AdminEmail));
        }

        int productCountBefore, packCountBefore, skillCostCountBefore, operatorCountBefore;
        await using (var probe = new ApiHostFactory(postgres.ConnectionString, AdminEmail, AdminPassword))
        {
            using var _ = probe.CreateClient();
            using var scope = probe.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
            productCountBefore = await db.CommercialProducts.CountAsync();
            packCountBefore = await db.CommercialPacks.CountAsync();
            skillCostCountBefore = await db.SkillCreditCosts.CountAsync();
            operatorCountBefore = await db.PlatformOperators.CountAsync();
        }

        // Second, independent "app startup" against the exact same database —
        // the real-world equivalent of the process restarting.
        await using var second = new ApiHostFactory(postgres.ConnectionString, AdminEmail, AdminPassword);
        using (var client2 = second.CreateClient())
        {
            using var scope = second.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();

            Assert.Equal(productCountBefore, await db.CommercialProducts.CountAsync());
            Assert.Equal(packCountBefore, await db.CommercialPacks.CountAsync());
            Assert.Equal(skillCostCountBefore, await db.SkillCreditCosts.CountAsync());
            Assert.Equal(operatorCountBefore, await db.PlatformOperators.CountAsync()); // still exactly 1 — not re-granted
        }

        // And the bootstrapped state is actually sufficient for a brand-new
        // tutor to complete the full supported onboarding chain — no manual
        // database repair, no admin-UI catalog construction.
        using var finalClient = second.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(finalClient, AdminEmail, AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(finalClient, adminToken, "post-bootstrap-tutor@integrationtest.local", "post-bootstrap-workspace");

        var subscription = await TestOnboarding.GetJsonAuthorizedAsync(finalClient, tutor.Token, $"/api/workspaces/{tutor.WorkspaceSlug}/subscription");
        Assert.Equal("Active", subscription["status"]!.GetValue<string>());
        Assert.Equal("solo-free", subscription["planCode"]!.GetValue<string>());
    }
}
