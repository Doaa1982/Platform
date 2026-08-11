namespace Platform.Api.AI.Skills;

/// <summary>
/// The Learner-facing "AI Assistant" nav item (previously a NotBuiltYet
/// placeholder). Deliberately narrow, same spirit as <see cref="GradeAssessmentSkill"/>:
/// this answers questions using only the one lesson's own material — its
/// body, transcript, and AI-authored supporting fields — never general
/// knowledge. A learner asking something the lesson doesn't cover should get
/// an honest "this lesson doesn't cover that", not a plausible-sounding
/// answer sourced from the model's training data (AIC-005 in spirit: the
/// assistant doesn't invent facts a lesson never taught).
/// </summary>
public class LessonAssistantSkill(AiOrchestrator orchestrator)
{
    // Video transcripts can run long; capped so one lesson's context stays a
    // bounded, predictable cost per question rather than growing unbounded
    // with video length. A few thousand words is enough for a model to
    // ground an answer without needing the transcript verbatim in full.
    private const int MaxTranscriptChars = 12000;

    private const string SystemPrompt = """
        You are the Learning Workspace Platform's in-lesson AI Assistant. A
        learner is asking a question while viewing one specific lesson, and
        you are given that lesson's own material below: its title, written
        body, video transcript (if any), and the tutor's supporting notes
        (what they'll learn, learning objectives, glossary).

        Rules:
        - Answer using only the material provided. Do not draw on outside
          knowledge, even if you're confident about the general topic.
        - If the answer is genuinely in the material, answer it directly and
          specifically — reference what the lesson actually says, don't just
          gesture at it.
        - If the question is not answered by this lesson's material —
          whether it's off-topic or just goes further than this lesson
          covers — say plainly that this lesson doesn't cover it, and
          suggest the learner ask their tutor or check a later lesson. Do
          not guess.
        - Keep answers short: two to five sentences. Plain text only, no
          markdown, no lists, no headers.
        - Encouraging, plain-spoken tone — you're helping someone study, not
          grading them.
        """;

    public async Task<string> AnswerAsync(
        string lessonTitle, string? body, string? transcript,
        string? whatYoullLearn, string? learningObjectives, string? glossary,
        string question, CancellationToken ct = default)
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

            Learner's question: {question}
            """;

        var answer = await orchestrator.RunTextAsync(SystemPrompt, userPrompt, ct);
        return answer.Trim();
    }

    private static string? Truncate(string? text, int maxChars)
    {
        if (string.IsNullOrEmpty(text) || text.Length <= maxChars) return text;
        return text[..maxChars] + " …(transcript truncated)";
    }
}
