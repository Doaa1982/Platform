using System.Net;
using System.Text.Json.Nodes;
using Platform.Api.IntegrationTests.Fixtures;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// PR #16 follow-ups. "Publish changes": a lesson that was never live and isn't ready is skipped
/// (kept hidden) rather than blocking every other change; a live lesson that isn't ready still
/// blocks, by name; and a lesson's own Publish can't go around Edit Mode. Assignments: "Remove
/// from learners" archives an open assignment in one step and keeps its submissions, and the
/// learner's list says Closed (not Overdue) and shows the teacher's result.
/// </summary>
public class PublishSkipAndAssignmentArchiveTests(PlatformApiTestFixture fixture) : CourseScenarioTests, IClassFixture<PlatformApiTestFixture>
{
    protected override PlatformApiTestFixture Fixture => fixture;

    [Fact]
    public async Task Publish_Skips_A_Never_Live_Unready_Lesson_But_Is_Blocked_By_A_Live_One()
    {
        var course = await SeedCourseAsync("publish-skip");
        var lessonPath = $"/api/workspaces/{course.Slug}/lessons/{course.LessonId}";
        var unitId = (await Tutor(course, HttpMethod.Get, course.CurriculumPath))["units"]![0]!["id"]!.GetValue<Guid>();

        // Edit Mode: an empty new lesson, and a text change on the live lesson.
        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/edit");
        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/lessons", new { title = "Empty new lesson", unitId });
        await Tutor(course, HttpMethod.Post, $"{lessonPath}/revisions");
        await Tutor(course, HttpMethod.Put, $"{lessonPath}/draft", new { title = "Lesson one", body = "Version two.", estimatedMinutes = 10, deliveryMode = "Reading" });

        // The curriculum says so before Publish is clicked.
        var lessons = (await Tutor(course, HttpMethod.Get, course.CurriculumPath))["units"]![0]!["lessons"]!.AsArray();
        var empty = lessons.First(l => l!["title"]!.GetValue<string>() == "Empty new lesson")!;
        Assert.Equal("NeedsContent", empty["publishBlocker"]!.GetValue<string>());
        Assert.Null(lessons.First(l => l!["id"]!.GetValue<Guid>() == course.LessonId)!["publishBlocker"]);

        // Publish goes through: the text change is live, the empty lesson stays a hidden draft.
        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/publish");
        var newcomer = course with { LearnerToken = await EnrollLearnerAsync(course, "publish-skip-newcomer") };
        Assert.Equal("Version two.", (await LearnerLessonAsync(newcomer, course.LessonId)).Body);
        Assert.Equal([course.LessonId], (await LearnerCurriculumAsync(newcomer)).LessonIds);
        var afterLessons = (await Tutor(course, HttpMethod.Get, course.CurriculumPath))["units"]![0]!["lessons"]!.AsArray();
        Assert.Equal("Draft", afterLessons.First(l => l!["title"]!.GetValue<string>() == "Empty new lesson")!["status"]!.GetValue<string>());

        // A live lesson whose new draft isn't ready blocks the publish, by name; nothing changes.
        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/edit");
        await Tutor(course, HttpMethod.Post, $"{lessonPath}/revisions");
        await Tutor(course, HttpMethod.Put, $"{lessonPath}/draft", new { title = "Lesson one", body = (string?)null, estimatedMinutes = 10, deliveryMode = "Reading" });
        var refused = await TutorRaw(course, HttpMethod.Post, $"{course.CurriculumPath}/publish");
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        var message = JsonNode.Parse(await refused.Content.ReadAsStringAsync())!["message"]!.GetValue<string>();
        Assert.Contains("Lesson one", message);
        Assert.DoesNotContain("Empty new lesson", message);
        Assert.True((await Tutor(course, HttpMethod.Get, course.CurriculumPath))["draftOpen"]!.GetValue<bool>());
        var other = course with { LearnerToken = await EnrollLearnerAsync(course, "publish-skip-other") };
        Assert.Equal("Version two.", (await LearnerLessonAsync(other, course.LessonId)).Body);

        // And the lesson's own Publish can't make it live behind Edit Mode's back.
        await Tutor(course, HttpMethod.Put, $"{lessonPath}/draft", new { title = "Lesson one", body = "Version three.", estimatedMinutes = 10, deliveryMode = "Reading" });
        Assert.Equal(HttpStatusCode.Conflict, (await TutorRaw(course, HttpMethod.Post, $"{lessonPath}/publish")).StatusCode);
        Assert.Equal("Version two.", (await LearnerLessonAsync(other, course.LessonId)).Body);
    }

    [Fact]
    public async Task Remove_From_Learners_Archives_An_Open_Assignment_And_Keeps_Its_Submissions()
    {
        var course = await SeedCourseAsync("assign-archive");
        var lessonPath = $"/api/workspaces/{course.Slug}/lessons/{course.LessonId}";

        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/edit");
        await Tutor(course, HttpMethod.Post, $"{lessonPath}/revisions");
        await Tutor(course, HttpMethod.Post, $"{lessonPath}/activities", new { type = "Homework", title = "Practice", instructions = "Solve all five." });
        await Tutor(course, HttpMethod.Post, $"{lessonPath}/activities", new { type = "Homework", title = "Extra practice", instructions = "Two more." });
        await Tutor(course, HttpMethod.Post, $"{course.CurriculumPath}/publish");
        var activities = (await Tutor(course, HttpMethod.Get, lessonPath))["currentRevision"]!["learningActivities"]!.AsArray();
        Guid ActivityId(string title) => activities.First(a => a!["title"]!.GetValue<string>() == title)!["id"]!.GetValue<Guid>();

        async Task<string> AssignAsync(Guid activityId)
        {
            var path = $"{lessonPath}/activities/{activityId}/assignment";
            await Tutor(course, HttpMethod.Post, path);
            await Tutor(course, HttpMethod.Put, path, new
            {
                availabilityMode = "Immediate", dueDateMode = "Fixed", dueAt = DateTime.UtcNow.AddDays(7), attemptMode = "Single", evaluationMethod = "Manual",
            });
            await Tutor(course, HttpMethod.Post, $"{path}/publish");
            return path;
        }
        var practice = ActivityId("Practice");
        var practicePath = await AssignAsync(practice);
        var extraPath = await AssignAsync(ActivityId("Extra practice"));

        // The learner submits "Practice"; the teacher passes it with feedback.
        var learnerPath = $"/api/workspaces/{course.Slug}/learn/lessons/{course.LessonId}/activities/{practice}/assignment";
        var started = await LearnerPost(course, $"{learnerPath}/start");
        await LearnerPost(course, $"{learnerPath}/submissions/{started["id"]!.GetValue<Guid>()}/respond", new { text = "x = 2", attachedLearningAssetId = (Guid?)null });
        var submissionId = (await Tutor(course, HttpMethod.Get, $"/api/workspaces/{course.Slug}/assignments/lessons/{course.LessonId}/activities/{practice}/submissions"))
            ["rows"]![0]!["submissionId"]!.GetValue<Guid>();
        await Tutor(course, HttpMethod.Post, $"/api/workspaces/{course.Slug}/assignments/lessons/{course.LessonId}/activities/{practice}/submissions/{submissionId}/evaluate",
            new { passed = true, feedback = "Well done." });

        // "Extra practice" closes without a submission: the learner sees Closed, not Overdue.
        await Tutor(course, HttpMethod.Post, $"{extraPath}/close");
        var rows = await LearnerAssignmentsAsync(course);
        var completed = rows.First(r => r["activityTitle"]!.GetValue<string>() == "Practice");
        Assert.Equal("Completed", completed["learnerStatus"]!.GetValue<string>());
        Assert.True(completed["passed"]!.GetValue<bool>());
        Assert.True(completed["hasFeedback"]!.GetValue<bool>());
        Assert.Equal("Closed", rows.First(r => r["activityTitle"]!.GetValue<string>() == "Extra practice")["learnerStatus"]!.GetValue<string>());

        // Remove "Practice" from learners while it is still open: closed and archived in one step.
        var archived = await Tutor(course, HttpMethod.Post, $"{practicePath}/archive");
        Assert.Equal("Archived", archived["status"]!.GetValue<string>());
        Assert.DoesNotContain(await LearnerAssignmentsAsync(course), r => r["activityTitle"]!.GetValue<string>() == "Practice");
        var overview = (await Tutor(course, HttpMethod.Get, $"/api/workspaces/{course.Slug}/assignments"))["rows"]!.AsArray();
        Assert.Equal("Archived", overview.First(r => r!["activityTitle"]!.GetValue<string>() == "Practice")!["status"]!.GetValue<string>());
        var kept = await Tutor(course, HttpMethod.Get, $"/api/workspaces/{course.Slug}/assignments/lessons/{course.LessonId}/activities/{practice}/submissions");
        Assert.Equal("Evaluated", kept["rows"]![0]!["status"]!.GetValue<string>());

        // A closed one (the old duplicate case) archives too.
        Assert.Equal("Archived", (await Tutor(course, HttpMethod.Post, $"{extraPath}/archive"))["status"]!.GetValue<string>());
    }

    private static async Task<JsonObject> LearnerPost(Course c, string path, object? body = null)
    {
        var res = await Send(c.Client, c.LearnerToken, HttpMethod.Post, path, body);
        var text = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"POST {path} (learner) → {(int)res.StatusCode}: {text}");
        return JsonNode.Parse(text)!.AsObject();
    }
}
