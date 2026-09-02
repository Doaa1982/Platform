namespace Platform.Domain.Tests;

/// <summary>
/// Licensing &amp; Entitlements §17 (LIC-007): entitlement history is
/// append-only. WorkspaceLicense.ReplaceEntitlements used to call
/// _entitlements.Clear() and re-add everything on every recompute, which
/// EF Core's owned-collection tracking turned into real DELETEs — these
/// tests pin the corrected behavior: an unchanged entitlement is left
/// alone, a changed one is closed (not removed) and a fresh row appended,
/// and a hygiene-only recompute that resolves to exactly what was already
/// current changes nothing at all.
/// </summary>
public class WorkspaceLicenseEntitlementHistoryTests
{
    private static WorkspaceLicense NewLicense() =>
        WorkspaceLicense.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

    private static ResolvedEntitlement Resolved(string key, string value, EntitlementSource source = EntitlementSource.BaseProduct) =>
        new(EntitlementType.Capacity, null, key, value, source, null);

    [Fact]
    public void FirstRecompute_AddsOneCurrentRowPerResolvedEntitlement()
    {
        var license = NewLicense();

        license.ReplaceEntitlements([Resolved("capacity:tutors", "2"), Resolved("capacity:learners", "20")]);

        Assert.Equal(2, license.Entitlements.Count);
        Assert.All(license.Entitlements, e => Assert.Null(e.EffectiveUntil));
    }

    [Fact]
    public void Recompute_WithIdenticalResolution_ChangesNothing()
    {
        var license = NewLicense();
        license.ReplaceEntitlements([Resolved("capacity:tutors", "2")]);
        var originalRow = license.Entitlements.Single();

        license.ReplaceEntitlements([Resolved("capacity:tutors", "2")]);

        // Same row, not closed-and-replaced — a hygiene-only recompute must
        // not grow the history when nothing actually changed.
        var current = Assert.Single(license.Entitlements);
        Assert.Same(originalRow, current);
        Assert.Null(current.EffectiveUntil);
    }

    [Fact]
    public void Recompute_WithChangedValue_ClosesTheOldRowAndAppendsANewOne_RatherThanDeletingIt()
    {
        var license = NewLicense();
        license.ReplaceEntitlements([Resolved("capacity:tutors", "2")]);
        var original = license.Entitlements.Single();

        license.ReplaceEntitlements([Resolved("capacity:tutors", "5")]);

        // LIC-007: the old row must still be present (closed), never removed.
        Assert.Contains(original, license.Entitlements);
        Assert.NotNull(original.EffectiveUntil);

        var current = license.Entitlements.Single(e => e.EffectiveUntil is null);
        Assert.Equal("5", current.Value);
        Assert.Equal(2, license.Entitlements.Count);
    }

    [Fact]
    public void Recompute_WithNoLongerResolvedKey_ClosesItAndAddsNothingNew()
    {
        var license = NewLicense();
        license.ReplaceEntitlements([Resolved("capacity:tutors", "2")]);
        var original = license.Entitlements.Single();

        // e.g. the license just became Restricted/Expired — nothing resolves anymore.
        license.ReplaceEntitlements([]);

        Assert.Contains(original, license.Entitlements);
        Assert.NotNull(original.EffectiveUntil);
        Assert.DoesNotContain(license.Entitlements, e => e.EffectiveUntil is null);
    }

    [Fact]
    public void Recompute_TracksMultipleKeysIndependently()
    {
        var license = NewLicense();
        license.ReplaceEntitlements([Resolved("capacity:tutors", "2"), Resolved("capacity:learners", "20")]);
        var tutorsRow = license.Entitlements.Single(e => e.Key == "capacity:tutors");

        // Only learners changes; tutors must be left untouched.
        license.ReplaceEntitlements([Resolved("capacity:tutors", "2"), Resolved("capacity:learners", "50")]);

        Assert.Same(tutorsRow, license.Entitlements.Single(e => e.Key == "capacity:tutors" && e.EffectiveUntil is null));
        Assert.Equal(3, license.Entitlements.Count); // tutors (unchanged) + learners closed + learners current
    }
}
