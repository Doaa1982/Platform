using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Platform.Infrastructure;

/// <summary>
/// Design-time factory used only by the EF Core tools (`dotnet ef migrations …`).
///
/// Without this, the tools would have to boot the API host to find a DbContext,
/// which drags in Aspire service discovery and JWT configuration that do not
/// exist at design time. Migrations are generated from the model alone, so the
/// connection string here is never connected to — it only has to parse.
/// </summary>
public class PlatformDbContextFactory : IDesignTimeDbContextFactory<PlatformDbContext>
{
    public PlatformDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<PlatformDbContext>()
            .UseNpgsql("Host=localhost;Database=PlatformDB;Username=postgres")
            .Options;

        return new PlatformDbContext(options);
    }
}
