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
public class EditModeAndVersionsTests(PlatformApiTestFixture fixture) : CourseScenarioTests, IClassFixture<PlatformApiTestFixture>
{
    protected override PlatformApiTestFixture Fixture => fixture;

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
}
