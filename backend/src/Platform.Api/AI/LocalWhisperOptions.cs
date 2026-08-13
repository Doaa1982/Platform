namespace Platform.Api.AI;

/// <summary>
/// Configuration for the locally-running faster-whisper Python service
/// (<c>services/transcription</c>) — a FastAPI that runs the medium Whisper
/// model directly, with no external API key, no billing, and no data leaving
/// the machine. Bound from the "LocalWhisper" section of appsettings —
/// same pattern as <see cref="FasterWhisperOptions"/> and
/// <see cref="OllamaOptions"/>.
///
/// Unlike <see cref="FasterWhisperOptions"/>, this service exposes a custom
/// API shape (<c>POST /api/transcriptions</c>) rather than an OpenAI-
/// compatible endpoint — see <see cref="LocalWhisperTranscriptionProvider"/>.
///
/// Model size and language are baked into the Python service itself (medium
/// model, Arabic) and are not re-configurable from here.
/// </summary>
public class LocalWhisperOptions
{
    public const string Section = "LocalWhisper";

    /// <summary>
    /// Base URL of the locally-running transcription service. Defaults to
    /// port 9000 to avoid colliding with the <c>speaches</c> container that
    /// runs the <see cref="FasterWhisperTranscriptionProvider"/> on port 8000.
    /// Start the service with: <c>uvicorn app.main:app --reload --port 9000</c>
    /// </summary>
    public string BaseUrl { get; set; } = "http://localhost:9000/";
}
