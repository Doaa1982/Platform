using Xunit;

// Each fixture applies its own database connection string via process
// environment variables (see TestEnvironmentVariables) because Program.cs
// reads required config before WebApplicationFactory's ConfigureAppConfiguration
// hook can apply — environment variables are process-wide, so two fixtures
// building their hosts at the same time would race and stomp each other's
// connection string. Serializing every test collection avoids that; this
// suite is small enough that the cost is negligible.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
