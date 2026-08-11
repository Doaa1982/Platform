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
        You are the Learning Workspace Platform's practice quiz generator. A
        learner has asked for a short self-check quiz on one lesson they are
        studying. You are given that lesson's own material — title, written
        body, video transcript (if any), and the tutor's supporting notes —
        plus a requested question count, difficulty, and an optional topic
        to focus on.

        Rules:
        - Base every question only on the material given. Do not invent facts
          the lesson doesn't cover, and do not draw on outside knowledge.
        - If a topic focus is given, every question must relate to that
          specific topic within the lesson; if none is given, cover the
          lesson broadly.
        - Every question is MultipleChoice with exactly 4 options and a
          zero-based CorrectOptionIndex.
        - "Easy" questions check direct recall of a stated fact or
          definition. "Medium" questions require connecting two ideas from
          the material. "Hard" questions require applying or reasoning about
          the material, not just recalling it.
        - Write a one-sentence Explanation for each question: why the correct
          answer is correct, referencing the lesson's material.
        - Produce exactly the requested number of questions.

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
        int questionCount, string difficulty, string? topic, CancellationToken ct = default)
    {
        var truncatedTranscript = Truncate(transcript, MaxTranscriptChars);

        var userPrompt = $"""
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

        var questions = await orchestrator.RunAsync<List<PracticeQuizQuestion>>(SystemPrompt, userPrompt, ct);

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
