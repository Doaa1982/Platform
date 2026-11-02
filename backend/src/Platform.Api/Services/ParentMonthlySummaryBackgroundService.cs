namespace Platform.Api.Services;

/// <summary>
/// Sends the monthly parent summaries (Parent Progress Reports Business Analysis §8). Checks
/// hourly; on the 1st of the month in Cairo it asks <see cref="ParentReportService"/> for the
/// previous month's summaries. The 2nd and 3rd are kept as a catch-up window in case the app was
/// down on the 1st — running again sends nothing new, because every summary already attempted for
/// a parent and month is skipped. Turned off with ParentReports:MonthlyJobEnabled=false (tests).
/// </summary>
public class ParentMonthlySummaryBackgroundService(
    IServiceScopeFactory scopeFactory, TimeProvider clock, ILogger<ParentMonthlySummaryBackgroundService> logger)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private const int CatchUpDays = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                var now = clock.GetUtcNow().UtcDateTime;
                if (ParentReportService.CairoToday(now).Day > CatchUpDays) continue;

                using var scope = scopeFactory.CreateScope();
                var reports = scope.ServiceProvider.GetRequiredService<ParentReportService>();
                var sent = await reports.SendMonthlySummariesAsync(now, stoppingToken);
                if (sent > 0) logger.LogInformation("Parent monthly summaries: {Count} email(s) attempted.", sent);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // One failed tick must not stop the next one.
                logger.LogError(ex, "Unhandled error while sending parent monthly summaries.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
