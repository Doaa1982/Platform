namespace Platform.Api.AI;

/// <summary>
/// Configuration for the Gemini transcription provider — a distinct vendor
/// account/key from <see cref="GeminiOptions"/> (the text-completion Gemini
/// provider behind <c>Ai:Provider = "Gemini"</c>). Same vendor, but a
/// different capability with its own billing and its own key, so it gets its
/// own options class and its own "GeminiTranscription" section rather than
/// reusing GeminiOptions — same reasoning <see cref="TranscriptEnhancementOptions"/>
/// documents for staying independent of <see cref="AiOptions"/>.
/// </summary>
public class GeminiTranscriptionOptions
{
    public const string Section = "GeminiTranscription";

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Gemini 3.6 Flash — chosen for native audio/video understanding
    /// (listens to the actual audio track rather than running a separate ASR
    /// pipeline), the same approach NotebookLM uses. Unlike Deepgram/
    /// Speechmatics this is a general-purpose multimodal model prompted to
    /// produce a transcript, not a dedicated ASR engine.
    ///
    /// Originally "gemini-2.5-flash" per the initial spec, but Google retired
    /// that model alias for new API keys (confirmed 2026-09-14: the API
    /// itself returns 404 "no longer available to new users... use
    /// models/gemini-3.6-flash") — 3.6-flash is the model that alias
    /// redirects to, and is confirmed working against this project's key via
    /// the same generateContent endpoint used here.
    /// </summary>
    public string Model { get; set; } = "gemini-3.6-flash";

    /// <summary>
    /// "auto" (default) lets Gemini identify the spoken language(s) itself —
    /// unlike Deepgram/Speechmatics' single-dominant-language detection,
    /// a general-purpose multimodal model handling genuine Arabic+English
    /// code-switching sentence-by-sentence is exactly the case this provider
    /// exists to try. An ISO-639-1 code (or a plain-language hint like
    /// "Egyptian Arabic and English") can still be passed to steer it.
    /// </summary>
    public string Language { get; set; } = "auto";
}
