namespace Platform.Api.AI;

/// <summary>
/// One detected chapter of a transcription — a real, deterministic time range
/// the provider computed (AI Video-Grounded Questions Implementation Plan §2),
/// not something a downstream LLM has to estimate. <see cref="Title"/> and
/// <see cref="Summary"/> come from the provider's own chaptering model, if it
/// has one; a provider that can't chapter simply returns no chapters at all.
/// </summary>
public record TranscriptChapter(string Title, string? Summary, double StartSeconds, double EndSeconds);

/// <summary>
/// The result of one transcription attempt: the plain-text transcript, plus
/// whatever chapters the provider was able to detect (empty, not null, if
/// none — e.g. the video was too short for the provider's chaptering minimum).
/// </summary>
public record TranscriptionResult(string Text, IReadOnlyList<TranscriptChapter> Chapters);

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
    /// returns the plain-text transcript plus any detected chapters. May take
    /// a long time for a real video — callers must not call this from inside
    /// a request a user is waiting on; it belongs on a background worker (AI
    /// Video Transcript Implementation Plan §6).
    /// </summary>
    Task<TranscriptionResult> TranscribeAsync(string filePath, string fileName, CancellationToken ct = default);
}
