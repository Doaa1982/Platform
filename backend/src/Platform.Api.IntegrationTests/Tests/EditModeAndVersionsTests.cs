using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Platform.Api.IntegrationTests.Fixtures;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// What an enrolled learner sees while the tutor edits a published course: the last published
/// curriculum, lessons, questions and activities, until the tutor publishes again (Edit Mode used
/// to unpublish the whole curriculum). And an activity carried into a new lesson version keeps
/// its one assignment instead of showing as unassigned and being assigned twice.
/// </summary>
public class EditModeAndVersionsTests(PlatformApiTestFixture fixture) : IClassFixture<PlatformApiTestFixture>
{
    [Fact]
    public async Task Edit_Mode_Keeps_Learners_On_The_Published_Course_Until_It_Is_Published_Again()
    {
        var course = await SeedCourseAsync("edit-mode");

        var before = await LearnerCurriculumAsync(course);
        Assert.Single(before.Units);
        var lessonBefore = await LearnerLessonAsync(course, course.LessonId);
        Assert.Equal("Version one.", lessonBefore.Body);
        Assert.Single(lessonBefore.Questions);

        // Edit Mode: the curriculum stays Published, with a private draft open.
        var opened = await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/edit");
        Assert.Equal("Published", opened["status"]!.GetValue<string>());
        Assert.True(opened["draftOpen"]!.GetValue<bool>());
        Assert.True(await ProductHasUnpublishedChangesAsync(course));

        // Restructure: a second unit with a new lesson; and change the published lesson.
        var unit2 = await AddUnitWithLessonAsync(course, "Unit two", "Lesson two", "Brand new lesson.");
        Assert.Equal(HttpStatusCode.Conflict, (await TutorRaw(course, HttpMethod.Put, $"/api/workspaces/{course.Slug}/lessons/{course.LessonId}/current/quick-edit",
            new { title = "Lesson one", body = "Edited live.", estimatedMinutes = 10 })).StatusCode);   // never straight onto the live lesson
        await Tutor(course, HttpMethod.Post, $"/api/workspaces/{course.Slug}/lessons/{course.LessonId}/revisions");
        await Tutor(course, HttpMethod.Put, $"/api/workspaces/{course.Slug}/lessons/{course.LessonId}/draft",
            new { title = "Lesson one", body = "Version two.", estimatedMinutes = 10, deliveryMode = "Reading" });

        // The learner sees exactly what was published before.
        var during = await LearnerCurriculumAsync(course);
        Assert.Single(during.Units);
        Assert.Equal([course.LessonId], during.LessonIds);
        var lessonDuring = await LearnerLessonAsync(course, course.LessonId);
        Assert.Equal("Version one.", lessonDuring.Body);
        Assert.Single(lessonDuring.Questions);

        // Publish again: the learner gets the new structure and content, and keeps the questions.
        var published = await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/publish");
        Assert.False(published["draftOpen"]!.GetValue<bool>());
        Assert.False(await ProductHasUnpublishedChangesAsync(course));

        var after = await LearnerCurriculumAsync(course);
        Assert.Equal(2, after.Units.Count);
        Assert.Contains(unit2.LessonId, after.LessonIds);
        // A learner who had already started lesson one keeps the version they started (§20); one
        // who opens it now gets the new version — with its questions, republished with it.
        Assert.Equal("Version one.", (await LearnerLessonAsync(course, course.LessonId)).Body);
        var newcomer = course with { LearnerToken = await EnrollLearnerAsync(course, "edit-mode-newcomer") };
        var lessonAfter = await LearnerLessonAsync(newcomer, course.LessonId);
        Assert.Equal("Version two.", lessonAfter.Body);
        Assert.Single(lessonAfter.Questions);
    }

    [Fact]
    public async Task A_New_Lesson_Version_Keeps_The_Activity_Assignment_And_Changes_Nothing_For_Learners_Until_Published()
    {
        var course = await SeedCourseAsync("versions");
        var lessonPath = $"/api/workspaces/{course.Slug}/lessons/{course.LessonId}";

        // Revision 2 with an activity, assigned with a due date.
        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/edit");
        await Tutor(course, HttpMethod.Post, $"{lessonPath}/revisions");
        await Tutor(course, HttpMethod.Post, $"{lessonPath}/activities", new { type = "Homework", title = "Practice: one-step equations", instructions = "Solve all five." });
        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/publish");
        var activityV2 = (await Tutor(course, HttpMethod.Get, lessonPath))["currentRevision"]!["learningActivities"]![0]!["id"]!.GetValue<Guid>();

        var assignmentPath = $"{lessonPath}/activities/{activityV2}/assignment";
        var created = await Tutor(course, HttpMethod.Post, assignmentPath);
        var assignmentId = created["id"]!.GetValue<Guid>();
        var dueAt = DateTime.UtcNow.AddDays(7);
        await Tutor(course, HttpMethod.Put, assignmentPath, new
        {
            availabilityMode = "Immediate", dueDateMode = "Fixed", dueAt, attemptMode = "Single", evaluationMethod = "Manual",
        });
        await Tutor(course, HttpMethod.Post, $"{assignmentPath}/publish");
        Assert.Single(await LearnerAssignmentsAsync(course));

        // Revision 3: another activity forces a new version. The copy of the assigned activity is
        // the same activity: same assignment, can't be assigned twice.
        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/edit");
        await Tutor(course, HttpMethod.Post, $"{lessonPath}/revisions");
        await Tutor(course, HttpMethod.Post, $"{lessonPath}/activities", new { type = "Reading", title = "Read: balancing both sides", instructions = (string?)null });
        var draftActivities = (await Tutor(course, HttpMethod.Get, lessonPath))["draftRevision"]!["learningActivities"]!.AsArray();
        var copy = draftActivities.First(a => a!["title"]!.GetValue<string>() == "Practice: one-step equations")!;
        var activityV3 = copy["id"]!.GetValue<Guid>();
        Assert.NotEqual(activityV2, activityV3);
        Assert.True(copy["hasAssignment"]!.GetValue<bool>());
        Assert.Equal(assignmentId, copy["assignmentId"]!.GetValue<Guid>());

        var copyPath = $"{lessonPath}/activities/{activityV3}/assignment";
        var seenFromDraft = await Tutor(course, HttpMethod.Get, copyPath);
        Assert.Equal(assignmentId, seenFromDraft["id"]!.GetValue<Guid>());
        Assert.Equal(HttpStatusCode.Conflict, (await TutorRaw(course, HttpMethod.Post, copyPath)).StatusCode);

        // Nothing changes for the learner while the version is a draft.
        var whileDraft = await LearnerAssignmentsAsync(course);
        Assert.Single(whileDraft);
        Assert.Equal(activityV2, whileDraft[0]["learningActivityId"]!.GetValue<Guid>());

        // Published: one assignment, now on the new copy, with its settings intact.
        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/publish");
        var afterPublish = await LearnerAssignmentsAsync(course);
        Assert.Single(afterPublish);
        Assert.Equal(assignmentId, afterPublish[0]["assignmentId"]!.GetValue<Guid>());
        Assert.Equal(activityV3, afterPublish[0]["learningActivityId"]!.GetValue<Guid>());
        var moved = await Tutor(course, HttpMethod.Get, copyPath);
        Assert.Equal(assignmentId, moved["id"]!.GetValue<Guid>());
        Assert.Equal("Fixed", moved["dueDateMode"]!.GetValue<string>());
    }

    // ── Seeding: a published course, one Reading lesson with a published question, one enrolled learner ──

    private sealed record Course(string Slug, string TutorToken, string LearnerToken, Guid ProductId, Guid LessonId, string CurriculumPath, HttpClient Client);
    private sealed record LearnerCurriculum(List<JsonNode> Units, List<Guid> LessonIds);
    private sealed record LearnerLesson(string? Body, JsonArray Questions);

    private async Task<Course> SeedCourseAsync(string name)
    {
        var client = fixture.CreateClient();
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
    private async Task<string> EnrollLearnerAsync(Course c, string name)
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

    private sealed record AddedLesson(Guid UnitId, Guid LessonId);

    private async Task<AddedLesson> AddUnitWithLessonAsync(Course c, string unitTitle, string lessonTitle, string body)
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

    private static async Task<HttpResponseMessage> Send(HttpClient client, string token, HttpMethod method, string path, object? body = null)
    {
        using var req = new HttpRequestMessage(method, path);
        req.Headers.Authorization = new("Bearer", token);
        if (body is not null) req.Content = JsonContent.Create(body);
        return await client.SendAsync(req);
    }

    private static Task<HttpResponseMessage> TutorRaw(Course c, HttpMethod method, string path, object? body = null)
        => Send(c.Client, c.TutorToken, method, path, body);

    private static async Task<JsonObject> Tutor(Course c, HttpMethod method, string path, object? body = null)
    {
        var res = await TutorRaw(c, method, path, body);
        var text = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"{method} {path} → {(int)res.StatusCode}: {text}");
        return string.IsNullOrWhiteSpace(text) ? new JsonObject() : JsonNode.Parse(text)!.AsObject();
    }

    private static async Task<JsonObject> Learner(Course c, string path)
    {
        var res = await Send(c.Client, c.LearnerToken, HttpMethod.Get, path);
        var text = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"GET {path} (learner) → {(int)res.StatusCode}: {text}");
        return JsonNode.Parse(text)!.AsObject();
    }

    private static async Task<LearnerCurriculum> LearnerCurriculumAsync(Course c)
    {
        var json = await Learner(c, $"/api/workspaces/{c.Slug}/learn/products/{c.ProductId}/curriculum");
        var units = json["units"]!.AsArray().Select(u => u!).ToList();
        return new LearnerCurriculum(units, units.SelectMany(u => u["lessons"]!.AsArray()).Select(l => l!["id"]!.GetValue<Guid>()).ToList());
    }

    private static async Task<LearnerLesson> LearnerLessonAsync(Course c, Guid lessonId)
    {
        var json = await Learner(c, $"/api/workspaces/{c.Slug}/learn/lessons/{lessonId}");
        return new LearnerLesson(json["body"]?.GetValue<string>(), json["questions"]!.AsArray());
    }

    private static async Task<List<JsonNode>> LearnerAssignmentsAsync(Course c)
        => (await Learner(c, $"/api/workspaces/{c.Slug}/learn/assignments"))["rows"]!.AsArray().Select(r => r!).ToList();

    private static async Task<bool> ProductHasUnpublishedChangesAsync(Course c)
    {
        var products = await Tutor(c, HttpMethod.Get, $"/api/workspaces/{c.Slug}/products");
        return products["products"]!.AsArray().First(p => p!["id"]!.GetValue<Guid>() == c.ProductId)!["curriculumHasUnpublishedChanges"]!.GetValue<bool>();
    }
}
