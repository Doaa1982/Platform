using Testcontainers.PostgreSql;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// Owns just the Postgres container, nothing else — for tests that need to
/// start the real ASP.NET Core host more than once against the same
/// database (proving bootstrap idempotency across what is effectively an
/// app restart), which <see cref="PlatformApiTestFixture"/>'s one-factory-
/// per-fixture shape doesn't support.
/// </summary>
public sealed class PostgresOnlyFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:17.6")
        .WithDatabase("platformdb")
        .WithUsername("postgres")
        .WithPassword("integration-test")
        .Build();

    public string ConnectionString => _postgres.GetConnectionString();

    public Task InitializeAsync() => _postgres.StartAsync();
    public Task DisposeAsync() => _postgres.StopAsync();
}
