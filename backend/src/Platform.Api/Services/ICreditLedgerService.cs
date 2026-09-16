using Platform.Domain;

namespace Platform.Api.Services;

/// <summary>Outcome of one <see cref="ICreditLedgerService.TryDebitAsync"/> call — see that method's remarks.</summary>
public readonly record struct CreditDebitResult(bool Success, int Cost, int RemainingBalance, Guid? LedgerEntryId);

/// <summary>
/// A workspace's live balance split into "trial" vs "everything else" —
/// deliberately just two buckets, not full per-type (Trial/Promotional/
/// Subscription/Purchased) accounting, since nothing else in this codebase
/// attributes a Consumption entry to which grant funded it either
/// (<see cref="CreditLedgerEntry"/>'s own remarks defer that to "Phase 4").
/// <see cref="TrialRemaining"/> assumes trial credits are spent first (§A3's
/// documented consumption order), so it's an approximation good enough to
/// gate A4's early-expiry rule and to explain a balance to a tutor — not a
/// precise ledger of which bucket funded which historical debit.
/// <see cref="TrialRemaining"/> + <see cref="OtherRemaining"/> always equals
/// <see cref="Total"/>.
/// </summary>
public readonly record struct CreditBalanceBreakdown(int TrialRemaining, int OtherRemaining, int Total);

/// <summary>
/// The AI Credit balance/debit boundary — Documents/
/// AICreditsCommercialContractAndImplementationPlan.md Phase 1. A workspace's
/// balance is always derived (sum of non-expired <see cref="CreditLedgerEntry"/>
/// rows), never a mutable counter (PACKAGING-010).
/// </summary>
public interface ICreditLedgerService
{
    /// <summary>Sum of this workspace's non-expired ledger entries. 0 for a workspace with no ledger activity at all (not an error).</summary>
    Task<int> GetBalanceAsync(Guid workspaceId, CancellationToken ct = default);

    /// <summary>Same total as <see cref="GetBalanceAsync"/>, split into trial vs. everything else — see <see cref="CreditBalanceBreakdown"/>.</summary>
    Task<CreditBalanceBreakdown> GetBalanceBreakdownAsync(Guid workspaceId, CancellationToken ct = default);

    /// <summary>
    /// A4's "at first paid conversion, whichever comes first": writes a
    /// compensating <see cref="CreditLedgerEntryType.Expiration"/> entry
    /// zeroing out whatever trial-credit balance remains right now (per
    /// <see cref="CreditBalanceBreakdown.TrialRemaining"/>), rather than
    /// waiting for the grant's own 30-day <see cref="CreditLedgerEntry.ExpiresAtUtc"/>
    /// timer. No-op (writes nothing) if no trial balance remains.
    /// </summary>
    Task ExpireTrialCreditsAsync(Guid workspaceId, CancellationToken ct = default);

    /// <summary>
    /// Atomic check-then-debit for one AI skill call (§A6 — no reservation
    /// state machine; every skill in scope is flat or banded, so the price is
    /// fully known up front). <paramref name="band"/> is the skill's own size
    /// signal for a banded skill (e.g. open-answer count, page count) — null
    /// for a flat-priced skill. Returns <c>Success: false</c> rather than
    /// throwing when the balance is insufficient; the caller (AiOrchestrator)
    /// decides what that means for its own callers.
    ///
    /// <paramref name="idempotencyFingerprint"/> (optional): if a Consumption
    /// entry with the same fingerprint for this workspace was recorded within
    /// the last few minutes, this call succeeds without writing a second
    /// debit — protects a client that never received the original response
    /// (a timeout, a dropped connection) and retries the identical logical
    /// request from paying twice for it.
    /// </summary>
    Task<CreditDebitResult> TryDebitAsync(Guid workspaceId, string skillKey, int? band, CancellationToken ct = default, string? idempotencyFingerprint = null);

    /// <summary>Writes a compensating Refund entry for a prior Consumption entry — used when the provider call after a successful debit still fails.</summary>
    Task RefundAsync(Guid ledgerEntryId, CancellationToken ct = default);

    /// <summary>
    /// Read-only lookup of a skill's current price (same resolution
    /// TryDebitAsync uses internally) — null if nothing is priced for this
    /// (skillKey, band). For a caller that queues an AI call onto a
    /// background job rather than running it inline (e.g. transcript
    /// enhancement): lets it fail fast with a normal, structured
    /// credits-exhausted response before ever queuing the job, instead of
    /// only discovering insufficient balance deep inside that job. This is a
    /// best-effort pre-check, not a reservation — the workspace's balance can
    /// still change between this call and the job's own TryDebitAsync, which
    /// remains the sole atomic, authoritative charge.
    /// </summary>
    Task<int?> GetCurrentCostAsync(string skillKey, int? band, CancellationToken ct = default);
}
