namespace Platform.Domain;

/// <summary>
/// What granted or consumed a <see cref="CreditLedgerEntry"/> — Documents/
/// AICreditsCommercialContractAndImplementationPlan.md Phase 0. Trial/
/// Promotional/Subscription/Purchase and Refund are positive (grants);
/// Consumption is negative (spend); Expiration exists for a future explicit
/// compensating record (not yet written by anything — see
/// <see cref="CreditLedgerEntry"/>'s remarks on how expiry is enforced today).
/// </summary>
public enum CreditLedgerEntryType
{
    SubscriptionGrant, TrialGrant, PromotionalGrant, Purchase, Consumption, Refund, Expiration
}

/// <summary>
/// Credit Ledger Entry — Documents/AICreditsCommercialContractAndImplementationPlan.md
/// Phase 0. Append-only (USAGE-011: historical usage must remain auditable —
/// corrections are new Refund entries, never mutated rows). A workspace's AI
/// credit balance is never a mutable counter anywhere; it is always derived
/// by summing non-expired entries for that workspace
/// (<see cref="ICreditLedgerService.GetBalanceAsync"/>) — PACKAGING-010.
///
/// A3's consumption-order rule (Trial → Promotional → Subscription →
/// Purchased) and A9's per-type forfeiture-on-downgrade rule both need
/// per-type remaining-balance accounting to implement precisely; this pass
/// (Phase 0-3 of the plan doc, "make the existing promise real") only needs
/// a single derived total to gate on zero — full bucket-aware allocation is
/// left for the Phase 4 work the plan doc explicitly defers.
/// </summary>
public class CreditLedgerEntry
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public CreditLedgerEntryType EntryType { get; private set; }

    /// <summary>Signed: positive for a grant/refund, negative for a consumption entry.</summary>
    public int Amount { get; private set; }

    /// <summary>Set only on a Consumption entry — which AI skill spent it.</summary>
    public string? SkillKey { get; private set; }

    public DateTime OccurredAtUtc { get; private set; }

    /// <summary>
    /// Null = never expires (Purchased credits, per A4). An expired entry is
    /// never deleted or flagged — it simply stops counting toward the balance
    /// once <see cref="ExpiresAtUtc"/> passes, since the balance query
    /// already filters on it (this is what "insert-only, no mutable counter"
    /// means in practice: expiry is a query-time filter, not a write).
    /// </summary>
    public DateTime? ExpiresAtUtc { get; private set; }

    /// <summary>Set only on a SubscriptionGrant entry — which billing period it was granted for (A4: no rollover between periods).</summary>
    public Guid? BillingPeriodId { get; private set; }

    // Required by EF Core — not for application use
    private CreditLedgerEntry() { }

    /// <summary>A grant or refund — SubscriptionGrant, TrialGrant, PromotionalGrant, Purchase, or Refund. Always a positive amount.</summary>
    public static CreditLedgerEntry Grant(
        Guid workspaceId, CreditLedgerEntryType entryType, int amount,
        DateTime? expiresAtUtc, Guid? billingPeriodId = null)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Credit Ledger Entry belongs to exactly one Workspace.", nameof(workspaceId));
        if (entryType is CreditLedgerEntryType.Consumption or CreditLedgerEntryType.Expiration)
            throw new ArgumentException($"{entryType} is not a grant — use Debit for consumption.", nameof(entryType));
        if (amount <= 0)
            throw new ArgumentException("A grant amount must be positive.", nameof(amount));

        return new CreditLedgerEntry
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            EntryType = entryType,
            Amount = amount,
            OccurredAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = expiresAtUtc,
            BillingPeriodId = billingPeriodId,
        };
    }

    /// <summary>A Consumption entry — one AI skill call's spend. Always a negative amount.</summary>
    public static CreditLedgerEntry Debit(Guid workspaceId, string skillKey, int amount)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Credit Ledger Entry belongs to exactly one Workspace.", nameof(workspaceId));
        ArgumentException.ThrowIfNullOrWhiteSpace(skillKey);
        if (amount <= 0)
            throw new ArgumentException("A debit amount must be positive (the entry itself stores it negated).", nameof(amount));

        return new CreditLedgerEntry
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            EntryType = CreditLedgerEntryType.Consumption,
            Amount = -amount,
            SkillKey = skillKey,
            OccurredAtUtc = DateTime.UtcNow,
        };
    }
}
