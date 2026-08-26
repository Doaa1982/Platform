namespace Platform.Api.AI;

/// <summary>
/// Stable identifiers for every AI Skill that spends credits — shared between
/// each Skill's own `AiOrchestrator.RunAsync`/`RunTextAsync` call and
/// `SkillCreditCost`'s seeded price table (Documents/
/// AICreditsCommercialContractAndImplementationPlan.md §A2), so a renamed
/// C# class never silently breaks a priced skill's lookup.
/// </summary>
public static class AiSkillKeys
{
    public const string LessonAssistant = "LessonAssistantSkill";
    public const string GradeAssessment = "GradeAssessmentSkill";
    public const string GenerateQuestions = "GenerateQuestionsSkill";
    public const string GenerateStandaloneQuestions = "GenerateStandaloneQuestionsSkill";
    public const string GenerateLessonQuiz = "GenerateLessonQuizSkill";
    public const string GenerateLessonTitle = "GenerateLessonTitleSkill";
    public const string GenerateWorkspaceProfile = "GenerateWorkspaceProfileSkill";
    public const string GenerateLearningObjectives = "GenerateLearningObjectivesSkill";
    public const string GenerateWhatYoullLearn = "GenerateWhatYoullLearnSkill";
    public const string GenerateLessonBody = "GenerateLessonBodySkill";
    public const string GenerateHomework = "GenerateHomeworkSkill";
    public const string GenerateGlossary = "GenerateGlossarySkill";
    public const string GenerateProductDescription = "GenerateProductDescriptionSkill";
    public const string ExtractLessonContentFromResource = "ExtractLessonContentFromResourceSkill";
}
