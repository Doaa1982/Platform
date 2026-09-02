using Platform.Domain;

namespace Platform.Api.Services;

/// <summary>Outcome of one <see cref="ICreditLedgerService.TryDebitAsync"/> call — see that method's remarks.</summary>
public readonly record struct CreditDebitResult(bool Success, int Cost, int RemainingBalance, Guid? LedgerEntryId);

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
}
