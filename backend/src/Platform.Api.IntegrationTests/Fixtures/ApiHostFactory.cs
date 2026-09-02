using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Platform.Api.AI;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// A real ASP.NET Core host pointed at a caller-supplied connection string —
/// building a second instance of this against the same connection string a
/// first instance already used is exactly "the app restarts against the same
/// database", which is what proves bootstrap idempotency actually holds
/// across process lifetimes, not just within one already-warm host.
/// </summary>
public sealed class ApiHostFactory : WebApplicationFactory<Program>
{
    public ApiHostFactory(string connectionString, string adminEmail, string adminPassword)
    {
        // Must happen before the host is ever built — see
        // TestEnvironmentVariables' remarks. Safe from cross-fixture races
        // only because the assembly disables collection parallelism.
        TestEnvironmentVariables.Apply(connectionString, adminEmail, adminPassword);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IAiModelProvider>();
            services.AddSingleton<IAiModelProvider, FakeAiModelProvider>();
        });
    }
}
