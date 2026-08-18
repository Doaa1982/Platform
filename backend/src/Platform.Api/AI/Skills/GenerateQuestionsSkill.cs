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
    /// <summary>Same cap GenerateStandaloneQuestionsSkill uses — a full lesson transcript can run well past what's useful (or affordable) to send on every suggestion request.</summary>
    private const int MaxTranscriptChars = 12000;

    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI Interactive Video Lesson Generator.

        Your task is to propose timestamped interactive checkpoints for a tutor to review,
        edit, accept, or remove.

        Nothing you generate is saved automatically. Every checkpoint is a draft suggestion
        for human review.

        INPUT

        You may receive:

        - Lesson title
        - Lesson written content
        - Video duration in seconds
        - Video transcript
        - Transcript segments with timestamps
        - Requested number of checkpoints

        CONTENT RULES

        - Base every question strictly on the actual lesson content and transcript.
        - Every question must be answerable using information explicitly taught in the
          provided lesson.
        - Do not use unrelated general knowledge.
        - Do not invent facts, examples, terminology, or concepts that are not supported
          by the lesson.
        - Use the transcript as the primary source for deciding where a checkpoint belongs
          in the video.
        - Use the lesson written content to verify the instructional relevance and
          correctness of the question.
        - If the transcript and written content conflict, do not invent a resolution.
          Prefer the tutor-provided transcript when it represents the tutor's spoken
          lesson, but avoid creating questions from information that is clearly absent
          from the lesson.

        QUESTION TYPES

        Question types are exactly one of:

        - MultipleChoice
        - TrueFalse
        - CompleteTheSentence
        - OpenAnswer

        Choose the question type based on instructional purpose.

        Do not force equal rotation of question types.

        Prefer:

        - MultipleChoice for distinguishing concepts, identifying correct applications,
          or testing conceptual understanding.
        - TrueFalse for checking a clear factual or conceptual statement.
        - CompleteTheSentence for important terminology, vocabulary, phrases, or recall.
        - OpenAnswer for explanation, application, comparison, reflection, or participation.

        TIMESTAMP RULES

        - Every checkpoint must have a timestamp between 0 and the video duration.
        - When timestamped transcript segments are provided, videoTimestampSeconds MUST be
          exactly the start second of the segment where the checkpoint belongs — copy the
          number shown in brackets, do not interpolate, round to a "nicer" number, or
          invent a value of your own.
        - When no timestamped segments are provided, place the timestamp using
          instructional judgment within the duration.
        - Place checkpoints at meaningful instructional moments.
        - Place knowledge checks after an explanation.
        - Place prediction questions before an example or demonstrated result.
        - Place terminology questions near the introduction or explanation of the term.
        - Place application questions after the learner has received enough information
          to apply the concept.
        - Place a closing summary check near the end when appropriate.
        - Do not place questions randomly.
        - Do not place a question during an uninterrupted explanation unless there is a
          clear instructional reason.
        - Do not place checkpoints during silence, music, introductions, or transitions
          unless pedagogically meaningful.
        - Do not place two checkpoints within 10 seconds of each other.
        - Do not place a checkpoint beyond the video duration.

        QUESTION QUALITY

        Every checkpoint must:

        - Test one clear idea.
        - Be understandable without unnecessary wording.
        - Be directly supported by the lesson.
        - Have a clear expected answer where applicable.
        - Avoid ambiguity.
        - Avoid duplication or near-duplication of another checkpoint.

        MULTIPLE CHOICE

        - Must contain exactly 4 options.
        - Exactly one option must be correct.
        - correctOptionIndex must identify the correct option using zero-based indexing.
        - Incorrect options must be plausible and related to the lesson.
        - Do not use obviously silly or unrelated distractors.
        - Do not use "All of the above" or "None of the above".
        - Avoid making the correct answer obviously identifiable by wording or length.

        TRUE/FALSE

        - Options must be exactly ["True", "False"].
        - correctOptionIndex must be 0 or 1.
        - The statement must be clearly true or false according to the lesson.
        - Avoid subjective, ambiguous, double-negative, or misleading statements.

        COMPLETE THE SENTENCE

        - Must contain no options.
        - Must contain no correctOptionIndex.
        - Must contain at least one accepted answer.
        - The sentence must have one clearly identifiable target answer.
        - AcceptedAnswers may include reasonable equivalent forms, spelling variants, or
          grammatical variants where appropriate.
        - Avoid sentences where multiple unrelated answers could reasonably be accepted.

        OPEN ANSWER

        - Must contain no options.
        - Must contain no correctOptionIndex.
        - Must contain no acceptedAnswers.
        - OpenAnswer questions are intended for participation, explanation, reflection,
          or application and are not automatically graded.
        - Prefer questions that encourage a meaningful response rather than a one-word
          answer.

        POINTS

        - MultipleChoice = 1 point.
        - TrueFalse = 1 point.
        - CompleteTheSentence = 1 point.
        - OpenAnswer = 0 points.

        EXPLANATION

        - Provide a concise explanation of why the correct answer is correct.
        - For OpenAnswer, provide a brief description of what a strong response should
          address.
        - The explanation must be based only on the lesson.

        LANGUAGE

        - Write prompt, options, acceptedAnswers, and explanation in the same
          language as the lesson content (the transcript, when available,
          otherwise the written lesson content) — unless an explicit output
          language is provided.
        - This does not apply to the JSON structure itself: "type" values
          (MultipleChoice/TrueFalse/CompleteTheSentence/OpenAnswer) and field
          names always stay exactly as specified in OUTPUT, regardless of
          the lesson's language.
        - For TrueFalse, keep options exactly ["True", "False"] in English
          even when the prompt itself is in another language — the backend
          always overwrites this field to the literal English pair when a
          question is saved, regardless of what is suggested here.

        CHECKPOINT COUNT

        - Generate approximately the requested number of checkpoints.
        - Do not create meaningless questions just to reach the requested count.
        - If the lesson does not contain enough meaningful material, return fewer
          checkpoints.

        FINAL VALIDATION

        Before returning each checkpoint, verify:

        1. It is supported by the lesson.
        2. The timestamp is instructionally appropriate.
        3. The question tests one clear idea.
        4. The answer is determinable when applicable.
        5. The question type follows its schema.
        6. It is not redundant with another checkpoint.
        7. It is sufficiently separated from other checkpoints.
        8. The timestamp is within the video duration.

        OUTPUT

        Respond with JSON only.

        Return an array of checkpoint objects.

        Use exactly this structure:

        [
          {
            "type": "MultipleChoice | TrueFalse | CompleteTheSentence | OpenAnswer",
            "prompt": "string",
            "options": ["string"] | null,
            "correctOptionIndex": number | null,
            "acceptedAnswers": ["string"] | null,
            "explanation": "string",
            "videoTimestampSeconds": number,
            "points": number
          }
        ]

        Field rules:

        MultipleChoice:
        - options = exactly 4 strings
        - correctOptionIndex = 0-3
        - acceptedAnswers = null
        - points = 1

        TrueFalse:
        - options = ["True", "False"]
        - correctOptionIndex = 0 or 1
        - acceptedAnswers = null
        - points = 1

        CompleteTheSentence:
        - options = null
        - correctOptionIndex = null
        - acceptedAnswers = one or more strings
        - points = 1

        OpenAnswer:
        - options = null
        - correctOptionIndex = null
        - acceptedAnswers = null
        - points = 0
        """;

    public async Task<IReadOnlyList<SuggestedQuestion>> SuggestAsync(
        string lessonTitle, string? lessonBody, string? transcript, IReadOnlyList<TranscriptSegment>? segments,
        int videoDurationSeconds, int count, string? outputLanguage, CancellationToken ct = default)
    {
        var hasSegments = segments is { Count: > 0 };
        var languageDirective = string.IsNullOrWhiteSpace(outputLanguage)
            ? ""
            : $"Output language: {outputLanguage}\n\n";

        var transcriptBlock = hasSegments
            ? $"""
               Timestamped video transcript (each line is "[start seconds] spoken text" —
               these are real, measured moments in the video; use the exact number shown,
               never a value you invent):
               {Truncate(BuildTimestampedTranscript(segments!), MaxTranscriptChars)}
               """
            : !string.IsNullOrWhiteSpace(transcript)
                ? $"""
                   Video transcript (no segment-level timing available for this video —
                   place checkpoints using instructional judgment within the duration):
                   {Truncate(transcript, MaxTranscriptChars)}
                   """
                : "Video transcript: (none available — base questions on the lesson content/title alone)";

        var userPrompt = languageDirective + $"""
            Lesson title: {lessonTitle}

            Lesson content:
            {(string.IsNullOrWhiteSpace(lessonBody) ? "(no written content provided — base questions on the title alone)" : lessonBody)}

            {transcriptBlock}

            Video duration: {videoDurationSeconds} seconds

            Propose exactly {count} checkpoint question(s), each with
            videoTimestampSeconds between 0 and {videoDurationSeconds}.
            """;

        var suggestions = await orchestrator.RunAsync<List<SuggestedQuestion>>(
            SystemPrompt, userPrompt, isValid: HasUsableContent, ct: ct);

        // Defensive clamp: a model-proposed timestamp outside the video's
        // actual duration would place a checkpoint nobody can reach. Options
        // and AcceptedAnswers get the same treatment — the system prompt
        // above tells the model to omit them for question types that don't
        // use them, and a model that complies (or just forgets the field)
        // deserializes into a C# null despite the record's non-nullable
        // IReadOnlyList<string> type, which the frontend was never written
        // to expect (it crashed the whole page — see AnswerKeyDisplay).
        //
        // When real segment timing is available, the timestamp isn't just
        // clamped — it's snapped to the nearest actual segment start, so the
        // final value is always a real moment in the video (AI
        // Video-Grounded Questions Implementation Plan), not merely "in
        // bounds". Same discipline the chapter-grounded path already applies
        // via SuggestFromChaptersAsync, extended to this duration-based path.
        return suggestions
            .Select(s => s with
            {
                VideoTimestampSeconds = Math.Clamp(
                    hasSegments ? SnapToNearestSegment(s.VideoTimestampSeconds, segments!) : s.VideoTimestampSeconds,
                    0, Math.Max(videoDurationSeconds - 1, 0)),
                Points = s.Points <= 0 ? 1 : s.Points,
                Options = s.Options ?? [],
                AcceptedAnswers = s.AcceptedAnswers ?? []
            })
            .Take(count)
            .ToList();
    }

    private static string BuildTimestampedTranscript(IReadOnlyList<TranscriptSegment> segments) =>
        string.Join("\n", segments.Select(s => $"[{(int)Math.Round(s.Start)}] {s.Text}"));

    private static int SnapToNearestSegment(int proposed, IReadOnlyList<TranscriptSegment> segments) =>
        (int)Math.Round(segments.MinBy(s => Math.Abs(s.Start - proposed))!.Start);

    private static string Truncate(string text, int maxChars) =>
        text.Length <= maxChars ? text : text[..maxChars] + " …(transcript truncated)";

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
        - Write prompt, options, acceptedAnswers, and explanation in the same
          language as the chapter title/summary, unless an explicit output
          language is requested — except TrueFalse's options, which must stay
          exactly ["True", "False"] in English regardless: the backend always
          overwrites this field to that literal pair when a question is saved.

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
        string lessonTitle, string chapterTitle, string? chapterSummary, string questionType,
        string? outputLanguage, CancellationToken ct = default)
    {
        var languageDirective = string.IsNullOrWhiteSpace(outputLanguage)
            ? ""
            : $"Output language: {outputLanguage}\n\n";

        var userPrompt = languageDirective + $"""
            Lesson title: {lessonTitle}

            Chapter title: {chapterTitle}
            Chapter summary: {(string.IsNullOrWhiteSpace(chapterSummary) ? "(none given — base the question on the chapter title alone)" : chapterSummary)}

            Required question type: {questionType}
            """;

        var suggestions = await orchestrator.RunAsync<List<SuggestedQuestion>>(
            ChapterSystemPrompt, userPrompt, isValid: HasUsableContent, ct: ct);
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

    /// <summary>
    /// Guards against a model that returns syntactically valid JSON shaped
    /// like the requested schema but with its actual content under the
    /// wrong property names — every timestamp real, every Prompt empty. See
    /// <see cref="AiOrchestrator.RunAsync{T}"/>'s isValid remarks.
    /// </summary>
    private static bool HasUsableContent(List<SuggestedQuestion> suggestions) =>
        suggestions.Count > 0 && suggestions.All(s => !string.IsNullOrWhiteSpace(s.Prompt));
}
