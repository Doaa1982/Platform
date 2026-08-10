namespace Platform.Api.AI.Skills;

/// <summary>
/// The narrative half of "AI Evaluation" (Assessment and Submission
/// Aggregate Design §10). Scoring itself stays deterministic — <see cref="Platform.Domain.Assessment.Grade"/>
/// compares submitted answers against the real answer key a tutor authored,
/// and that never becomes an AI judgment call (AIC-005: capabilities don't
/// own business data, they generate recommendations from data other domains
/// own). What this skill adds is the one thing a fixed answer key can't do:
/// read the learner's actual OpenAnswer text and comment on it, rather than
/// the previous canned "reviewed for participation only" line.
/// </summary>
public class GradeAssessmentSkill(AiOrchestrator orchestrator)
{
    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI assessment reviewer.
        You are given a learner's quiz result: the auto-graded score (already
        computed — never recompute or second-guess it) and any open-ended
        answers the learner wrote, alongside each question's prompt.

        Write one short paragraph of feedback for the learner:
        - Acknowledge the score and whether they passed, in plain language.
        - If there are open-ended answers, briefly and specifically comment
          on what the learner actually wrote — is the reasoning sound, does
          it engage with the question, what's missing or strong. Do not
          invent a pass/fail judgment for open answers; they are reviewed,
          not scored.
        - If there are no open-ended answers, keep it to the score summary.
        - Keep it encouraging but honest. Do not pad with generic praise.
        - Two to four sentences. Plain text only, no markdown, no lists.
        """;

    public async Task<string> ReviewAsync(
        string lessonTitle, int scorePercent, bool passed, int passingThreshold,
        IReadOnlyList<(string Prompt, string Answer)> openAnswers, CancellationToken ct = default)
    {
        var openAnswerBlock = openAnswers.Count == 0
            ? "(no open-ended questions on this assessment)"
            : string.Join("\n\n", openAnswers.Select((a, i) =>
                $"Open question {i + 1}: {a.Prompt}\nLearner's answer: {(string.IsNullOrWhiteSpace(a.Answer) ? "(left blank)" : a.Answer)}"));

        var userPrompt = $"""
            Lesson: {lessonTitle}
            Score: {scorePercent}% ({(passed ? "passed" : "did not pass")}, passing threshold {passingThreshold}%)

            {openAnswerBlock}
            """;

        var feedback = await orchestrator.RunTextAsync(SystemPrompt, userPrompt, ct);
        return feedback.Trim();
    }
}
