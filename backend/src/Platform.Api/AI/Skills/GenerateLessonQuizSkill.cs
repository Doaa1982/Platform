using Platform.Api.Models;

namespace Platform.Api.AI.Skills;

/// <summary>
/// The Studio-style "Quiz" output alongside the in-lesson AI Assistant
/// (<see cref="LessonAssistantSkill"/>) — a learner-triggered, ungraded
/// self-check generated on demand from one lesson's own material, with a
/// configurable question count, difficulty, and optional topic focus.
///
/// Deliberately distinct from <see cref="GenerateQuestionsSkill"/>: that one
/// drafts checkpoints a tutor reviews and publishes into the real, graded
/// Assessment a learner's Submission is scored against (AIC-005: business
/// data stays owned by its domain). This one is never reviewed, never
/// persisted, and never touches Submission/LessonProgress — it exists only
/// so a learner can test themselves and get immediate feedback, the same
/// spirit as the Assistant's Q&amp;A, just structured as questions instead of
/// a chat reply.
/// </summary>
public class GenerateLessonQuizSkill(AiOrchestrator orchestrator)
{
    private const int MaxTranscriptChars = 12000;

    private const string SystemPrompt = """
        You are the Learning Workspace Platform's practice quiz generator.

        A learner has asked for a short self-check quiz on one lesson they are
        currently studying, to test themselves before moving on.

        This quiz is generated on demand for the learner's own practice. It is
        never reviewed by a tutor, never saved, never graded, and never
        affects the learner's progress or record — it exists purely so the
        learner gets immediate, low-stakes feedback on their own understanding.

        INPUT

        You are given the lesson's own material:

        - Lesson title
        - Written lesson body, when available
        - Video transcript, when available
        - What learners will learn, when available
        - Learning objectives, when available
        - Glossary, when available
        - A requested question count, difficulty, and an optional topic focus

        SOURCE PRIORITY

        Use the best available lesson information, combining sources when
        more than one is available. The video transcript, when present, is
        the most direct record of what was actually taught — prefer it when
        sources appear to conflict.

        CONTENT RULES

        - Base every question strictly on the material given to you.
        - Do not invent facts, examples, terminology, or concepts the lesson
          does not cover.
        - Do not draw on outside general knowledge to fill gaps — if the
          material doesn't support a question, don't ask it.
        - If a topic focus is given, every question must relate to that
          specific topic within the lesson. Do not drift into unrelated parts
          of the lesson just to reach the requested count.
        - If no topic focus is given, cover the lesson broadly rather than
          clustering every question around one section.

        DIFFICULTY

        - "Easy": direct recall of a single fact, definition, or step stated
          plainly in the lesson.
        - "Medium": requires connecting two related ideas, facts, or steps
          from the material — not a single isolated fact.
        - "Hard": requires applying the material to a new but closely related
          situation, or reasoning about why/how something works, not just
          restating what was said.
        - Every question should genuinely match the requested difficulty —
          do not label an easy recall question as "Hard" just to satisfy the
          request.

        QUESTION QUALITY

        - Each question tests exactly one clear idea.
        - Avoid ambiguous, trick, or double-negative phrasing.
        - Avoid duplicate or near-duplicate questions.
        - A question should be answerable by someone who paid attention to
          the lesson, without needing outside knowledge.

        MULTIPLE CHOICE

        - Every question is MultipleChoice with exactly 4 options.
        - Exactly one option is correct; correctOptionIndex identifies it
          using zero-based indexing.
        - Incorrect options must be plausible and related to the lesson's
          actual content — not obviously wrong or silly.
        - Do not use "All of the above" or "None of the above".
        - Avoid making the correct answer identifiable purely by its wording,
          length, or position.

        EXPLANATION

        - Write one concise sentence explaining why the correct answer is
          correct, grounded in the lesson's material.
        - Do not introduce new information in the explanation that wasn't
          part of the question or the lesson.

        QUESTION COUNT

        - Produce exactly the requested number of questions when the
          material supports it.
        - Do not pad with filler, repeated ideas, or unrelated trivia just to
          reach the count — if the material is too thin, return fewer
          genuinely useful questions instead.

        LANGUAGE

        - Write prompt, options, and explanation in the same language as the
          lesson content (the transcript, when available, otherwise the
          written lesson content) — unless an explicit output language is
          provided.
        - This does not apply to the JSON field names, which always stay
          exactly as specified in OUTPUT.

        OUTPUT

        Respond with JSON only — an array of objects, no prose, no markdown
        code fences — matching exactly this shape:

        [
          {
            "prompt": "string",
            "options": ["string", "string", "string", "string"],
            "correctOptionIndex": number,
            "explanation": "string"
          }
        ]
        """;

    public async Task<IReadOnlyList<PracticeQuizQuestion>> GenerateAsync(
        string lessonTitle, string? body, string? transcript,
        string? whatYoullLearn, string? learningObjectives, string? glossary,
        int questionCount, string difficulty, string? topic, string? outputLanguage, CancellationToken ct = default)
    {
        var truncatedTranscript = Truncate(transcript, MaxTranscriptChars);

        var languageDirective = string.IsNullOrWhiteSpace(outputLanguage)
            ? ""
            : $"Output language: {outputLanguage}\n\n";

        var userPrompt = languageDirective + $"""
            Lesson: {lessonTitle}

            Lesson body:
            {body ?? "(none)"}

            What learners will learn:
            {whatYoullLearn ?? "(none)"}

            Learning objectives:
            {learningObjectives ?? "(none)"}

            Glossary:
            {glossary ?? "(none)"}

            Video transcript:
            {truncatedTranscript ?? "(no video, or not yet transcribed)"}

            Requested question count: {questionCount}
            Requested difficulty: {difficulty}
            Topic focus: {(string.IsNullOrWhiteSpace(topic) ? "(none — cover the lesson broadly)" : topic)}
            """;

        var questions = await orchestrator.RunAsync<List<PracticeQuizQuestion>>(
            SystemPrompt, userPrompt,
            isValid: qs => qs.Count > 0 && qs.All(q => !string.IsNullOrWhiteSpace(q.Prompt)),
            ct: ct);

        // Defensive clamp: a model that ignores the requested count (common
        // enough not to trust blindly) shouldn't hand the learner a quiz
        // longer or shorter than what they asked for in the Studio modal.
        return questions.Take(questionCount).ToList();
    }

    private static string? Truncate(string? text, int maxChars)
    {
        if (string.IsNullOrEmpty(text) || text.Length <= maxChars) return text;
        return text[..maxChars] + " …(transcript truncated)";
    }
}
