using System.Diagnostics;

namespace Platform.Api.AI;

/// <summary>
/// An interface purely so integration tests can substitute a real-FFmpeg-free fake (see
/// Platform.Api.IntegrationTests.Fixtures.FakeAudioExtractor) — same reasoning
/// IAiModelProvider/IAudioTranscriptionProvider already have their own fakes for.
/// </summary>
public interface IAudioExtractor
{
    /// <summary>See <see cref="AudioExtractor.ExtractAsync"/>.</summary>
    Task<string> ExtractAsync(string sourcePath, CancellationToken ct);

    /// <summary>
    /// Null before <see cref="ProbeAsync"/> has ever run; true/false afterward. Read by
    /// ContentStudioService.GenerateTranscriptAsync to decide whether an Audio-mode request
    /// needs the Gemini fallback (see that method's remarks) — cached rather than re-probed per
    /// request, since ffmpeg's presence/executability doesn't change while the process is running.
    /// </summary>
    bool? IsAvailable { get; }

    /// <summary>
    /// Runs once at startup (Program.cs) — tries `ffmpeg -version` against the configured path
    /// and logs a clear error if it fails, so a missing/broken ffmpeg is visible in the logs
    /// immediately rather than only on a tutor's first failed transcription. Safe to call more
    /// than once (idempotent) — only the first call actually probes; later calls return the
    /// cached result.
    /// </summary>
    Task<bool> ProbeAsync(CancellationToken ct = default);
}

/// <summary>
/// Extracts a compressed, mono, 16kHz audio track from a video/audio file via ffmpeg — used for
/// TranscriptionInputMode.Audio, regardless of provider, so a large lesson video's picture never
/// has to leave this machine, and every provider receives the same small, consistent input
/// regardless of the original file's format/bitrate/channel count (a screen recording is
/// routinely stereo 48kHz; none of that helps transcription and it costs more to upload).
///
/// Shells out to the executable at TranscriptionOptions.FfmpegPath directly via Process — no
/// bundled wrapper library, no runtime download. ffmpeg itself is either resolved from PATH
/// (Development — brew install ffmpeg, see README) or a CI-published, checksum-verified static
/// binary (Production — see .github/workflows/deploy.yml and appsettings.Production.json). If it
/// can't be found or run at all, ProbeAsync logs that clearly at startup, and
/// ContentStudioService.GenerateTranscriptAsync falls a Gemini request back to VideoLowRes
/// instead (which needs no local extraction) rather than queuing a job doomed to fail; a
/// non-Gemini provider has no such fallback (it has no video-input capability at all), so that
/// case is refused up front with a clear message instead.
/// </summary>
public class AudioExtractor(TranscriptionOptions options, ILogger<AudioExtractor> logger) : IAudioExtractor
{
    private bool? _isAvailable;
    private readonly SemaphoreSlim _probeLock = new(1, 1);

    public bool? IsAvailable => _isAvailable;

    /// <summary>Small and more than sufficient for speech — 16kHz/mono is what every ASR pipeline (and Gemini's own audio understanding) downsamples to internally anyway, so encoding any richer than this wastes upload bandwidth without improving transcription quality.</summary>
    private const string AudioBitrateKbps = "32k";

    private static readonly TimeSpan ProbeTimeout = TimeSpan.FromSeconds(10);

    /// <summary>
    /// A bare name (no path separator, e.g. the "ffmpeg" default) is left as-is for the OS to
    /// resolve from PATH — Process.Start already does this natively when FileName has no
    /// directory component, same as a shell would. A rooted path is used exactly as given.
    /// Anything else (has a separator but isn't rooted, e.g. "tools/ffmpeg") is resolved
    /// relative to AppContext.BaseDirectory — the published app's own directory on Azure App
    /// Service (/home/site/wwwroot), which is where the CI-published "tools/ffmpeg" actually
    /// lands, and is more reliable than trusting the process's current working directory to
    /// always equal the content root.
    /// </summary>
    public static string ResolveExecutablePath(string configuredPath)
    {
        if (string.IsNullOrWhiteSpace(configuredPath)) return "ffmpeg";
        if (Path.IsPathRooted(configuredPath)) return configuredPath;
        if (!configuredPath.Contains('/') && !configuredPath.Contains('\\')) return configuredPath; // bare command name — let PATH resolve it
        return Path.Combine(AppContext.BaseDirectory, configuredPath);
    }

    public async Task<bool> ProbeAsync(CancellationToken ct = default)
    {
        if (_isAvailable is { } cached) return cached;

        await _probeLock.WaitAsync(ct);
        try
        {
            if (_isAvailable is { } cachedAfterLock) return cachedAfterLock;

            var executablePath = ResolveExecutablePath(options.FfmpegPath);
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(ProbeTimeout);
                var (exitCode, _, stderr) = await RunAsync(executablePath, ["-version"], cts.Token);
                _isAvailable = exitCode == 0;
                if (_isAvailable != true)
                    logger.LogError(
                        "ffmpeg at {ExecutablePath} (Transcription:FfmpegPath = {ConfiguredPath}) exited {ExitCode} " +
                        "for `-version`. Audio-mode transcription against a non-Gemini provider will fail until this " +
                        "is fixed; a Gemini request will fall back to VideoLowRes instead. stderr: {Stderr}",
                        executablePath, options.FfmpegPath, exitCode, stderr);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                _isAvailable = false;
                logger.LogError(ex,
                    "ffmpeg at {ExecutablePath} (Transcription:FfmpegPath = {ConfiguredPath}) could not be started at " +
                    "all — likely not installed or not executable. Audio-mode transcription against a non-Gemini " +
                    "provider will fail until this is fixed; a Gemini request will fall back to VideoLowRes instead.",
                    executablePath, options.FfmpegPath);
            }

            return _isAvailable!.Value;
        }
        finally
        {
            _probeLock.Release();
        }
    }

    /// <summary>Downloads and extracts to a new temp file — caller owns deleting it (same "caller cleans up its own temp file" contract TranscriptionBackgroundService already follows for its downloaded/storage-copied source files).</summary>
    public async Task<string> ExtractAsync(string sourcePath, CancellationToken ct)
    {
        var executablePath = ResolveExecutablePath(options.FfmpegPath);
        var outputPath = Path.Combine(Path.GetTempPath(), $"platform-transcription-audio-{Guid.NewGuid():N}.m4a");
        try
        {
            // -vn: drop any video stream (irrelevant here, and some inputs are video files).
            // -ac 1 / -ar 16000: force mono/16kHz regardless of the source (a screen recording
            // is routinely stereo 48kHz). -y: overwrite without prompting — outputPath is
            // always a fresh, never-before-used temp file, so there is nothing to protect.
            string[] args = ["-y", "-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", AudioBitrateKbps, outputPath];
            var (exitCode, _, stderr) = await RunAsync(executablePath, args, ct);
            if (exitCode != 0)
                throw new InvalidOperationException($"ffmpeg exited {exitCode} extracting audio: {stderr}");
            if (!File.Exists(outputPath) || new FileInfo(outputPath).Length == 0)
                throw new InvalidOperationException("ffmpeg reported success but produced no audio output — the source file may have no audio track.");

            return outputPath;
        }
        catch
        {
            TryDelete(outputPath);
            throw;
        }
    }

    private static async Task<(int ExitCode, string Stdout, string Stderr)> RunAsync(string executablePath, IReadOnlyList<string> arguments, CancellationToken ct)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = executablePath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var arg in arguments) startInfo.ArgumentList.Add(arg);

        using var process = new Process { StartInfo = startInfo };
        process.Start();
        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
        var stderrTask = process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);
        return (process.ExitCode, await stdoutTask, await stderrTask);
    }

    private void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (Exception ex) { logger.LogWarning(ex, "Failed to delete partial extracted-audio temp file {Path}", path); }
    }
}
