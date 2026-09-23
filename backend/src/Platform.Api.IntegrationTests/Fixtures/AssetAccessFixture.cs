using Microsoft.AspNetCore.Mvc.Testing;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// One Postgres and one <see cref="AssetAccessWorld"/> per test class, built
/// once — xUnit creates a new test-class instance per test, so the world can't
/// be built in the test class itself. Storage is the Local provider pointed at
/// a throwaway directory that is removed with the fixture.
/// </summary>
public sealed class AssetAccessFixture : PlatformApiTestFixture
{
    private readonly string _storageRoot = Path.Combine(Path.GetTempPath(), "platform-asset-access-" + Guid.NewGuid().ToString("N"));
    private WebApplicationFactory<Program>? _host;

    public WebApplicationFactory<Program> Host => _host!;
    public HttpClient Client { get; private set; } = null!;
    public AssetAccessWorld World { get; private set; } = null!;

    public override async Task InitializeAsync()
    {
        await base.InitializeAsync();
        _host = WithWebHostBuilder(b => b.UseSetting("Storage:LearningAssetsPath", _storageRoot));
        Client = _host.CreateClient();
        World = await AssetAccessWorld.BuildAsync(_host, Client, "aa-world");
    }

    protected override Task OnDisposingAsync()
    {
        Client?.Dispose();
        _host?.Dispose();
        if (Directory.Exists(_storageRoot)) Directory.Delete(_storageRoot, recursive: true);
        return Task.CompletedTask;
    }
}
