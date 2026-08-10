namespace Platform.Api.AI;

/// <summary>
/// The Platform's boundary to a specific speech-to-text vendor — the audio
/// equivalent of <see cref="IAiModelProvider"/>. Separate interface, not a
/// method on IAiModelProvider, because this is a genuinely different kind of
/// call (a file in, not a prompt; asynchronous by nature, not a single
/// request/response) handled by a different vendor (Claude doesn't do
/// speech-to-text) — AI Video Transcript Implementation Plan §2.
/// </summary>
public interface IAudioTranscriptionProvider
{
    /// <summary>
    /// Transcribes the video/audio file at <paramref name="filePath"/> and
    /// returns the plain-text transcript. May take a long time for a real
    /// video — callers must not call this from inside a request a user is
    /// waiting on; it belongs on a background worker (AI Video Transcript
    /// Implementation Plan §6).
    /// </summary>
    Task<string> TranscribeAsync(string filePath, string fileName, CancellationToken ct = default);
}
