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

    public async Task<CreditBalanceBreakdown> GetBalanceBreakdownAsync(Guid workspaceId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var entries = await db.CreditLedgerEntries.AsNoTracking()
            .Where(e => e.WorkspaceId == workspaceId && (e.ExpiresAtUtc == null || e.ExpiresAtUtc > now))
            .Select(e => new { e.EntryType, e.Amount })
            .ToListAsync(ct);

        var total = entries.Sum(e => e.Amount);
        var trialGranted = entries.Where(e => e.EntryType == CreditLedgerEntryType.TrialGrant).Sum(e => e.Amount);
        var consumedTotal = -entries.Where(e => e.EntryType == CreditLedgerEntryType.Consumption).Sum(e => e.Amount);

        // §A3's documented order spends Trial first — approximating that here
        // (not a precise per-entry attribution; see CreditBalanceBreakdown's
        // remarks) by assuming every debit so far came out of the trial grant
        // until it's exhausted. Also capped at `total`: an already-expired-by-
        // timer trial grant must not make TrialRemaining exceed what's actually
        // still in the live balance.
        var trialRemaining = Math.Clamp(trialGranted - consumedTotal, 0, Math.Min(trialGranted, Math.Max(total, 0)));

        return new CreditBalanceBreakdown(trialRemaining, total - trialRemaining, total);
    }

    public async Task ExpireTrialCreditsAsync(Guid workspaceId, CancellationToken ct = default)
    {
        var breakdown = await GetBalanceBreakdownAsync(workspaceId, ct);
        if (breakdown.TrialRemaining <= 0) return;

        var now = DateTime.UtcNow;
        // The compensating entry must expire alongside the trial grant(s) it
        // offsets — never null/permanent, or it would keep subtracting from
        // the balance forever, long after the original grant's own 30-day
        // timer would have zeroed it out on its own anyway (CreditLedgerEntry.Expire's
        // remarks). Latest ExpiresAtUtc among the still-unexpired TrialGrant
        // entries being revoked, in case more than one somehow exists.
        var trialExpiresAtUtc = await db.CreditLedgerEntries.AsNoTracking()
            .Where(e => e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.TrialGrant
                     && (e.ExpiresAtUtc == null || e.ExpiresAtUtc > now))
            .MaxAsync(e => (DateTime?)e.ExpiresAtUtc, ct);

        db.CreditLedgerEntries.Add(CreditLedgerEntry.Expire(workspaceId, breakdown.TrialRemaining, trialExpiresAtUtc));
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// How long a repeated <paramref name="idempotencyFingerprint"/> is still
    /// treated as "the same request, retried" rather than a genuine new
    /// charge. Long enough to cover a realistic client timeout-and-retry;
    /// short enough that a tutor deliberately re-running the same generation
    /// on unchanged content a few minutes later is charged normally.
    /// </summary>
    private static readonly TimeSpan IdempotencyWindow = TimeSpan.FromMinutes(3);

    public async Task<CreditDebitResult> TryDebitAsync(Guid workspaceId, string skillKey, int? band, CancellationToken ct = default, string? idempotencyFingerprint = null)
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

            // Serializes concurrent debits for the same workspace — without
            // this, two near-simultaneous requests (a workspace with just
            // enough balance for one call firing two AI requests in parallel)
            // can both read the same pre-commit balance, both pass the check
            // below, and both debit — driving the ledger negative (V1
            // Production Readiness Report, P1). Held only for this
            // transaction's lifetime and released automatically on commit or
            // rollback; hashtext() folds the workspace's Guid into the bigint
            // key pg_advisory_xact_lock requires. A different workspace hashes
            // to a different key (for all practical purposes) and is not
            // blocked by this one.
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtext({workspaceId.ToString()}))", ct);

            if (idempotencyFingerprint is not null)
            {
                var since = DateTime.UtcNow - IdempotencyWindow;
                var duplicate = await db.CreditLedgerEntries.AsNoTracking().FirstOrDefaultAsync(e =>
                    e.WorkspaceId == workspaceId && e.EntryType == CreditLedgerEntryType.Consumption
                    && e.IdempotencyFingerprint == idempotencyFingerprint && e.OccurredAtUtc >= since, ct);
                if (duplicate is not null)
                {
                    // Same logical request, already charged inside the retry
                    // window — the caller (AiOrchestrator) still runs the AI
                    // call so the client gets a real result, it just isn't
                    // charged for it a second time.
                    var currentBalance = await GetBalanceAsync(workspaceId, ct);
                    return new CreditDebitResult(Success: true, Cost: cost, RemainingBalance: currentBalance, LedgerEntryId: duplicate.Id);
                }
            }

            var balance = await GetBalanceAsync(workspaceId, ct);
            if (balance < cost)
                return new CreditDebitResult(Success: false, Cost: cost, RemainingBalance: balance, LedgerEntryId: null);

            var entry = CreditLedgerEntry.Debit(workspaceId, skillKey, cost, idempotencyFingerprint);
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
