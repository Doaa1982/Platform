using Microsoft.EntityFrameworkCore;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.AI;

/// <summary>
/// Drains <see cref="TranscriptionQueue"/> one job at a time, outside any
/// HTTP request (AI Video Transcript Implementation Plan §6). Runs the whole
/// process — call Speechmatics, wait for it, save the result — using its own
/// DI scope per job, since it long outlives whatever request enqueued it.
/// </summary>
public class TranscriptionBackgroundService(
    TranscriptionQueue queue, IServiceScopeFactory scopeFactory, ILogger<TranscriptionBackgroundService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await ProcessAsync(job, stoppingToken);
            }
            catch (Exception ex)
            {
                // Catch-all deliberately: an unhandled exception here would
                // kill the one worker loop for every future job, not just
                // this one. A failure that escapes ProcessAsync's own
                // try/catch (e.g. the DB save itself failing) is logged and
                // the worker moves on to the next job.
                logger.LogError(ex,
                    "Unhandled error processing transcription job for lesson revision {LessonRevisionId}",
                    job.LessonRevisionId);
            }
        }
    }

    private async Task ProcessAsync(TranscriptionJob job, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var provider = scope.ServiceProvider.GetRequiredService<IAudioTranscriptionProvider>();

        string? text = null;
        string? failure = null;
        try
        {
            text = await provider.TranscribeAsync(job.FilePath, job.FileName, ct);
        }
        catch (Exception ex)
        {
            // Provider failures (bad key, rejected job, timeout) are expected
            // operational outcomes, not bugs — recorded on the revision as a
            // normal Failed state rather than rethrown.
            failure = ex.Message;
        }

        var lesson = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == job.LessonId && l.WorkspaceId == job.WorkspaceId, ct);
        var revision = lesson?.Revisions.FirstOrDefault(r => r.Id == job.LessonRevisionId);

        if (revision is null)
        {
            // The lesson or revision was deleted/changed while this job was
            // running — nothing left to record the result on.
            logger.LogWarning(
                "Lesson revision {LessonRevisionId} no longer exists; discarding transcription result.",
                job.LessonRevisionId);
            return;
        }

        if (text is not null) revision.CompleteTranscription(text);
        else revision.FailTranscription(failure ?? "Transcription failed for an unknown reason.");

        await db.SaveChangesAsync(ct);
    }
}
