namespace Platform.Api.AI;

/// <summary>
/// Configuration for the transcript-enhancement feature, independent of both
/// the transcription provider (SpeechmaticsOptions/DeepgramOptions) and the
/// AI text-completion provider (AiOptions). Deliberately has no Provider/Model
/// switch of its own: per this feature's own implementation notes, enhancement
/// calls go through the existing <see cref="IAiModelProvider"/> abstraction
/// exactly like every other AI Skill — introducing a second, independently
/// selectable model provider just for this one skill would duplicate
/// AiOptions' job for no real benefit today. <see cref="EnhancementProvider"/>/
/// <see cref="EnhancementModel"/> stamped onto a LessonRevision on completion
/// are read from <see cref="AiOptions"/> at call time instead.
/// </summary>
public class TranscriptEnhancementOptions
{
    public const string Section = "TranscriptEnhancement";

    /// <summary>Feature flag — false rejects every enhancement request before any AI call or credit debit.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>A raw transcript longer than this is rejected before ever calling the model — protects against an unreasonably large single completion call/cost.</summary>
    public int MaxInputCharacters { get; set; } = 100_000;

    // No PromptVersion setting here, deliberately: the true, only source of
    // truth for which prompt produced a given result is
    // Skills.EnhanceTranscriptSkill.PromptVersion itself (stamped directly
    // onto LessonRevision.EnhancementPromptVersion) — a separate config copy
    // of that string could silently drift out of sync with the prompt it's
    // meant to identify.
}
