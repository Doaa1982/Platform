using Platform.Api.Models;
using Platform.Domain;

namespace Platform.Api.Services;

/// <summary>
/// Display metadata for each <see cref="QuestionType"/> member, keyed off the
/// domain enum itself so the API — and every frontend layer that calls
/// <c>GET api/reference/question-types</c> — stays in lockstep with it
/// instead of duplicating the member names as hard-coded strings.
/// </summary>
public static class QuestionTypeCatalog
{
    private static readonly Dictionary<QuestionType, (string Label, string Description)> Info = new()
    {
        [QuestionType.MultipleChoice] = ("Multiple choice", "Pick one correct option from a list."),
        [QuestionType.TrueFalse] = ("True / False", "A statement the learner marks true or false."),
        [QuestionType.CompleteTheSentence] = ("Complete the sentence", "A short answer matched against one or more accepted phrasings."),
        [QuestionType.OpenAnswer] = ("Open question", "A free-text response reviewed for participation, not auto-scored."),
    };

    /// <summary>Ordered per the QuestionType declaration order (AssessmentEnums.cs).</summary>
    public static readonly IReadOnlyList<QuestionTypeOption> All =
        Enum.GetValues<QuestionType>()
            .Select(t => new QuestionTypeOption(t.ToString(), Info[t].Label, Info[t].Description))
            .ToList();
}
