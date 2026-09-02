namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// Program.cs reads several required settings (Jwt:Key, ConnectionStrings:PlatformDB,
/// ...) directly off <c>builder.Configuration</c> BEFORE <c>builder.Build()</c>
/// is ever called — <see cref="WebApplicationFactory{Program}.ConfigureWebHost"/>'s
/// <c>ConfigureAppConfiguration</c> hook applies too late to be visible to
/// those early reads for a minimal-hosting (top-level-statement) app like
/// this one. Environment variables are read synchronously as part of
/// <c>WebApplication.CreateBuilder(args)</c> itself, so setting them in the
/// real OS process environment before the host is ever built — the same
/// mechanism the actual manual clean-environment run used — is what actually
/// works, not an in-memory config source.
/// </summary>
public static class TestEnvironmentVariables
{
    public static void Apply(string connectionString, string adminEmail, string adminPassword)
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "IntegrationTesting");
        Environment.SetEnvironmentVariable("ConnectionStrings__PlatformDB", connectionString);
        Environment.SetEnvironmentVariable("Jwt__Key", "integration-test-signing-key-at-least-32-chars!!");
        Environment.SetEnvironmentVariable("Jwt__Issuer", "platform-api");
        Environment.SetEnvironmentVariable("Jwt__Audience", "platform-client");
        Environment.SetEnvironmentVariable("Cors__AllowedOrigins__0", "http://localhost");
        Environment.SetEnvironmentVariable("Email__Enabled", "false");
        Environment.SetEnvironmentVariable("InitialPlatformOperator__Email", adminEmail);
        Environment.SetEnvironmentVariable("InitialPlatformOperator__Password", adminPassword);
    }
}
