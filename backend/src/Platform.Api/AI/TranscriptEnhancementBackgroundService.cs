using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Platform.Api.AI.Skills;
using Platform.Api.Models;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.AI;

/// <summary>
/// Drains <see cref="TranscriptEnhancementQueue"/> one job at a time, outside
/// any HTTP request — mirrors <see cref="TranscriptionBackgroundService"/>'s
/// shape exactly, for the text-editing pipeline instead of speech-to-text.
/// Runs the whole process — call the AI model, validate its response, save
/// the result — using its own DI scope per job.
/// </summary>
public class TranscriptEnhancementBackgroundService(
    TranscriptEnhancementQueue queue, IServiceScopeFactory scopeFactory,
    ILogger<TranscriptEnhancementBackgroundService> logger)
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
                // Catch-all deliberately — see TranscriptionBackgroundService's
                // own identical reasoning: one job's unhandled exception must
                // not kill the worker loop for every future job.
                logger.LogError(ex,
                    "Unhandled error processing transcript enhancement job for lesson revision {LessonRevisionId}",
                    job.LessonRevisionId);
            }
        }
    }

    /// <summary>Same reasoning as TranscriptionBackgroundService.RecoverInterruptedJobsAsync — a job enqueued or in flight is lost outright if the process restarts, but the revision was already flipped to Processing before that job was queued. Resolves every such row to a visible Failed state instead of leaving it stuck forever.</summary>
    private async Task RecoverInterruptedJobsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();

        var stuck = await db.Set<LessonRevision>()
            .Where(r => r.EnhancementStatus == EnhancementStatus.Processing)
            .ToListAsync(ct);

        var changed = false;
        foreach (var revision in stuck)
        {
            if (revision.EnhancementJobId is not { } jobId)
            {
                logger.LogError(
                    "Lesson revision {LessonRevisionId} is stuck in enhancement Processing with no EnhancementJobId — " +
                    "can't be auto-recovered. Needs a manual fix.",
                    revision.Id);
                continue;
            }

            logger.LogWarning(
                "Recovering lesson revision {LessonRevisionId} left in enhancement Processing from before this " +
                "service last started — its enhancement job was lost with the previous process and can never complete.",
                revision.Id);
            revision.FailEnhancement(jobId,
                "Enhancement was interrupted when the service restarted before it finished. Please try again.");
            changed = true;
        }

        if (changed) await db.SaveChangesAsync(ct);
    }

    private async Task ProcessAsync(TranscriptEnhancementJob job, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var skill = scope.ServiceProvider.GetRequiredService<EnhanceTranscriptSkill>();
        var aiOptions = scope.ServiceProvider.GetRequiredService<AiOptions>();

        TranscriptEnhancementLlmResult? result = null;
        string? failure = null;
        try
        {
            result = await skill.EnhanceAsync(job.RawTranscript, job.LessonContext, job.WorkspaceId, ct);
        }
        catch (Exception ex)
        {
            // Same "always log the full exception" reasoning as
            // TranscriptionBackgroundService — a provider failure (credits
            // exhausted, malformed JSON even after retry, model unreachable)
            // is a normal operational outcome, recorded on the revision, but
            // must still be visible in application logs, not just the DB.
            failure = ex.Message;
            logger.LogError(ex,
                "Transcript enhancement failed for lesson revision {LessonRevisionId} (job {JobId})",
                job.LessonRevisionId, job.JobId);
        }

        var lesson = await db.Lessons.Include(l => l.Revisions)
            .FirstOrDefaultAsync(l => l.Id == job.LessonId && l.WorkspaceId == job.WorkspaceId, ct);
        var revision = lesson?.Revisions.FirstOrDefault(r => r.Id == job.LessonRevisionId);

        if (revision is null)
        {
            logger.LogWarning(
                "Lesson revision {LessonRevisionId} no longer exists; discarding transcript enhancement result.",
                job.LessonRevisionId);
            return;
        }

        bool applied;
        if (result is not null)
        {
            var validation = TranscriptEnhancementValidator.Validate(job.RawTranscript, result);

            applied = revision.CompleteEnhancement(
                job.JobId, result.EnhancedTranscript!, validation.RequiresReview,
                provider: aiOptions.Provider, model: ResolveActiveModel(scope.ServiceProvider, aiOptions), promptVersion: EnhanceTranscriptSkill.PromptVersion,
                segmentsJson: result.Segments is { Count: > 0 } ? JsonSerializer.Serialize(result.Segments) : null,
                reviewItemsJson: JsonSerializer.Serialize(result.ReviewItems ?? []),
                preservationChecksJson: result.PreservationChecks is not null ? JsonSerializer.Serialize(result.PreservationChecks) : null);

            if (applied && validation.RequiresReview)
                logger.LogInformation(
                    "Transcript enhancement for lesson revision {LessonRevisionId} completed but requires review: {Reasons}",
                    job.LessonRevisionId, string.Join("; ", validation.Reasons));
        }
        else
        {
            applied = revision.FailEnhancement(job.JobId, failure ?? "Enhancement failed for an unknown reason.");
        }

        if (!applied)
        {
            logger.LogWarning(
                "Discarding {Outcome} transcript enhancement result for lesson revision {LessonRevisionId} (job {JobId}): " +
                "no longer the current attempt — superseded by a raw transcript change or a newer enhancement run.",
                result is not null ? "successful" : "failed", job.LessonRevisionId, job.JobId);
            return;
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// AiOptions.Model only reflects the actually-running model for the
    /// providers that read it directly (OpenAiModelProvider,
    /// ClaudeModelProvider both take AiOptions itself) — Gemini and Ollama
    /// each have their own options class with their own Model field
    /// (GeminiModelProvider takes GeminiOptions, OllamaModelProvider takes
    /// OllamaOptions), so stamping aiOptions.Model unconditionally silently
    /// recorded a stale/irrelevant value for either (confirmed live
    /// 2026-09-16: an enhancement run under Ai:Provider "Gemini" recorded
    /// EnhancementModel "llama3.2" — Ai:Model's leftover Ollama value —
    /// instead of the Gemini model that actually answered). Only the
    /// provider whose options class is actually registered for the active
    /// Ai:Provider exists in DI, hence the optional GetService lookups here.
    /// </summary>
    private static string ResolveActiveModel(IServiceProvider services, AiOptions aiOptions)
    {
        if (aiOptions.Provider.Equals("Gemini", StringComparison.OrdinalIgnoreCase))
            return services.GetService<GeminiOptions>()?.Model ?? aiOptions.Model;
        if (aiOptions.Provider.Equals("Ollama", StringComparison.OrdinalIgnoreCase))
            return services.GetService<OllamaOptions>()?.Model ?? aiOptions.Model;
        return aiOptions.Model;
    }
}
