namespace Platform.Api.AI;

/// <summary>
/// Configuration for the faster-whisper transcription provider — a local
/// speech-to-text server running on the developer's own machine, no vendor
/// API key, no billing, no network call beyond localhost. Same
/// options-class-per-vendor pattern as <see cref="OllamaOptions"/>. Assumes
/// an OpenAI-compatible faster-whisper server (e.g. `speaches`, formerly
/// `faster-whisper-server`) exposing <c>POST /v1/audio/transcriptions</c>.
/// </summary>
public class FasterWhisperOptions
{
    public const string Section = "FasterWhisper";

    /// <summary>faster-whisper server's typical local address. Change only if it's running elsewhere (a different port, or a remote host).</summary>
    public string BaseUrl { get; set; } = "http://localhost:8000/";

    /// <summary>Must be a model id the server recognizes — a HuggingFace repo path such as "Systran/faster-whisper-base", not a bare size name. Smaller models are faster but less accurate; "Systran/faster-whisper-base" is a reasonable default for quick dev iteration.</summary>
    public string Model { get; set; } = "Systran/faster-whisper-base";

    /// <summary>
    /// "auto" (default) leaves the language field out of the request entirely,
    /// which makes faster-whisper detect the spoken language itself from the
    /// first ~30s of audio — needed here since lesson videos are a mix of
    /// Arabic and English and a fixed language would force one onto the
    /// other (confirmed experimentally: forcing "en" on Arabic audio
    /// produces fluent-looking but wrong English text instead of failing
    /// loudly). Set to an ISO-639-1 code (e.g. "en") only if every video this
    /// provider handles is known to be in one language.
    /// </summary>
    public string Language { get; set; } = "auto";
}
