using Xabe.FFmpeg;
using Xabe.FFmpeg.Downloader;

namespace Platform.Api.AI;

/// <summary>
/// An interface purely so integration tests can substitute a real-FFmpeg-free fake (see
/// Platform.Api.IntegrationTests.Fixtures.FakeAudioExtractor) — same reasoning
/// IAiModelProvider/IAudioTranscriptionProvider already have their own fakes for: proving the
/// surrounding plumbing (mode selection, credit charge) is correct shouldn't require a real
/// ~70-100MB binary download in every CI run.
/// </summary>
public interface IAudioExtractor
{
    /// <summary>See <see cref="AudioExtractor.ExtractAsync"/>.</summary>
    Task<string> ExtractAsync(string sourcePath, CancellationToken ct);
}

/// <summary>
/// Extracts a compressed, mono, 16kHz audio track from a video/audio file via FFmpeg — used
/// for TranscriptionInputMode.Audio, regardless of provider, so a large lesson video's picture
/// never has to leave this machine, and every provider receives the same small, consistent
/// input regardless of the original file's format/bitrate/channel count (a screen recording is
/// routinely stereo 48kHz; none of that helps transcription and it costs more to upload).
///
/// FFmpeg itself isn't assumed to already be installed on the host — Azure App Service (Linux)'s
/// .NET runtime container doesn't ship it, and it can't be added without switching to a custom
/// container image, which is out of scope for this pilot. Xabe.FFmpeg.Downloader fetches a
/// static, self-contained ffmpeg/ffprobe binary into a local temp folder on first use instead;
/// lazy and semaphore-guarded so concurrent transcription jobs on the same process don't race to
/// download it twice.
/// </summary>
public class AudioExtractor(ILogger<AudioExtractor> logger) : IAudioExtractor
{
    private static readonly SemaphoreSlim ProvisionLock = new(1, 1);
    private static bool _provisioned;

    private static readonly string BinariesPath = Path.Combine(Path.GetTempPath(), "platform-ffmpeg");

    /// <summary>Small and more than sufficient for speech — 16kHz/mono is what every ASR pipeline (and Gemini's own audio understanding) downsamples to internally anyway, so encoding any richer than this wastes upload bandwidth without improving transcription quality.</summary>
    private const string AudioBitrate = "32k";

    /// <summary>
    /// Downloads and extracts to a new temp file — caller owns deleting it (same "caller
    /// cleans up its own temp file" contract TranscriptionBackgroundService already follows for
    /// its downloaded/storage-copied source files).
    /// </summary>
    public async Task<string> ExtractAsync(string sourcePath, CancellationToken ct)
    {
        await EnsureFFmpegAsync(ct);

        var outputPath = Path.Combine(Path.GetTempPath(), $"platform-transcription-audio-{Guid.NewGuid():N}.m4a");
        try
        {
            var mediaInfo = await FFmpeg.GetMediaInfo(sourcePath, ct);
            var audioStream = mediaInfo.AudioStreams.FirstOrDefault()
                ?? throw new InvalidOperationException("This file has no audio track to transcribe.");

            // -ac 1 / -ar 16000 force mono/16kHz regardless of the source (a screen recording is
            // routinely stereo 48kHz) — SetBitrate alone only re-encodes at a lower quality, it
            // doesn't change channel count or sample rate.
            audioStream.SetCodec(AudioCodec.aac).SetBitrate(32_000);
            await FFmpeg.Conversions.New()
                .AddStream(audioStream)
                .AddParameter("-ac 1 -ar 16000", ParameterPosition.PostInput)
                .SetOutput(outputPath)
                .Start(ct);

            return outputPath;
        }
        catch
        {
            TryDelete(outputPath);
            throw;
        }
    }

    private static async Task EnsureFFmpegAsync(CancellationToken ct)
    {
        if (_provisioned) return;

        await ProvisionLock.WaitAsync(ct);
        try
        {
            if (_provisioned) return; // another job already provisioned it while this one waited

            Directory.CreateDirectory(BinariesPath);
            FFmpeg.SetExecutablesPath(BinariesPath);

            // Already-provisioned check: a restarted process reuses BinariesPath's temp
            // directory contents if the OS hasn't cleared /tmp since — avoids re-downloading
            // ~70-100MB on every restart when it isn't actually necessary.
            var alreadyPresent = Directory.Exists(BinariesPath)
                && Directory.EnumerateFiles(BinariesPath, "ffmpeg*").Any();
            if (!alreadyPresent)
                await FFmpegDownloader.GetLatestVersion(FFmpegVersion.Official, BinariesPath);

            _provisioned = true;
        }
        finally
        {
            ProvisionLock.Release();
        }
    }

    private void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (Exception ex) { logger.LogWarning(ex, "Failed to delete partial extracted-audio temp file {Path}", path); }
    }
}
