using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.Email;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Domain;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Parent Progress Reports BA §8: a result email goes only to confirmed parents, only when the
/// academy has results switched on, only after the tutor's decision is saved — once — and a
/// failed email never fails the tutor's action. Quizzes: one email when graded, none for a
/// later grade override.
/// </summary>
public class ParentResultReportsTests(PlatformApiTestFixture fixture) : ParentReportsTestBase(fixture), IClassFixture<PlatformApiTestFixture>
{
    [Fact]
    public async Task Only_Confirmed_Parents_Get_Exactly_One_Email_After_The_Tutor_Issues_The_Result()
    {
        var c = await SeedCourseAsync("pr-results");
        var learnerId = await LearnerMembershipIdAsync(c, LearnerEmail("pr-results"));
        await AddParentAsync(c, learnerId, "Hala Ahmed", "hala@parents.test");
        await AddParentAsync(c, learnerId, "Omar Ahmed", "omar@parents.test");

        // Adding sends the confirmation email only — no report.
        Assert.Single(Mail.To("hala@parents.test"));
        Assert.Equal(EmailTemplate.ParentConfirmation, Mail.To("hala@parents.test")[0].Template);
        await ConfirmParentAsync(c, "hala@parents.test"); // Omar never confirms
        await SetReportsAsync(c, results: true, monthly: false);

        var homework = await AssignHomeworkAsync(c, "Practice: one-step equations");
        var submissionId = await SubmitHomeworkAsync(c, homework, c.LearnerToken);
        Assert.Empty(Mail.To("hala@parents.test", EmailTemplate.ParentAssignmentResult)); // nothing before the tutor decides

        Assert.Equal(HttpStatusCode.OK, (await EvaluateRaw(c, homework, submissionId, passed: true, feedback: "Clear steps, well done.")).StatusCode);

        var result = Assert.Single(Mail.To("hala@parents.test", EmailTemplate.ParentAssignmentResult));
        Assert.Contains("Practice: one-step equations", result.Content.Text);
        Assert.Contains("Clear steps, well done.", result.Content.Text);
        Assert.Contains("Algebra Basics", result.Content.Text);
        Assert.Contains("/parent/unsubscribe/", result.Content.Text);
        Assert.DoesNotContain("/invite/", result.Content.Html);
        Assert.EndsWith(" via Teach Tandem", result.FromDisplayName); // from the academy, not from the platform
        Assert.Empty(Mail.To("omar@parents.test", EmailTemplate.ParentAssignmentResult)); // not confirmed

        // Evaluating the same submission again is refused (conflict) — and sends nothing new.
        Assert.Equal(HttpStatusCode.Conflict, (await EvaluateRaw(c, homework, submissionId)).StatusCode);
        Assert.Single(Mail.To("hala@parents.test", EmailTemplate.ParentAssignmentResult));
    }

    [Fact]
    public async Task Switched_Off_Or_Unsubscribed_Means_No_Email_And_A_Failing_Email_Never_Fails_The_Evaluation()
    {
        var c = await SeedCourseAsync("pr-off");
        var learnerId = await LearnerMembershipIdAsync(c, LearnerEmail("pr-off"));
        await AddParentAsync(c, learnerId, "Hala", "hala-off@parents.test");
        await ConfirmParentAsync(c, "hala-off@parents.test");
        var homework = await AssignHomeworkAsync(c, "Homework one");

        // Results switched off (the default): nothing.
        var first = await SubmitHomeworkAsync(c, homework, c.LearnerToken);
        await EvaluateRaw(c, homework, first);
        Assert.Empty(Mail.To("hala-off@parents.test", EmailTemplate.ParentAssignmentResult));

        // Switched on, but the email transport throws: the tutor's evaluation still succeeds.
        await SetReportsAsync(c, results: true, monthly: false);
        var second = await AnotherAttemptAsync(c, homework);
        Mail.ThrowForParentEmails = true;
        Assert.Equal(HttpStatusCode.OK, (await EvaluateRaw(c, homework, second)).StatusCode);
        Mail.ThrowForParentEmails = false;
        var failed = await WithServiceAsync(sp => sp.GetRequiredService<PlatformDbContext>().ParentReportDeliveries
            .SingleAsync(d => d.SubjectKey == second.ToString("N")));
        Assert.False(failed.Succeeded);

        // Unsubscribed: nothing more.
        var unsub = await RedeemAsync(c, "unsubscribe", UnsubscribeTokenFor(learnerId, "hala-off@parents.test"));
        Assert.Equal("Unsubscribed", unsub["status"]!.GetValue<string>());
        var third = await AnotherAttemptAsync(c, homework);
        await EvaluateRaw(c, homework, third);
        Assert.Empty(Mail.To("hala-off@parents.test", EmailTemplate.ParentAssignmentResult));
    }

    [Fact]
    public async Task A_Graded_Quiz_Sends_One_Email_And_A_Later_Grade_Override_Sends_None()
    {
        var c = await SeedCourseAsync("pr-quiz");
        var learnerId = await LearnerMembershipIdAsync(c, LearnerEmail("pr-quiz"));
        await AddParentAsync(c, learnerId, "Hala", "hala-quiz@parents.test", language: "ar");
        await ConfirmParentAsync(c, "hala-quiz@parents.test");
        await SetReportsAsync(c, results: true, monthly: false);

        var submissionId = await AnswerLessonQuestionsAsync(c, c.LearnerToken, learnerId);
        var email = Assert.Single(Mail.To("hala-quiz@parents.test", EmailTemplate.ParentQuizResult));
        Assert.Contains("100%", email.Content.Text);
        Assert.Contains("ناجح", email.Content.Text);      // Arabic, the parent's language
        Assert.Contains("dir=\"rtl\"", email.Content.Html);

        await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/assessments/submissions/{submissionId}/override",
            new { passed = false, scorePercent = 40, note = "Copied answer." });
        Assert.Single(Mail.To("hala-quiz@parents.test", EmailTemplate.ParentQuizResult));
    }

    /// <summary>The tutor resets the learner's attempts, and the learner submits again.</summary>
    private async Task<Guid> AnotherAttemptAsync(Course c, AssignedActivity homework)
    {
        var learnerId = await LearnerMembershipIdAsync(c, (await MeEmailAsync(c)));
        await Tutor(c, HttpMethod.Post, $"{homework.AssignmentPath}/attempts/{learnerId}/reset");
        return await SubmitHomeworkAsync(c, homework, c.LearnerToken);
    }

    private static async Task<string> MeEmailAsync(Course c) => (await Learner(c, "/api/me"))["email"]!.GetValue<string>();

    private string UnsubscribeTokenFor(Guid learnerId, string parentEmail) => WithService(sp =>
    {
        var db = sp.GetRequiredService<PlatformDbContext>();
        var contact = db.ParentContacts.Single(p => p.LearnerMembershipId == learnerId && p.Email == parentEmail);
        return sp.GetRequiredService<Platform.Api.Services.ParentLinkTokens>()
            .Issue(Platform.Api.Services.ParentLinkPurpose.Unsubscribe, contact.Id, contact.LinkVersion, DateTimeOffset.UtcNow.AddDays(30));
    });
}
