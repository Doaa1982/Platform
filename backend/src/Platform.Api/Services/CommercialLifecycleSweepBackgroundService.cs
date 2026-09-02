namespace Platform.Api.Services;

/// <summary>
/// Runs the two purely date-driven halves of <see cref="CommercialOpsService"/>
/// on a timer, so a Subscription's Invoice-overdue marking and period
/// rollover/renewal (which is what lets <see cref="LicensingService"/>'s
/// chokepoint grant each new period's AI credits) happen even if no Platform
/// Operator visits the admin console (V1 Launch Readiness Report, P1.5).
///
/// Deliberately does NOT automate <see cref="CommercialOpsService.AdvanceToGraceAsync"/>,
/// <see cref="CommercialOpsService.SuspendAsync"/>, or
/// <see cref="CommercialOpsService.ExpireAsync"/> — those require a Platform
/// Operator's judgment about how many days overdue is Grace-worthy vs.
/// Suspend-worthy (there is no stored "days allowed" policy field to compute
/// that from), consistent with the 2026-08-09 correction documented on
/// <see cref="CommercialOpsService"/> itself: this platform collects payment
/// manually outside the app, so only a human knows whether an overdue
/// invoice actually went unpaid or was just not yet marked. Automating those
/// three would silently invent an undocumented commercial policy rather than
/// enforce one that exists.
/// </summary>
public class CommercialLifecycleSweepBackgroundService(
    IServiceScopeFactory scopeFactory, ILogger<CommercialLifecycleSweepBackgroundService> logger)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        // Run once immediately on startup, then on the timer — otherwise a
        // subscription whose period elapsed while the app was down would
        // wait up to a full Interval after restart before its renewal fires.
        do
        {
            try
            {
                await RunSweepAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                // Catch-all deliberately: one failed sweep tick (e.g. a
                // transient DB blip) must not kill every future tick.
                logger.LogError(ex, "Unhandled error during commercial lifecycle sweep.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task RunSweepAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var ops = scope.ServiceProvider.GetRequiredService<CommercialOpsService>();

        var overdueCount = await ops.SweepOverdueInvoicesAsync(ct);
        var renewedCount = await ops.SweepDueRenewalsAsync(ct);

        if (overdueCount > 0 || renewedCount > 0)
            logger.LogInformation(
                "Commercial lifecycle sweep: {OverdueCount} invoice(s) marked overdue, {RenewedCount} subscription(s) rolled to a new period.",
                overdueCount, renewedCount);
    }
}
