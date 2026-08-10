namespace Platform.Domain;

/// <summary>
/// Subscription Aggregate Root — Subscription Management Architecture.
///
/// State machine uses the 8-state list ratified in Commercial Domain V1
/// Scope §2.3 (Draft, Pending, Active, PastDue, Grace, Suspended, Cancelled,
/// Expired) — not the longer 10-state list still in
/// SubscriptionManagementArchitecture.md §8, which includes Paused/Terminated;
/// Pause/Resume is explicitly deferred to Phase 2 (Decision Brief #4) and that
/// document was never trimmed to match.
///
/// Per the 2026-08-09 correction ("this platform does not collect payment"),
/// nothing here transitions on a payment-provider webhook. <see cref="Activate"/>
/// is called by an authorized Platform Operator after manually marking an
/// Invoice paid (SubscriptionManagementArchitecture.md §27a, "Manual
/// Commercial Activation") — see <see cref="SubscriptionEvent"/> for the audit
/// record of who did that and why. <see cref="RecordOverdueInvoice"/> is
/// triggered by an Invoice's due date passing unpaid, not a failed charge (§29,
/// "Overdue Invoice," formerly "Payment Failure").
/// </summary>
public class Subscription
{
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid BillingAccountId { get; private set; }
    public Guid CurrentConfigurationSnapshotId { get; private set; }
    public SubscriptionStatus Status { get; private set; }
    public BillingCycle BillingCycle { get; private set; }
    public DateTime StartDate { get; private set; }
    public DateTime CurrentPeriodEnd { get; private set; }
    public DateTime RenewalDate { get; private set; }
    public DateTime? CancellationEffectiveDate { get; private set; }

    /// <summary>
    /// §14 (Scheduled Subscription Changes) / §17-18 (Downgrade, Downgrade
    /// Safety): a Downgrade is scheduled for the next billing period rather
    /// than applied immediately, mirroring how <see cref="CancellationEffectiveDate"/>
    /// already defers Cancel's effect. Both null when no change is pending.
    /// Impact Analysis (whether current usage fits the target plan) is
    /// enforced by the caller (CommercialSubscriptionService) before
    /// <see cref="ScheduleDowngrade"/> is ever invoked — this Aggregate only
    /// tracks the decision, it does not re-derive it.
    /// </summary>
    public Guid? PendingConfigurationSnapshotId { get; private set; }
    public DateTime? PendingChangeEffectiveDate { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    // Required by EF Core — not for application use
    private Subscription() { }

    public static Subscription Create(
        Guid workspaceId, Guid billingAccountId, Guid configurationSnapshotId, BillingCycle billingCycle)
    {
        if (workspaceId == Guid.Empty)
            throw new ArgumentException("A Subscription belongs to exactly one Workspace.", nameof(workspaceId));
        if (billingAccountId == Guid.Empty)
            throw new ArgumentException("A Subscription belongs to exactly one Billing Account.", nameof(billingAccountId));
        if (configurationSnapshotId == Guid.Empty)
            throw new ArgumentException("A Subscription must reference a Configuration Snapshot (SUB-001).", nameof(configurationSnapshotId));

        var now = DateTime.UtcNow;
        var periodEnd = billingCycle == BillingCycle.Annual ? now.AddYears(1) : now.AddMonths(1);

        return new Subscription
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            BillingAccountId = billingAccountId,
            CurrentConfigurationSnapshotId = configurationSnapshotId,
            Status = SubscriptionStatus.Pending,
            BillingCycle = billingCycle,
            StartDate = now,
            CurrentPeriodEnd = periodEnd,
            RenewalDate = periodEnd,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    /// <summary>Manual Commercial Activation (§27a): Pending→Active on first activation, PastDue/Grace→Active on recovery.</summary>
    public void Activate() => Transition(SubscriptionStatus.Active,
        SubscriptionStatus.Pending, SubscriptionStatus.PastDue, SubscriptionStatus.Grace);

    /// <summary>An issued Invoice's due date passed unpaid (§29) — not a payment failure, there is no payment to fail.</summary>
    public void RecordOverdueInvoice() => Transition(SubscriptionStatus.PastDue, SubscriptionStatus.Active);

    public void AdvanceToGrace() => Transition(SubscriptionStatus.Grace, SubscriptionStatus.PastDue);

    public void Suspend() => Transition(SubscriptionStatus.Suspended, SubscriptionStatus.Grace);

    /// <summary>
    /// SUB-004: a cancelled Subscription remains active until its effective
    /// date — this only marks the intent; the Workspace License stays Active
    /// until <see cref="CancellationEffectiveDate"/> passes.
    /// </summary>
    public void Cancel()
    {
        Transition(SubscriptionStatus.Cancelled, SubscriptionStatus.Active);
        CancellationEffectiveDate = CurrentPeriodEnd;
    }

    public void Expire() => Transition(SubscriptionStatus.Expired,
        SubscriptionStatus.Cancelled, SubscriptionStatus.Suspended);

    /// <summary>
    /// Schedules a plan change for the end of the current billing period
    /// (§14, §17) rather than applying it immediately — the caller must have
    /// already run Impact Analysis (§18) before reaching here. Only one
    /// pending change may exist at a time; scheduling a new one replaces any
    /// prior one rather than stacking.
    /// </summary>
    public void ScheduleDowngrade(Guid targetConfigurationSnapshotId)
    {
        if (Status != SubscriptionStatus.Active)
            throw new InvalidOperationException(
                $"A Subscription that is {Status} cannot schedule a plan change. Only an Active subscription can.");
        if (targetConfigurationSnapshotId == Guid.Empty)
            throw new ArgumentException(
                "A scheduled change must reference a Configuration Snapshot.", nameof(targetConfigurationSnapshotId));

        PendingConfigurationSnapshotId = targetConfigurationSnapshotId;
        PendingChangeEffectiveDate = CurrentPeriodEnd;
        Touch();
    }

    /// <summary>Lets the customer back out of a scheduled change before it takes effect — the same "Never mind" pattern as the Cancel confirmation.</summary>
    public void CancelPendingChange()
    {
        if (PendingConfigurationSnapshotId is null)
            throw new InvalidOperationException("This Subscription has no scheduled change to cancel.");

        PendingConfigurationSnapshotId = null;
        PendingChangeEffectiveDate = null;
        Touch();
    }

    /// <summary>
    /// Applied by a Platform Operator once the effective date has arrived —
    /// the same manual, audited pattern as <see cref="Expire"/>/<see cref="Suspend"/>/
    /// <see cref="AdvanceToGrace"/>, since no scheduler exists in this codebase
    /// (see CommercialOpsService's class-level remarks). This also advances
    /// the billing period by one cycle from where it stood, which doubles as
    /// this Subscription's renewal — there is no separate Renew() yet, so this
    /// is intentionally the only path that currently rolls a period forward.
    /// </summary>
    public void ApplyPendingChange()
    {
        if (PendingConfigurationSnapshotId is not { } snapshotId)
            throw new InvalidOperationException("This Subscription has no scheduled change to apply.");
        if (Status != SubscriptionStatus.Active)
            throw new InvalidOperationException(
                $"A Subscription that is {Status} cannot have a scheduled change applied. Only an Active subscription can.");

        var previousPeriodEnd = CurrentPeriodEnd;
        CurrentConfigurationSnapshotId = snapshotId;
        CurrentPeriodEnd = BillingCycle == BillingCycle.Annual ? previousPeriodEnd.AddYears(1) : previousPeriodEnd.AddMonths(1);
        RenewalDate = CurrentPeriodEnd;
        PendingConfigurationSnapshotId = null;
        PendingChangeEffectiveDate = null;
        Touch();
    }

    private void Transition(SubscriptionStatus target, params SubscriptionStatus[] permittedFrom)
    {
        if (!permittedFrom.Contains(Status))
            throw new InvalidOperationException(
                $"A Subscription that is {Status} cannot become {target}. Permitted from: {string.Join(", ", permittedFrom)}.");

        Status = target;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
