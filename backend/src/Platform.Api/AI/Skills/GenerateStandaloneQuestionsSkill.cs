using Platform.Api.Models;
using Platform.Domain;

namespace Platform.Api.AI.Skills;

/// <summary>
/// AssessmentService.SuggestStandaloneQuestionsAsync's one caller — drafts
/// questions for a lesson's Standalone quiz (see AssessmentKind).
///
/// Deliberately distinct from <see cref="GenerateQuestionsSkill"/>: that one
/// places checkpoints at specific video timestamps, grounded in duration and
/// (optionally) chapter timing. This one has no video to place anything on —
/// it's grounded in the lesson's own text (title, body, transcript, the
/// tutor's supporting notes) the same way <see cref="GenerateLessonQuizSkill"/>
/// grounds the learner's practice quiz, but unlike that one, every question
/// here carries a real answer key (Options/CorrectOptionIndex/AcceptedAnswers)
/// since these become real, graded Assessment questions once the tutor
/// accepts them — never auto-saved.
/// </summary>
public class GenerateStandaloneQuestionsSkill(AiOrchestrator orchestrator)
{
    private const int MaxTranscriptChars = 12000;

    private const string SystemPrompt = """
        You are the Learning Workspace Platform's AI question generator for a
        lesson's standalone quiz — a separate self-contained quiz for one
        lesson, not tied to any video timeline. You are given the lesson's own
        material (title, written body, video transcript if any, and the
        tutor's supporting notes) and must propose draft questions for the
        tutor to review, edit, and accept or remove. Nothing you suggest is
        saved automatically.

        Rules:
        - Question types are exactly one of: MultipleChoice, TrueFalse,
          CompleteTheSentence, OpenAnswer.
        - Rotate across multiple question types rather than defaulting
          everything to MultipleChoice.
        - Base every question on the actual lesson material given to you, not
          generic filler or outside knowledge.
        - MultipleChoice needs 4 Options and a zero-based CorrectOptionIndex.
        - TrueFalse needs Options ["True", "False"] and a CorrectOptionIndex.
        - CompleteTheSentence needs AcceptedAnswers (no Options,
          no CorrectOptionIndex).
        - OpenAnswer needs no Options, no CorrectOptionIndex, no
          AcceptedAnswers — it is reviewed for participation, not graded.
        - Write a short Explanation for each question: why the correct answer
          is correct, referencing the lesson's material.
        - If learning objectives are given and a question clearly tests one
          of them, set assessedObjective to that objective's exact text;
          otherwise (or if none are given) set it to null. Never invent an
          objective that isn't one of the given ones.
        - Produce exactly the requested number of questions.
        - Write Prompt, Options, AcceptedAnswers, and Explanation in the same
          language as the lesson material (prefer the transcript when
          available) unless an explicit output language is requested — except
          TrueFalse's Options, which must stay exactly ["True", "False"] in
          English regardless: the backend always overwrites this field to
          that literal pair when a question is saved.

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
            "points": number,
            "assessedObjective": "string" | null
          }
        ]
        """;

    public async Task<IReadOnlyList<SuggestedStandaloneQuestion>> SuggestAsync(
        string lessonTitle, string? body, string? transcript,
        string? whatYoullLearn, string? learningObjectives, string? glossary,
        int questionCount, string? outputLanguage, Guid workspaceId, CancellationToken ct = default)
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

            Propose exactly {questionCount} question(s).
            """;

        var suggestions = await orchestrator.RunAsync<List<SuggestedStandaloneQuestion>>(
            SystemPrompt, userPrompt, workspaceId, AiSkillKeys.GenerateStandaloneQuestions, band: questionCount,
            // Also rejects a "type" outside the four real QuestionType values
            // (e.g. a math-heavy lesson producing "mathEquation") — see
            // GenerateQuestionsSkill.HasUsableContent's remarks for why this
            // has to be caught here rather than left for AssessmentService.
            isValid: qs => qs.Count > 0 && qs.All(q =>
                !string.IsNullOrWhiteSpace(q.Prompt) && Enum.TryParse<QuestionType>(q.Type, out _)),
            ct: ct);

        // Defensive clamp: a model that ignores the requested count or omits
        // Points shouldn't hand the tutor a malformed or oversized draft set.
        // Options/AcceptedAnswers get the same null-guard as
        // GenerateQuestionsSkill — see its remarks for why.
        return suggestions
            .Select(s => s with
            {
                Points = s.Points <= 0 ? 1 : s.Points,
                Options = s.Options ?? [],
                AcceptedAnswers = s.AcceptedAnswers ?? []
            })
            .Take(questionCount)
            .ToList();
    }

    private static string? Truncate(string? text, int maxChars)
    {
        if (string.IsNullOrEmpty(text) || text.Length <= maxChars) return text;
        return text[..maxChars] + " …(transcript truncated)";
    }
}
