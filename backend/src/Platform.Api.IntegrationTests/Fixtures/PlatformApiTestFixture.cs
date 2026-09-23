using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Platform.Api.AI;
using Testcontainers.PostgreSql;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// One real, isolated Postgres container (Testcontainers — genuinely
/// separate from any developer's own Aspire-managed database, never shares
/// a volume or a port with it) plus one real, in-process ASP.NET Core host
/// (<see cref="WebApplicationFactory{Program}"/> — the actual Program.cs
/// pipeline: real JWT bearer auth, real OnTokenValidated, real EF Core
/// against real Postgres, real startup bootstrap). Only the AI model
/// provider is swapped for <see cref="FakeAiModelProvider"/> — everything
/// else in this pipeline is exactly what runs in production.
///
/// Environment is deliberately NOT "Development": that gates a throwaway
/// demo-data seed this fixture doesn't want, and skips the exact
/// non-Development guards (Jwt key placeholder rejection, Cors
/// configuration, ...) a production-like test should actually exercise —
/// same reasoning as the manual clean-environment run this fixture
/// automates (V1 Launch Readiness Report).
/// </summary>
public class PlatformApiTestFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:17.6")
        .WithDatabase("platformdb")
        .WithUsername("postgres")
        .WithPassword("integration-test")
        .Build();

    public const string AdminEmail = "admin@integrationtest.local";
    public const string AdminPassword = "IntegrationTestAdmin!2026";

    public string ConnectionString => _postgres.GetConnectionString();

    public virtual async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        // Must happen before the host is ever built (CreateClient()/Services)
        // — see TestEnvironmentVariables' remarks. Safe from cross-fixture
        // races only because the assembly disables collection parallelism.
        TestEnvironmentVariables.Apply(ConnectionString, AdminEmail, AdminPassword);
    }

    /// <summary>Lets a derived fixture release what it built on top of this one before Postgres goes away.</summary>
    protected virtual Task OnDisposingAsync() => Task.CompletedTask;

    async Task IAsyncLifetime.DisposeAsync()
    {
        await OnDisposingAsync();
        await _postgres.StopAsync();
        await base.DisposeAsync();
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
