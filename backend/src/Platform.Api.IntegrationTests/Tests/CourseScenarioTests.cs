using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Platform.Api.IntegrationTests.Fixtures;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// A published course with one Reading lesson (with a published question) and one enrolled
/// learner, plus the tutor/learner calls the Edit Mode tests make on it. Shared by test classes
/// that each get their own fixture — signups are rate limited per fixture.
/// </summary>
public abstract class CourseScenarioTests
{
    protected abstract PlatformApiTestFixture Fixture { get; }

    // ── Seeding: a published course, one Reading lesson with a published question, one enrolled learner ──

    protected sealed record Course(string Slug, string TutorToken, string LearnerToken, Guid ProductId, Guid LessonId, string CurriculumPath, HttpClient Client);
    protected sealed record LearnerCurriculum(List<JsonNode> Units, List<Guid> LessonIds);
    protected sealed record LearnerLesson(string? Body, JsonArray Questions);

    protected async Task<Course> SeedCourseAsync(string name)
    {
        var client = Fixture.CreateClient();
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, $"{name}-tutor@integrationtest.local", $"{name}-academy");
        var c = new Course(tutor.WorkspaceSlug, tutor.Token, "", Guid.Empty, Guid.Empty, "", client);

        var product = await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/products", new
        {
            title = "Algebra Basics", description = "Equations made easy.", category = "Math", tags = Array.Empty<string>(),
            pacing = (string?)null, enrollmentMode = (string?)null, defaultLanguage = "en",
        });
        var productId = product["id"]!.GetValue<Guid>();
        c = c with { ProductId = productId, CurriculumPath = $"/api/workspaces/{c.Slug}/products/{productId}/curriculum" };

        var lesson = await AddUnitWithLessonAsync(c, "Unit one", "Lesson one", "Version one.");
        c = c with { LessonId = lesson.LessonId };

        await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/lessons/{c.LessonId}/assessment/questions", new
        {
            type = "MultipleChoice", prompt = "x + 3 = 5. What is x?", options = new[] { "1", "2", "3" }, correctOptionIndex = 1,
            acceptedAnswers = (string[]?)null, explanation = (string?)null, videoTimestampSeconds = (int?)null, points = 1,
        });
        await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/lessons/{c.LessonId}/assessment/publish");
        await Tutor(c, HttpMethod.Post, $"{c.CurriculumPath}/publish");
        await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/products/{productId}/submit");
        await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/products/{productId}/publish");

        return c with { LearnerToken = await EnrollLearnerAsync(c, $"{name}-learner") };
    }

    /// <summary>Invites, accepts and enrolls a learner; returns their token.</summary>
    protected async Task<string> EnrollLearnerAsync(Course c, string name)
    {
        var learnerEmail = $"{name}@integrationtest.local";
        var invited = await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/invitations", new { email = learnerEmail, role = "Learner" });
        var accept = await c.Client.PostAsJsonAsync($"/api/invitations/{invited["invitationLink"]!.GetValue<string>().Split('/').Last()}/accept",
            new { fullName = "Test Learner", password = "Learner-Secure!2026" });
        accept.EnsureSuccessStatusCode();
        var learnerToken = (await accept.Content.ReadFromJsonAsync<JsonObject>())!["token"]!.GetValue<string>();
        var members = await Tutor(c, HttpMethod.Get, $"/api/workspaces/{c.Slug}/members");
        var membershipId = members["members"]!.AsArray().First(m => m!["email"]!.GetValue<string>() == learnerEmail)!["membershipId"]!.GetValue<Guid>();
        await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/members/{membershipId}/enroll", new { learningProductId = c.ProductId });
        return learnerToken;
    }

    protected sealed record AddedLesson(Guid UnitId, Guid LessonId);

    protected async Task<AddedLesson> AddUnitWithLessonAsync(Course c, string unitTitle, string lessonTitle, string body)
    {
        await Tutor(c, HttpMethod.Post, $"{c.CurriculumPath}/units", new { title = unitTitle });
        var unitId = (await Tutor(c, HttpMethod.Get, c.CurriculumPath))["units"]!.AsArray()
            .First(u => u!["title"]!.GetValue<string>() == unitTitle)!["id"]!.GetValue<Guid>();
        await Tutor(c, HttpMethod.Post, $"{c.CurriculumPath}/lessons", new { title = lessonTitle, unitId });
        var lessonId = (await Tutor(c, HttpMethod.Get, c.CurriculumPath))["units"]!.AsArray()
            .SelectMany(u => u!["lessons"]!.AsArray()).First(l => l!["title"]!.GetValue<string>() == lessonTitle)!["id"]!.GetValue<Guid>();
        await Tutor(c, HttpMethod.Put, $"/api/workspaces/{c.Slug}/lessons/{lessonId}/draft",
            new { title = lessonTitle, body, estimatedMinutes = 10, deliveryMode = "Reading" });
        // A brand-new lesson in a draft curriculum is published on its own; one added in Edit Mode
        // is published with the curriculum.
        var curriculum = await Tutor(c, HttpMethod.Get, c.CurriculumPath);
        if (!curriculum["draftOpen"]!.GetValue<bool>())
            await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/lessons/{lessonId}/publish");
        return new AddedLesson(unitId, lessonId);
    }

    // ── Calls ─────────────────────────────────────────────────────────────────

    protected static async Task<HttpResponseMessage> Send(HttpClient client, string token, HttpMethod method, string path, object? body = null)
    {
        using var req = new HttpRequestMessage(method, path);
        req.Headers.Authorization = new("Bearer", token);
        if (body is not null) req.Content = JsonContent.Create(body);
        return await client.SendAsync(req);
    }

    protected static Task<HttpResponseMessage> TutorRaw(Course c, HttpMethod method, string path, object? body = null)
        => Send(c.Client, c.TutorToken, method, path, body);

    protected static async Task<JsonObject> Tutor(Course c, HttpMethod method, string path, object? body = null)
    {
        var res = await TutorRaw(c, method, path, body);
        var text = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"{method} {path} → {(int)res.StatusCode}: {text}");
        return string.IsNullOrWhiteSpace(text) ? new JsonObject() : JsonNode.Parse(text)!.AsObject();
    }

    protected static async Task<JsonObject> Learner(Course c, string path)
    {
        var res = await Send(c.Client, c.LearnerToken, HttpMethod.Get, path);
        var text = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"GET {path} (learner) → {(int)res.StatusCode}: {text}");
        return JsonNode.Parse(text)!.AsObject();
    }

    protected static async Task<LearnerCurriculum> LearnerCurriculumAsync(Course c)
    {
        var json = await Learner(c, $"/api/workspaces/{c.Slug}/learn/products/{c.ProductId}/curriculum");
        var units = json["units"]!.AsArray().Select(u => u!).ToList();
        return new LearnerCurriculum(units, units.SelectMany(u => u["lessons"]!.AsArray()).Select(l => l!["id"]!.GetValue<Guid>()).ToList());
    }

    protected static async Task<LearnerLesson> LearnerLessonAsync(Course c, Guid lessonId)
    {
        var json = await Learner(c, $"/api/workspaces/{c.Slug}/learn/lessons/{lessonId}");
        return new LearnerLesson(json["body"]?.GetValue<string>(), json["questions"]!.AsArray());
    }

    protected static async Task<List<JsonNode>> LearnerAssignmentsAsync(Course c)
        => (await Learner(c, $"/api/workspaces/{c.Slug}/learn/assignments"))["rows"]!.AsArray().Select(r => r!).ToList();

    protected static async Task<bool> ProductHasUnpublishedChangesAsync(Course c)
    {
        var products = await Tutor(c, HttpMethod.Get, $"/api/workspaces/{c.Slug}/products");
        return products["products"]!.AsArray().First(p => p!["id"]!.GetValue<Guid>() == c.ProductId)!["curriculumHasUnpublishedChanges"]!.GetValue<bool>();
    }
}
