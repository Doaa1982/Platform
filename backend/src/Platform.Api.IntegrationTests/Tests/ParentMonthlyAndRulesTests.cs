using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.Email;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Parent Progress Reports BA §8–§9 (monthly summary) and §5–§7 (who may touch which contact, the
/// two-parent limit, and links that only ever do their one job for their one contact).
/// </summary>
public class ParentMonthlyAndRulesTests(PlatformApiTestFixture fixture) : ParentReportsTestBase(fixture), IClassFixture<PlatformApiTestFixture>
{
    [Fact]
    public async Task Monthly_Summary_Goes_Once_Per_Active_Learner_And_Skips_Learners_With_No_Activity()
    {
        var c = await SeedCourseAsync("pr-month");
        var activeId = await LearnerMembershipIdAsync(c, LearnerEmail("pr-month"));
        await EnrollLearnerAsync(c, "pr-month-quiet");
        var quietId = await LearnerMembershipIdAsync(c, "pr-month-quiet@integrationtest.local");
        await AddParentAsync(c, activeId, "Hala", "hala-month@parents.test");
        await AddParentAsync(c, quietId, "Mona", "mona-month@parents.test");
        await ConfirmParentAsync(c, "hala-month@parents.test");
        await ConfirmParentAsync(c, "mona-month@parents.test");
        await SetReportsAsync(c, results: false, monthly: true);

        // This month: the active learner has one marked assignment (no due date, so the quiet one
        // hasn't "missed" it) and one quiz; the quiet learner did nothing.
        var homework = await AssignHomeworkAsync(c, "Weekly practice", withDueDate: false);
        await EvaluateRaw(c, homework, await SubmitHomeworkAsync(c, homework, c.LearnerToken), passed: true);
        await AnswerLessonQuestionsAsync(c, c.LearnerToken, activeId);
        Assert.Empty(Mail.To("hala-month@parents.test", EmailTemplate.ParentAssignmentResult)); // results switched off

        // Run "on the 1st of next month" (Cairo): the summary covers this month.
        var today = ParentReportService.CairoToday(DateTime.UtcNow);
        var firstOfNext = new DateOnly(today.Year, today.Month, 1).AddMonths(1);
        var asOf = firstOfNext.ToDateTime(new TimeOnly(10, 0), DateTimeKind.Utc);

        var sent = await WithServiceAsync(sp => sp.GetRequiredService<ParentReportService>().SendMonthlySummariesAsync(asOf));
        Assert.Equal(1, sent);
        var summary = Assert.Single(Mail.To("hala-month@parents.test", EmailTemplate.ParentMonthlySummary));
        Assert.Contains("Assignments completed: 1", summary.Content.Text);
        Assert.Contains("Quizzes completed: 1", summary.Content.Text);
        Assert.Contains("Average quiz score: 100%", summary.Content.Text);
        Assert.DoesNotContain("pr-month-quiet", summary.Content.Text, StringComparison.OrdinalIgnoreCase); // never another learner's data
        Assert.Empty(Mail.To("mona-month@parents.test", EmailTemplate.ParentMonthlySummary)); // no activity, skipped

        // Running again in the same month sends nothing new.
        Assert.Equal(0, await WithServiceAsync(sp => sp.GetRequiredService<ParentReportService>().SendMonthlySummariesAsync(asOf.AddHours(5))));
        Assert.Single(Mail.To("hala-month@parents.test", EmailTemplate.ParentMonthlySummary));
    }

    [Fact]
    public async Task Learners_And_Tutors_Only_Reach_Their_Own_Contacts_And_A_Learner_Has_At_Most_Two()
    {
        var a = await SeedCourseAsync("pr-rules-a");
        var b = await SeedCourseAsync("pr-rules-b");
        await EnrollLearnerAsync(a, "pr-rules-other");
        var otherId = await LearnerMembershipIdAsync(a, "pr-rules-other@integrationtest.local");
        var othersParent = await AddParentAsync(a, otherId, "Other parent", "other@parents.test");

        // The learner adds their own two parents; a third is refused.
        var me = $"/api/workspaces/{a.Slug}/me/parent-contacts";
        await LearnerPost(a, a.LearnerToken, me, new { name = "Mum", email = "mum@parents.test", language = "ar" });
        await LearnerPost(a, a.LearnerToken, me, new { name = "Dad", email = "dad@parents.test", language = "en" });
        Assert.Equal(HttpStatusCode.Conflict, (await LearnerRaw(a, a.LearnerToken, HttpMethod.Post, me, new { name = "Aunt", email = "aunt@parents.test" })).StatusCode);
        Assert.Equal(2, (await Learner(a, me))["contacts"]!.AsArray().Count);

        // ...but can't remove someone else's, or use the tutor's routes for another learner.
        Assert.Equal(HttpStatusCode.NotFound, (await LearnerRaw(a, a.LearnerToken, HttpMethod.Delete, $"{me}/{othersParent}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await LearnerRaw(a, a.LearnerToken, HttpMethod.Post,
            $"/api/workspaces/{a.Slug}/members/{otherId}/parent-contacts", new { name = "X", email = "x@parents.test" })).StatusCode);

        // Another workspace's tutor can't see or change this one's contacts.
        var bAsA = b with { Slug = a.Slug };
        Assert.Equal(HttpStatusCode.NotFound, (await TutorRaw(bAsA, HttpMethod.Get, $"/api/workspaces/{a.Slug}/parent-contacts")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await TutorRaw(b, HttpMethod.Delete, $"/api/workspaces/{b.Slug}/parent-contacts/{othersParent}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await TutorRaw(b, HttpMethod.Put, $"/api/workspaces/{b.Slug}/parent-contacts/{othersParent}",
            new { name = "Changed", email = "other@parents.test" })).StatusCode);

        // The tutor's limit is the same two.
        await AddParentAsync(a, otherId, "Second", "second@parents.test");
        Assert.Equal(HttpStatusCode.Conflict, (await TutorRaw(a, HttpMethod.Post, $"/api/workspaces/{a.Slug}/members/{otherId}/parent-contacts",
            new { name = "Third", email = "third@parents.test" })).StatusCode);
    }

    [Fact]
    public async Task A_Link_Only_Works_For_Its_Own_Contact_Purpose_And_Round()
    {
        var c = await SeedCourseAsync("pr-links");
        var learnerId = await LearnerMembershipIdAsync(c, LearnerEmail("pr-links"));
        await AddParentAsync(c, learnerId, "Hala", "hala-links@parents.test");
        var omarId = await AddParentAsync(c, learnerId, "Omar", "omar-links@parents.test");
        var halaConfirm = LinkToken("hala-links@parents.test", "confirm");

        // A confirm link can't unsubscribe.
        Assert.Equal("Invalid", (await RedeemAsync(c, "unsubscribe", halaConfirm))["status"]!.GetValue<string>());

        // Hala's link with Omar's id swapped in fails the signature.
        var parts = halaConfirm.Split('.');
        var payload = FromBase64Url(parts[1]);
        omarId.TryWriteBytes(payload.AsSpan(1, 16));
        var forged = $"p1.{ToBase64Url(payload)}.{parts[2]}";
        Assert.Equal("Invalid", (await RedeemAsync(c, "confirm", forged))["status"]!.GetValue<string>());
        var contacts = await Tutor(c, HttpMethod.Get, $"/api/workspaces/{c.Slug}/parent-contacts");
        Assert.All(contacts["contacts"]!.AsArray(), p => Assert.Equal("Waiting", p!["status"]!.GetValue<string>()));

        // Resending retires the older link; the new one works, and a second click is harmless.
        var halaId = contacts["contacts"]!.AsArray().First(p => p!["email"]!.GetValue<string>() == "hala-links@parents.test")!["id"]!.GetValue<Guid>();
        await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/parent-contacts/{halaId}/resend");
        Assert.Equal("Invalid", (await RedeemAsync(c, "confirm", halaConfirm))["status"]!.GetValue<string>());
        var fresh = LinkToken("hala-links@parents.test", "confirm");
        Assert.Equal("Confirmed", (await RedeemAsync(c, "confirm", fresh))["status"]!.GetValue<string>());
        Assert.Equal("Confirmed", (await RedeemAsync(c, "confirm", fresh))["status"]!.GetValue<string>());

        // Garbage is just invalid, never an error.
        Assert.Equal("Invalid", (await RedeemAsync(c, "confirm", "p1.nope.nope"))["status"]!.GetValue<string>());
    }

    private static byte[] FromBase64Url(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }

    private static string ToBase64Url(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
