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
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<Membership> Memberships => Set<Membership>();

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
            entity.Property(e => e.Status)
                  .HasConversion<string>()
                  .HasMaxLength(32);
        });

        modelBuilder.Entity<Workspace>(entity =>
        {
            entity.ToTable("workspaces");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Name)
                  .IsRequired()
                  .HasMaxLength(256);

            entity.Property(e => e.Slug)
                  .IsRequired()
                  .HasMaxLength(128);

            // Public identifier resolves to exactly one Workspace (INV-006 in spirit —
            // the Entry Point Registry proper is not yet implemented, see TD-006)
            entity.HasIndex(e => e.Slug).IsUnique();

            entity.Property(e => e.Description)
                  .HasMaxLength(2048);

            entity.Property(e => e.Status)
                  .HasConversion<string>()
                  .HasMaxLength(32);

            // Ownership Record → Owner MembershipId. Intentionally NOT a foreign key:
            // Workspace and Membership reference each other, and Workspace Aggregate
            // Design Section 17 requires reference-by-identifier only.
            entity.Property(e => e.OwnerMembershipId);
        });

        modelBuilder.Entity<Membership>(entity =>
        {
            entity.ToTable("memberships");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.IdentityId).IsRequired();
            entity.Property(e => e.WorkspaceId).IsRequired();

            // A person holds at most one Membership per Workspace
            entity.HasIndex(e => new { e.IdentityId, e.WorkspaceId }).IsUnique();

            // Lookup path for "which Workspaces does this Identity belong to?"
            entity.HasIndex(e => e.IdentityId);

            entity.Property(e => e.Status)
                  .HasConversion<string>()
                  .HasMaxLength(32);

            // Roles are an entity collection of this aggregate, reached through the
            // private _roles backing field rather than the read-only Roles property.
            entity.HasMany(e => e.Roles)
                  .WithOne()
                  .HasForeignKey(r => r.MembershipId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.Navigation(e => e.Roles)
                  .UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        modelBuilder.Entity<WorkspaceRole>(entity =>
        {
            entity.ToTable("workspace_roles");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Name)
                  .HasConversion<string>()
                  .HasMaxLength(32);

            // A Membership holds a given role at most once
            entity.HasIndex(e => new { e.MembershipId, e.Name }).IsUnique();
        });
    }
}
