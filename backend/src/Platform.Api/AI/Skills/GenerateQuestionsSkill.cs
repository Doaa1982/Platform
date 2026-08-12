using Platform.Api.Models;

namespace Platform.Api.AI.Skills;

/// <summary>
/// AISkillArchitecture.md's "GenerateQuestions" skill, scoped to this
/// codebase's one caller: AssessmentService.SuggestQuestionsAsync.
///
/// Replaces the previous hardcoded <c>Templates</c> array with an actual
/// model call, while keeping the same instructional-placement rules the
/// template comments already documented (AI Interactive Video Lesson
/// Generator §5/§6): rotate across all four Question Event types rather than
/// defaulting to multiple choice, place each checkpoint where it instructionally
/// fits, and don't insert questions randomly. Those rules now live in the
/// prompt instead of a hardcoded array — everything downstream (the
/// <see cref="SuggestedQuestion"/> shape, the tutor's Accept/Remove flow, the
/// entitlement gate) is unchanged.
/// </summary>
public class GenerateQuestionsSkill(AiOrchestrator orchestrator)
{
    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI Interactive Video Lesson
        Generator. Given a lesson's title, its written content, and its video
        duration, propose timestamped interactive checkpoints for a tutor to
        review, edit, and accept or remove. Nothing you suggest is saved
        automatically — treat every suggestion as a draft for human review.

        Rules:
        - Question types are exactly one of: MultipleChoice, TrueFalse,
          CompleteTheSentence, OpenAnswer.
        - Rotate across multiple question types rather than defaulting
          everything to MultipleChoice.
        - Place each checkpoint at a video timestamp where it instructionally
          fits: right after an explanation for knowledge checks, before an
          example for predictions, at natural terminology moments for
          CompleteTheSentence, and near the end for a closing summary check.
        - Do not insert questions randomly or too close together.
        - Base every question on the actual lesson content given to you, not
          generic filler.
        - MultipleChoice needs 4 Options and a zero-based CorrectOptionIndex.
        - TrueFalse needs Options ["True", "False"] and a CorrectOptionIndex.
        - CompleteTheSentence needs AcceptedAnswers (no Options,
          no CorrectOptionIndex).
        - OpenAnswer needs no Options, no CorrectOptionIndex, no
          AcceptedAnswers — it is reviewed for participation, not graded.

        Respond with JSON only — an array of objects, no prose, no markdown
        code fences — matching exactly this shape:

        [
          {
            "type": "MultipleChoice" | "TrueFalse" | "CompleteTheSentence" | "OpenAnswer",
            "prompt": "string",
            "options": ["string", ...],
            "correctOptionIndex": number | null,
            "acceptedAnswers": ["string", ...],
            "explanation": "string",
            "videoTimestampSeconds": number,
            "points": number
          }
        ]
        """;

    public async Task<IReadOnlyList<SuggestedQuestion>> SuggestAsync(
        string lessonTitle, string? lessonBody, int videoDurationSeconds, int count, CancellationToken ct = default)
    {
        var userPrompt = $"""
            Lesson title: {lessonTitle}

            Lesson content:
            {(string.IsNullOrWhiteSpace(lessonBody) ? "(no written content provided — base questions on the title alone)" : lessonBody)}

            Video duration: {videoDurationSeconds} seconds

            Propose exactly {count} checkpoint question(s), each with
            videoTimestampSeconds between 0 and {videoDurationSeconds}.
            """;

        var suggestions = await orchestrator.RunAsync<List<SuggestedQuestion>>(SystemPrompt, userPrompt, ct);

        // Defensive clamp: a model-proposed timestamp outside the video's
        // actual duration would place a checkpoint nobody can reach. Options
        // and AcceptedAnswers get the same treatment — the system prompt
        // above tells the model to omit them for question types that don't
        // use them, and a model that complies (or just forgets the field)
        // deserializes into a C# null despite the record's non-nullable
        // IReadOnlyList<string> type, which the frontend was never written
        // to expect (it crashed the whole page — see AnswerKeyDisplay).
        return suggestions
            .Select(s => s with
            {
                VideoTimestampSeconds = Math.Clamp(s.VideoTimestampSeconds, 0, Math.Max(videoDurationSeconds - 1, 0)),
                Points = s.Points <= 0 ? 1 : s.Points,
                Options = s.Options ?? [],
                AcceptedAnswers = s.AcceptedAnswers ?? []
            })
            .Take(count)
            .ToList();
    }

    // ── Chapter-grounded generation (AI Video-Grounded Questions Implementation Plan §5) ──
    //
    // One question per Speechmatics-detected chapter, instead of the whole
    // lesson at once. The model is given only one chapter's own content and
    // asked for exactly one question of a caller-chosen type — type rotation
    // moves to AssessmentService (round-robin across chapters), since each
    // call here has no memory of what type earlier chapters got. The
    // timestamp this returns is never trusted: the caller always overwrites
    // it with the chapter's real, deterministic start time, so the prompt
    // doesn't ask the model to reason about placement at all.

    private const string ChapterSystemPrompt = """
        You are the Learning Workspace Platform's AI Interactive Video Lesson
        Generator. You are given one chapter of a lesson's video — its title
        and a short summary of what's covered in that chapter specifically —
        and must propose exactly one checkpoint question grounded in that
        chapter's content, of a specific question type given to you. Nothing
        you suggest is saved automatically — treat it as a draft for human
        review.

        Rules:
        - Base the question only on the given chapter's content, not the
          lesson as a whole — this is one checkpoint for one chapter.
        - Use exactly the question type given to you.
        - MultipleChoice needs 4 Options and a zero-based CorrectOptionIndex.
        - TrueFalse needs Options ["True", "False"] and a CorrectOptionIndex.
        - CompleteTheSentence needs AcceptedAnswers (no Options,
          no CorrectOptionIndex).
        - OpenAnswer needs no Options, no CorrectOptionIndex, no
          AcceptedAnswers — it is reviewed for participation, not graded.
        - Set videoTimestampSeconds to 0 — the caller assigns the real value
          itself and ignores whatever is returned here.

        Respond with JSON only — a single-element array, no prose, no
        markdown code fences — matching exactly this shape:

        [
          {
            "type": "MultipleChoice" | "TrueFalse" | "CompleteTheSentence" | "OpenAnswer",
            "prompt": "string",
            "options": ["string", ...],
            "correctOptionIndex": number | null,
            "acceptedAnswers": ["string", ...],
            "explanation": "string",
            "videoTimestampSeconds": 0,
            "points": number
          }
        ]
        """;

    public async Task<SuggestedQuestion> SuggestForChapterAsync(
        string lessonTitle, string chapterTitle, string? chapterSummary, string questionType, CancellationToken ct = default)
    {
        var userPrompt = $"""
            Lesson title: {lessonTitle}

            Chapter title: {chapterTitle}
            Chapter summary: {(string.IsNullOrWhiteSpace(chapterSummary) ? "(none given — base the question on the chapter title alone)" : chapterSummary)}

            Required question type: {questionType}
            """;

        var suggestions = await orchestrator.RunAsync<List<SuggestedQuestion>>(ChapterSystemPrompt, userPrompt, ct);
        var suggestion = suggestions.FirstOrDefault()
            ?? throw new InvalidOperationException("The model returned no question for this chapter.");

        // Same null-guard as SuggestAsync above — Options/AcceptedAnswers
        // must never reach the caller as null despite the model being told
        // to omit them for question types that don't use them.
        return suggestion with
        {
            Points = suggestion.Points <= 0 ? 1 : suggestion.Points,
            Options = suggestion.Options ?? [],
            AcceptedAnswers = suggestion.AcceptedAnswers ?? []
        };
    }
}
