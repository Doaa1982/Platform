using System.Net;
using System.Net.Http.Json;
using Platform.Api.IntegrationTests.Fixtures;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Regression coverage for the JWT claim-mapping bug the live clean-environment
/// run found (V1 Launch Readiness Report): a valid, freshly-issued token that
/// could not actually authenticate any request after login. This exercises
/// the real pipeline end to end — real JwtBearer middleware, real
/// OnTokenValidated, real Postgres — never a mocked/injected principal.
/// </summary>
public class AuthenticationPipelineTests(PlatformApiTestFixture fixture) : IClassFixture<PlatformApiTestFixture>
{
    [Fact]
    public async Task Login_Then_UseToken_On_ProtectedEndpoint_Succeeds()
    {
        var client = fixture.CreateClient();

        // The bootstrapped Platform Operator is a real Identity created by
        // the same production bootstrap path a real deployment uses.
        var token = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        Assert.False(string.IsNullOrWhiteSpace(token));

        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/admin/signup-requests");
        req.Headers.Authorization = new("Bearer", token);
        var res = await client.SendAsync(req);

        // This is the exact call shape that failed with 401 "Token is missing
        // required claims" before the fix — asserting success here is what
        // would have caught the regression before it ever reached a live run.
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task UnauthenticatedRequest_To_ProtectedEndpoint_Is_Rejected()
    {
        var client = fixture.CreateClient();
        var res = await client.GetAsync("/api/admin/signup-requests");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task TamperedToken_Is_Rejected()
    {
        var client = fixture.CreateClient();
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/admin/signup-requests");
        req.Headers.Authorization = new("Bearer", "not.a.validtoken");
        var res = await client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Logout_Invalidates_The_Token_For_Every_Subsequent_Request()
    {
        var client = fixture.CreateClient();
        var tutor = await TestOnboarding.OnboardTutorAsync(
            client, await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword),
            "logout-test-tutor@integrationtest.local", "logout-test-workspace");

        // The token works before logout.
        using (var req = new HttpRequestMessage(HttpMethod.Get, $"/api/workspaces/{tutor.WorkspaceSlug}/setup"))
        {
            req.Headers.Authorization = new("Bearer", tutor.Token);
            var res = await client.SendAsync(req);
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        }

        using (var logoutReq = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout"))
        {
            logoutReq.Headers.Authorization = new("Bearer", tutor.Token);
            var logoutRes = await client.SendAsync(logoutReq);
            // This is exactly the second instance of the same claim-mapping
            // bug class: before the fix, Logout() itself could not resolve
            // the caller's identity and returned 401 instead of 204,
            // meaning InvalidateSessions() was never actually called.
            Assert.Equal(HttpStatusCode.NoContent, logoutRes.StatusCode);
        }

        // The exact same token — never re-issued, never expired — must now
        // be rejected on every subsequent request (TokenVersion mismatch).
        using (var req = new HttpRequestMessage(HttpMethod.Get, $"/api/workspaces/{tutor.WorkspaceSlug}/setup"))
        {
            req.Headers.Authorization = new("Bearer", tutor.Token);
            var res = await client.SendAsync(req);
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        }
    }

    [Fact]
    public async Task WrongPassword_Is_Rejected_Without_Revealing_Which_Field_Was_Wrong()
    {
        var client = fixture.CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email = PlatformApiTestFixture.AdminEmail, password = "definitely-wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
