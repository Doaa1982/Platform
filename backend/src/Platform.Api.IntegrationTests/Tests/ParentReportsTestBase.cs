using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Platform.Api.Email;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Api.Services;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Shared setup for the parent progress report tests: a host whose email delivery is captured
/// (and can be told to throw for parent emails), plus the calls those tests make — parents,
/// links, assignments, quizzes. Each test class instance gets its own host, so its own rate
/// limiter too.
/// </summary>
public abstract class ParentReportsTestBase : CourseScenarioTests, IDisposable
{
    protected sealed class Outbox : IEmailDelivery
    {
        public ConcurrentQueue<OutgoingEmail> Sent { get; } = new();
        public volatile bool ThrowForParentEmails;

        public Task<DeliveryOutcome> SendAsync(OutgoingEmail email, CancellationToken ct = default)
        {
            if (ThrowForParentEmails && email.Template.ToString().StartsWith("Parent", StringComparison.Ordinal))
                throw new InvalidOperationException("Simulated SMTP failure.");
            Sent.Enqueue(email);
            return Task.FromResult(DeliveryOutcome.Sent("email"));
        }

        public List<OutgoingEmail> To(string address, EmailTemplate? template = null) =>
            Sent.Where(e => e.ToAddress == address && (template is null || e.Template == template)).ToList();
    }

    protected readonly Outbox Mail = new();
    protected readonly WebApplicationFactory<Program> Host;

    protected override PlatformApiTestFixture Fixture { get; }

    protected ParentReportsTestBase(PlatformApiTestFixture fixture)
    {
        Fixture = fixture;
        Host = fixture.WithWebHostBuilder(b => b.ConfigureTestServices(s =>
        {
            s.RemoveAll<IEmailDelivery>();
            s.AddSingleton<IEmailDelivery>(Mail);
        }));
    }

    protected override HttpClient NewClient() => Host.CreateClient();

    public void Dispose() => Host.Dispose();

    // ── Parents ──────────────────────────────────────────────────────────────

    protected async Task<Guid> LearnerMembershipIdAsync(Course c, string email)
    {
        var members = await Tutor(c, HttpMethod.Get, $"/api/workspaces/{c.Slug}/members");
        return members["members"]!.AsArray().First(m => m!["email"]!.GetValue<string>() == email)!["membershipId"]!.GetValue<Guid>();
    }

    protected static async Task<Guid> AddParentAsync(Course c, Guid learnerMembershipId, string name, string email, string language = "en")
    {
        var row = await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/members/{learnerMembershipId}/parent-contacts",
            new { name, email, language, whatsAppPhone = (string?)null });
        return row["id"]!.GetValue<Guid>();
    }

    /// <summary>The token in the newest link of <paramref name="kind"/> ("confirm"/"unsubscribe") emailed to <paramref name="address"/>.</summary>
    protected string LinkToken(string address, string kind)
    {
        var email = Mail.To(address).Last(e => e.Content.Text.Contains($"/parent/{kind}/"));
        return Regex.Match(email.Content.Text, $@"/parent/{kind}/(p1\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)").Groups[1].Value;
    }

    protected async Task<JsonObject> RedeemAsync(Course c, string kind, string token)
    {
        var res = await c.Client.PostAsJsonAsync($"/api/parent-links/{kind}", new { token });
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<JsonObject>())!;
    }

    protected async Task ConfirmParentAsync(Course c, string parentEmail)
        => Assert.Equal("Confirmed", (await RedeemAsync(c, "confirm", LinkToken(parentEmail, "confirm")))["status"]!.GetValue<string>());

    protected static Task SetReportsAsync(Course c, bool results, bool monthly) =>
        Tutor(c, HttpMethod.Put, $"/api/workspaces/{c.Slug}/setup/parent-reports", new { results, monthlySummary = monthly });

    // ── Assignments ──────────────────────────────────────────────────────────

    protected sealed record AssignedActivity(Guid ActivityId, string AssignmentPath, string LearnerPath, string SubmissionsPath);

    /// <summary>A homework activity on lesson one, assigned and published.</summary>
    protected static async Task<AssignedActivity> AssignHomeworkAsync(Course c, string title, bool withDueDate = true)
    {
        var lessonPath = $"/api/workspaces/{c.Slug}/lessons/{c.LessonId}";
        await Tutor(c, HttpMethod.Post, $"{c.CurriculumPath}/edit");
        await Tutor(c, HttpMethod.Post, $"{lessonPath}/revisions");
        await Tutor(c, HttpMethod.Post, $"{lessonPath}/activities", new { type = "Homework", title, instructions = "Solve all five." });
        await Tutor(c, HttpMethod.Post, $"{c.CurriculumPath}/publish");
        var activityId = (await Tutor(c, HttpMethod.Get, lessonPath))["currentRevision"]!["learningActivities"]!.AsArray()
            .First(a => a!["title"]!.GetValue<string>() == title)!["id"]!.GetValue<Guid>();

        var path = $"{lessonPath}/activities/{activityId}/assignment";
        await Tutor(c, HttpMethod.Post, path);
        await Tutor(c, HttpMethod.Put, path, new
        {
            availabilityMode = "Immediate", dueDateMode = withDueDate ? "Fixed" : "None",
            dueAt = withDueDate ? DateTime.UtcNow.AddDays(7) : (DateTime?)null,
            attemptMode = "Single", evaluationMethod = "Manual",
        });
        await Tutor(c, HttpMethod.Post, $"{path}/publish");
        return new AssignedActivity(activityId, path,
            $"/api/workspaces/{c.Slug}/learn/lessons/{c.LessonId}/activities/{activityId}/assignment",
            $"/api/workspaces/{c.Slug}/assignments/lessons/{c.LessonId}/activities/{activityId}/submissions");
    }

    /// <summary>The learner submits a response; returns the submission id.</summary>
    protected static async Task<Guid> SubmitHomeworkAsync(Course c, AssignedActivity a, string learnerToken)
    {
        var started = await LearnerPost(c, learnerToken, $"{a.LearnerPath}/start");
        await LearnerPost(c, learnerToken, $"{a.LearnerPath}/submissions/{started["id"]!.GetValue<Guid>()}/respond",
            new { text = "x = 2", attachedLearningAssetId = (Guid?)null });
        return started["id"]!.GetValue<Guid>();
    }

    protected static Task<HttpResponseMessage> EvaluateRaw(Course c, AssignedActivity a, Guid submissionId, bool passed = true, string? feedback = "Well done.")
        => TutorRaw(c, HttpMethod.Post, $"{a.SubmissionsPath}/{submissionId}/evaluate", new { passed, feedback });

    // ── Quizzes ──────────────────────────────────────────────────────────────

    /// <summary>The learner answers lesson one's questions (the one question, correctly); returns the graded submission id.</summary>
    protected async Task<Guid> AnswerLessonQuestionsAsync(Course c, string learnerToken, Guid learnerMembershipId)
    {
        var learner = c with { LearnerToken = learnerToken };
        var question = (await LearnerLessonAsync(learner, c.LessonId)).Questions[0]!["id"]!.GetValue<Guid>();
        await LearnerPost(c, learnerToken, $"/api/workspaces/{c.Slug}/learn/lessons/{c.LessonId}/submit",
            new { answers = new[] { new { questionId = question, selectedOptionIndex = (int?)1, textAnswer = (string?)null } } });

        return WithService(sp => sp.GetRequiredService<PlatformDbContext>().Submissions
            .Where(s => s.MembershipId == learnerMembershipId && s.AssessmentId != null)
            .OrderByDescending(s => s.StartedAt).Select(s => s.Id).First());
    }

    // ── Calls ────────────────────────────────────────────────────────────────

    protected static async Task<JsonObject> LearnerPost(Course c, string learnerToken, string path, object? body = null)
    {
        var res = await Send(c.Client, learnerToken, HttpMethod.Post, path, body);
        var text = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"POST {path} (learner) → {(int)res.StatusCode}: {text}");
        return string.IsNullOrWhiteSpace(text) ? new JsonObject() : JsonNode.Parse(text)!.AsObject();
    }

    protected static Task<HttpResponseMessage> LearnerRaw(Course c, string learnerToken, HttpMethod method, string path, object? body = null)
        => Send(c.Client, learnerToken, method, path, body);

    protected T WithService<T>(Func<IServiceProvider, T> use)
    {
        using var scope = Host.Services.CreateScope();
        return use(scope.ServiceProvider);
    }

    protected async Task<T> WithServiceAsync<T>(Func<IServiceProvider, Task<T>> use)
    {
        using var scope = Host.Services.CreateScope();
        return await use(scope.ServiceProvider);
    }

    protected static string LearnerEmail(string name) => $"{name}-learner@integrationtest.local";
}
