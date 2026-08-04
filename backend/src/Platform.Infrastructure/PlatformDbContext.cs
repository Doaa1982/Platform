using Microsoft.EntityFrameworkCore;
using Platform.Domain;

namespace Platform.Infrastructure;

/// <summary>
/// EF Core DbContext for the Platform.
/// Connection string is injected by .NET Aspire service discovery
/// via the "PlatformDB" resource name configured in Platform.AppHost.
/// </summary>
public class PlatformDbContext : DbContext
{
    public PlatformDbContext(DbContextOptions<PlatformDbContext> options) : base(options) { }

    public DbSet<Identity> Identities => Set<Identity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Identity>(entity =>
        {
            entity.ToTable("identities");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Email)
                  .IsRequired()
                  .HasMaxLength(256);

            // INV-002: Identity is globally unique — enforce at DB level
            entity.HasIndex(e => e.Email).IsUnique();

            entity.Property(e => e.PasswordHash)
                  .IsRequired();

            entity.Property(e => e.FullName)
                  .IsRequired()
                  .HasMaxLength(256);

            // Store enums as readable strings (not integers)
            entity.Property(e => e.Role)
                  .HasConversion<string>()
                  .HasMaxLength(32);

            entity.Property(e => e.Status)
                  .HasConversion<string>()
                  .HasMaxLength(32);
        });
    }
}
