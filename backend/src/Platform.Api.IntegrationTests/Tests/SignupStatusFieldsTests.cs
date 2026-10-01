using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Platform.Api.IntegrationTests.Fixtures;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// The applicant's status page words each state itself, in the reader's language, from these
/// fields instead of the English Headline/Detail — so they must say exactly what Headline/Detail do.
/// </summary>
public class SignupStatusFieldsTests(PlatformApiTestFixture fixture) : IClassFixture<PlatformApiTestFixture>
{
    private static async Task<(Guid RequestId, string Token)> ApplyAsync(HttpClient client, string email)
    {
        var res = await client.PostAsJsonAsync("/api/signup-requests", new { fullName = "Sara Ahmed", email, about = "x" });
        res.EnsureSuccessStatusCode();
        var body = (await res.Content.ReadFromJsonAsync<JsonObject>())!;
        return (body["requestId"]!.GetValue<Guid>(), body["statusLink"]!.GetValue<string>().Split('/').Last());
    }

    private static async Task<JsonObject> StatusAsync(HttpClient client, string token) =>
        (await client.GetFromJsonAsync<JsonObject>($"/api/signup-requests/status/{token}"))!;

    private static async Task AdminPostAsync(HttpClient client, string adminToken, string path, object? body = null)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, path);
        req.Headers.Authorization = new("Bearer", adminToken);
        if (body is not null) req.Content = JsonContent.Create(body);
        (await client.SendAsync(req)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Under_review_is_neither_ready_nor_rejected()
    {
        var client = fixture.CreateClient();
        var (_, token) = await ApplyAsync(client, "ssf-review@integrationtest.local");

        var status = await StatusAsync(client, token);

        Assert.Equal("UnderReview", status["status"]!.GetValue<string>());
        Assert.False(status["workspaceReady"]!.GetValue<bool>());
        Assert.Null(status["rejectionReason"]);
    }

    [Fact]
    public async Task Approved_is_ready_only_once_a_workspace_is_provisioned()
    {
        var client = fixture.CreateClient();
        var admin = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var (id, token) = await ApplyAsync(client, "ssf-ready@integrationtest.local");

        await AdminPostAsync(client, admin, $"/api/admin/signup-requests/{id}/approve");
        Assert.False((await StatusAsync(client, token))["workspaceReady"]!.GetValue<bool>());

        await AdminPostAsync(client, admin, $"/api/admin/signup-requests/{id}/provision",
            new { name = "ssf-ready", slug = "ssf-ready", ownerEmail = "ssf-ready@integrationtest.local", description = "x" });
        var status = await StatusAsync(client, token);
        Assert.True(status["workspaceReady"]!.GetValue<bool>());
        Assert.Equal("Your workspace is ready", status["headline"]!.GetValue<string>());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task A_rejection_reason_is_shared_only_when_the_reviewer_chose_to(bool visible)
    {
        var client = fixture.CreateClient();
        var admin = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var (id, token) = await ApplyAsync(client, $"ssf-reject-{visible}@integrationtest.local");

        await AdminPostAsync(client, admin, $"/api/admin/signup-requests/{id}/reject",
            new { reason = "We're only onboarding math tutors this term.", reasonVisible = visible });

        var status = await StatusAsync(client, token);
        Assert.Equal("Rejected", status["status"]!.GetValue<string>());
        if (visible) Assert.Equal("We're only onboarding math tutors this term.", status["rejectionReason"]!.GetValue<string>());
        else Assert.Null(status["rejectionReason"]);
    }
}
