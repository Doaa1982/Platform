namespace Platform.Domain.Tests;

/// <summary>
/// Subscription.Renew() and RecordCreditsGranted() — the "nothing changed,
/// the customer just kept paying" renewal path this codebase never had
/// before (ApplyPendingChange only ever rolled a period forward as a side
/// effect of applying a scheduled downgrade), and the bookkeeping
/// LicensingService's chokepoint relies on to grant a period's AI credits
/// exactly once and top up a mid-period Upgrade's delta without re-granting
/// or clawing back (V1 Production Readiness Report, P0-1).
/// </summary>
public class SubscriptionRenewalAndCreditGrantTests
{
    private static Subscription NewActiveMonthlySubscription()
    {
        var subscription = Subscription.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), BillingCycle.Monthly);
        subscription.Activate();
        return subscription;
    }

    [Fact]
    public void Renew_FromActive_RollsPeriodEndForwardByOneMonth_AndUpdatesRenewalDate()
    {
        var subscription = NewActiveMonthlySubscription();
        var previousPeriodEnd = subscription.CurrentPeriodEnd;

        subscription.Renew();

        Assert.Equal(previousPeriodEnd.AddMonths(1), subscription.CurrentPeriodEnd);
        Assert.Equal(subscription.CurrentPeriodEnd, subscription.RenewalDate);
    }

    [Fact]
    public void Renew_FromAnnualCycle_RollsPeriodEndForwardByOneYear()
    {
        var subscription = Subscription.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), BillingCycle.Annual);
        subscription.Activate();
        var previousPeriodEnd = subscription.CurrentPeriodEnd;

        subscription.Renew();

        Assert.Equal(previousPeriodEnd.AddYears(1), subscription.CurrentPeriodEnd);
    }

    [Fact]
    public void Renew_WhenNotActive_Throws()
    {
        var subscription = Subscription.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), BillingCycle.Monthly);
        // Still Pending — never activated.

        Assert.Throws<InvalidOperationException>(subscription.Renew);
    }

    [Fact]
    public void Renew_WithAScheduledDowngradePending_Throws()
    {
        var subscription = NewActiveMonthlySubscription();
        subscription.ScheduleDowngrade(Guid.NewGuid());

        // A due scheduled change must go through ApplyPendingChange instead —
        // CommercialOpsService.SweepDueRenewalsAsync is responsible for
        // picking the right one; Renew() itself must refuse to be a silent
        // way around an already-scheduled downgrade.
        Assert.Throws<InvalidOperationException>(subscription.Renew);
    }

    [Fact]
    public void NewSubscription_HasNeverBeenGrantedCreditsForAnyPeriod()
    {
        var subscription = Subscription.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), BillingCycle.Monthly);

        Assert.Null(subscription.CreditsGrantedThroughUtc);
        Assert.Equal(0, subscription.CreditsGrantedThisPeriodAmount);
    }

    [Fact]
    public void RecordCreditsGranted_StampsCurrentPeriodEnd_AndTheGrantedAmount()
    {
        var subscription = NewActiveMonthlySubscription();

        subscription.RecordCreditsGranted(5_000);

        Assert.Equal(subscription.CurrentPeriodEnd, subscription.CreditsGrantedThroughUtc);
        Assert.Equal(5_000, subscription.CreditsGrantedThisPeriodAmount);
    }

    [Fact]
    public void RecordCreditsGranted_AfterRenewal_TracksTheNewPeriodSeparately()
    {
        var subscription = NewActiveMonthlySubscription();
        subscription.RecordCreditsGranted(5_000);
        var firstPeriodEnd = subscription.CurrentPeriodEnd;

        subscription.Renew();

        // The stamp from the prior period must no longer match the new period
        // end — this is exactly the signal LicensingService's chokepoint uses
        // to decide a fresh grant is due.
        Assert.NotEqual(subscription.CreditsGrantedThroughUtc, subscription.CurrentPeriodEnd);
        Assert.NotEqual(firstPeriodEnd, subscription.CurrentPeriodEnd);

        subscription.RecordCreditsGranted(20_000);
        Assert.Equal(subscription.CurrentPeriodEnd, subscription.CreditsGrantedThroughUtc);
        Assert.Equal(20_000, subscription.CreditsGrantedThisPeriodAmount);
    }
}
