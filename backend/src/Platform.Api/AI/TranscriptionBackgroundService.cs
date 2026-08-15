using System.Text.Json;
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
    TranscriptionQueue queue, IServiceScopeFactory scopeFactory, IHttpClientFactory httpClientFactory,
    ILogger<TranscriptionBackgroundService> logger)
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

        TranscriptionResult? result = null;
        string? failure = null;
        // A URL-sourced job has no local file yet — download it into a temp
        // file first and clean that up afterward; an uploaded asset's file
        // lives in permanent storage and is never touched here.
        string? downloadedFilePath = null;
        try
        {
            var filePath = job.FilePath ?? (downloadedFilePath = await DownloadToTempFileAsync(job.SourceUrl!, ct));
            result = await provider.TranscribeAsync(filePath, job.FileName, ct);
        }
        catch (Exception ex)
        {
            // Provider failures (bad key, rejected job, timeout) are expected
            // operational outcomes, not bugs — recorded on the revision as a
            // normal Failed state rather than rethrown.
            failure = ex.Message;
        }
        finally
        {
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

        if (result is not null)
        {
            // No chapters is a normal outcome (short video, unsupported
            // language) — AI Video-Grounded Questions Implementation Plan §2 —
            // stored as null, not an empty-array string, so downstream code's
            // "is chapters present" check stays a simple null check. Same
            // treatment for segments — most providers simply don't expose them.
            var chaptersJson = result.Chapters.Count > 0 ? JsonSerializer.Serialize(result.Chapters) : null;
            var segmentsJson = result.Segments.Count > 0 ? JsonSerializer.Serialize(result.Segments) : null;
            revision.CompleteTranscription(result.Text, chaptersJson, segmentsJson);
        }
        else
        {
            revision.FailTranscription(failure ?? "Transcription failed for an unknown reason.");
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
