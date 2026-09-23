using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Services;
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
    TranscriptionQueue queue, IServiceScopeFactory scopeFactory, IHttpClientFactory httpClientFactory,
    ILogger<TranscriptionBackgroundService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecoverInterruptedJobsAsync(stoppingToken);

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

    /// <summary>
    /// <see cref="TranscriptionQueue"/> is an in-memory channel (its own doc comment already
    /// calls this out): a job that was enqueued or already in flight is lost outright if the
    /// process restarts, but the revision it belonged to was already flipped to Processing
    /// before that job was queued. Left alone, that revision stays stuck in Processing forever
    /// — no job is ever coming to complete or fail it, and nothing about that is visible
    /// anywhere. Every restart (an ordinary occurrence in local Aspire development) sweeps
    /// these up front and resolves them to a clear, visible Failed state instead.
    /// </summary>
    private async Task RecoverInterruptedJobsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();

        var stuck = await db.Set<LessonRevision>()
            .Where(r => r.TranscriptStatus == TranscriptStatus.Processing)
            .ToListAsync(ct);

        var changed = false;
        foreach (var revision in stuck)
        {
            if (revision.TranscriptionJobId is not { } jobId)
            {
                // Processing with no TranscriptionJobId shouldn't happen through
                // BeginTranscription (it always sets one), but a row could reach this
                // state some other way (a pre-migration row, manual data edit, etc.).
                // There's no job id to satisfy FailTranscription's match check, and
                // guessing one would be worse than leaving it — surface it loudly
                // instead of crashing this service's startup for every other stuck row.
                logger.LogError(
                    "Lesson revision {LessonRevisionId} is stuck in Processing with no TranscriptionJobId — " +
                    "can't be auto-recovered. Needs a manual fix (e.g. set TranscriptStatus back to Failed/None " +
                    "directly in the database).",
                    revision.Id);
                continue;
            }

            logger.LogWarning(
                "Recovering lesson revision {LessonRevisionId} left in Processing from before this service last " +
                "started — its transcription job was lost with the previous process and can never complete.",
                revision.Id);
            revision.FailTranscription(jobId,
                "Transcription was interrupted when the service restarted before it finished. Please try again.");
            changed = true;
        }

        if (changed) await db.SaveChangesAsync(ct);
    }

    private async Task ProcessAsync(TranscriptionJob job, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var provider = scope.ServiceProvider.GetRequiredService<IAudioTranscriptionProvider>();

        TranscriptionResult? result = null;
        string? failure = null;
        // Neither source has a local file yet — an uploaded asset lives in
        // object storage and a URL job lives on the web — so each is copied
        // into a temp file first and that copy is deleted afterward. The
        // stored object itself is never touched here.
        string? downloadedFilePath = null;
        StorageTempFile? storedCopy = null;
        try
        {
            string filePath;
            if (job.StorageObjectKey is not null)
            {
                var storage = scope.ServiceProvider.GetRequiredService<ILearningAssetStorage>();
                try
                {
                    storedCopy = await StorageTempFile.DownloadAsync(storage, job.StorageObjectKey, ct, logger);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // The failure text is saved on the revision and shown to the tutor. A storage or filesystem error can
                    // carry a bucket, an object key, an endpoint or a local path, so the tutor gets a fixed message and
                    // the real exception stays in the server log (logged by the catch below).
                    throw new TranscriptionSourceUnavailableException(
                        ex is StoredObjectNotFoundException
                            ? "The lesson's video file could not be found in storage. Please re-attach the video and try again."
                            : "The lesson's video file could not be read from storage. Please try again in a few minutes.",
                        ex);
                }
                filePath = storedCopy.Path;
            }
            else
            {
                filePath = downloadedFilePath = await DownloadToTempFileAsync(job.SourceUrl!, ct);
            }
            result = await provider.TranscribeAsync(filePath, job.FileName, job.Language, ct);
        }
        catch (Exception ex)
        {
            // Provider failures (bad key, rejected job, timeout) are expected
            // operational outcomes, not bugs — recorded on the revision as a
            // normal Failed state rather than rethrown. Still logged here,
            // unconditionally: this is the only place that ever sees the full
            // exception, and previously only its .Message reached the DB —
            // nothing was ever written to the console/Aspire logs, so a
            // provider failure was invisible outside the tutor manually
            // reading the revision's TranscriptError.
            failure = ex.Message;
            logger.LogError(ex,
                "Transcription provider failed for lesson revision {LessonRevisionId} (job {JobId})",
                job.LessonRevisionId, job.JobId);
        }
        finally
        {
            if (storedCopy is not null) await storedCopy.DisposeAsync();

            if (downloadedFilePath is not null)
            {
                try { File.Delete(downloadedFilePath); }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to delete downloaded temp video file {FilePath}", downloadedFilePath);
                }
            }
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

        bool applied;
        if (result is not null)
        {
            // No chapters is a normal outcome (short video, unsupported
            // language) — AI Video-Grounded Questions Implementation Plan §2 —
            // stored as null, not an empty-array string, so downstream code's
            // "is chapters present" check stays a simple null check. Same
            // treatment for segments — most providers simply don't expose them.
            var chaptersJson = result.Chapters.Count > 0 ? JsonSerializer.Serialize(result.Chapters) : null;
            var segmentsJson = result.Segments.Count > 0 ? JsonSerializer.Serialize(result.Segments) : null;
            applied = revision.CompleteTranscription(job.JobId, result.Text, chaptersJson, segmentsJson);
        }
        else
        {
            applied = revision.FailTranscription(job.JobId, failure ?? "Transcription failed for an unknown reason.");
        }

        if (!applied)
        {
            // The revision moved on before this job's result arrived — the
            // video was replaced, or transcription was re-run, while this job
            // was still in flight. Discarding is correct (this result no
            // longer describes what the revision now points at), but it must
            // be visible: previously this branch was unreachable (the old
            // signature just no-opped on the same condition), which is
            // exactly how a video could end up with no transcript and no
            // trace of why.
            logger.LogWarning(
                "Discarding {Outcome} transcription result for lesson revision {LessonRevisionId} (job {JobId}): " +
                "no longer the current attempt — superseded by a video replacement or a newer transcription run.",
                result is not null ? "successful" : "failed", job.LessonRevisionId, job.JobId);
            return;
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task<string> DownloadToTempFileAsync(string url, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient("VideoDownload");
        using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();

        var tempDir = Path.Combine(Path.GetTempPath(), "platform-transcription-downloads");
        Directory.CreateDirectory(tempDir);
        var extension = Path.GetExtension(new Uri(url).AbsolutePath);
        var tempPath = Path.Combine(tempDir, $"{Guid.NewGuid():N}{extension}");

        await using (var fileStream = File.Create(tempPath))
            await response.Content.CopyToAsync(fileStream, ct);

        return tempPath;
    }
}

/// <summary>The uploaded video could not be copied out of storage. The message is safe to show a tutor; the InnerException is not.</summary>
public sealed class TranscriptionSourceUnavailableException(string safeMessage, Exception inner) : Exception(safeMessage, inner);

