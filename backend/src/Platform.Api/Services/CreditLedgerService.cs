using Microsoft.EntityFrameworkCore;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.Services;

/// <summary>
/// Documents/AICreditsCommercialContractAndImplementationPlan.md Phase 1.
/// Balance is always derived (sum of non-expired <see cref="CreditLedgerEntry"/>
/// rows) — never a mutable counter (PACKAGING-010). §A6: no reservation state
/// machine — every skill in scope is flat or banded, so <see cref="TryDebitAsync"/>
/// does one atomic check-then-debit in a single DB transaction instead.
/// </summary>
public class CreditLedgerService(PlatformDbContext db) : ICreditLedgerService
{
    /// <summary>
    /// A banded skill's top tier has no natural upper bound (e.g. "31+ open
    /// answers") — seeded with this sentinel instead of a null Band, so
    /// "null Band" can mean exactly one thing everywhere in this service:
    /// a flat-priced skill.
    /// </summary>
    public const int UnboundedBand = int.MaxValue;

    public async Task<int> GetBalanceAsync(Guid workspaceId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        return await db.CreditLedgerEntries
            .Where(e => e.WorkspaceId == workspaceId && (e.ExpiresAtUtc == null || e.ExpiresAtUtc > now))
            .SumAsync(e => (int?)e.Amount, ct) ?? 0;
    }

    public async Task<CreditDebitResult> TryDebitAsync(Guid workspaceId, string skillKey, int? band, CancellationToken ct = default)
    {
        var cost = await ResolveCostAsync(skillKey, band, ct)
            ?? throw new InvalidOperationException($"No SkillCreditCost is priced for \"{skillKey}\" (band: {band?.ToString() ?? "flat"}).");

        // PlatformDbContext is configured with EnableRetryOnFailure, which
        // registers a retrying execution strategy — that strategy forbids a
        // plain `BeginTransactionAsync` (a retried attempt could otherwise
        // silently double-debit), so the transaction has to run inside
        // CreateExecutionStrategy().ExecuteAsync instead, the pattern EF
        // Core itself requires whenever retry-on-failure is enabled.
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            var balance = await GetBalanceAsync(workspaceId, ct);
            if (balance < cost)
                return new CreditDebitResult(Success: false, Cost: cost, RemainingBalance: balance, LedgerEntryId: null);

            var entry = CreditLedgerEntry.Debit(workspaceId, skillKey, cost);
            db.CreditLedgerEntries.Add(entry);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return new CreditDebitResult(Success: true, Cost: cost, RemainingBalance: balance - cost, LedgerEntryId: entry.Id);
        });
    }

    public async Task RefundAsync(Guid ledgerEntryId, CancellationToken ct = default)
    {
        var original = await db.CreditLedgerEntries.AsNoTracking().FirstOrDefaultAsync(e => e.Id == ledgerEntryId, ct)
            ?? throw new InvalidOperationException("No such ledger entry.");
        if (original.EntryType != CreditLedgerEntryType.Consumption)
            throw new InvalidOperationException("Only a Consumption entry can be refunded.");

        // original.Amount is negative (a debit) — negate it back to a positive grant.
        var refund = CreditLedgerEntry.Grant(original.WorkspaceId, CreditLedgerEntryType.Refund, -original.Amount, expiresAtUtc: null);
        db.CreditLedgerEntries.Add(refund);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The current (latest EffectiveFrom not in the future) price for a
    /// skill. For a banded skill, picks the smallest seeded Band that is
    /// &gt;= the caller's own band size — e.g. 12 open answers lands on the
    /// "&lt;=30" row, not the "&lt;=10" one.
    /// </summary>
    private async Task<int?> ResolveCostAsync(string skillKey, int? band, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var candidates = await db.SkillCreditCosts.AsNoTracking()
            .Where(c => c.SkillKey == skillKey && c.EffectiveFrom <= now)
            .ToListAsync(ct);
        if (candidates.Count == 0) return null;

        // Current version per (SkillKey, Band) — latest EffectiveFrom wins, same "pin the
        // most recent published row" idea CommercialProductVersion's own versioning uses.
        var current = candidates
            .GroupBy(c => c.Band)
            .Select(g => g.OrderByDescending(c => c.EffectiveFrom).First())
            .ToList();

        var flat = current.FirstOrDefault(c => c.Band is null);
        if (flat is not null) return flat.CreditCost;

        var requested = band ?? UnboundedBand;
        return current
            .Where(c => c.Band is { } b && b >= requested)
            .OrderBy(c => c.Band)
            .FirstOrDefault()?.CreditCost
            ?? current.OrderByDescending(c => c.Band).First().CreditCost; // requested exceeds every finite band — fall back to the top tier
    }
}
