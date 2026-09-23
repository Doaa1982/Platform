using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.Services;
using Platform.Domain;
using Platform.Infrastructure;

namespace Platform.Api.IntegrationTests.Fixtures;

/// <summary>
/// A small, deterministic learning workspace built once per test class: one
/// real onboarded tutor and workspace (the supported V1 chain), then every
/// learner, enrollment, lesson, revision, resource, activity, assignment,
/// submission and asset the authorization tests need, seeded through the domain
/// model so each state is exactly what the test names — nothing left to timing.
///
/// Content layout (all in workspace A; workspace B is a second, separately
/// onboarded tutor used only for cross-workspace checks):
///
///   Product "Course" (Published, Open, sequential unlock ON)
///     Lesson 1  Published. rev1 (pinned by the Enrolled learner) has Video1, a visible resource,
///               a tutor-only resource, an archived resource, an activity with a file and a
///               published assignment. rev2 (current) has Video1b.
///     Lesson 2  Published, placed after Lesson 1, so it is LOCKED until Lesson 1 is completed.
///     Lesson 3  Draft (unpublished) with its own video.
///   Product "Draft course" (Draft) with a cover image.
/// </summary>
public sealed class AssetAccessWorld
{
    public const string LearnerPassword = "LearnerPass!2026";

    public required string Slug { get; init; }
    public required string OtherSlug { get; init; }

    public required Guid WorkspaceId { get; init; }
    public required string TutorToken { get; init; }
    public required string OtherTutorToken { get; init; }
    public required Guid TutorIdentityId { get; init; }
    public required Guid OtherTutorIdentityId { get; init; }

    public required Guid TeacherIdentityId { get; init; }
    public required Guid ParentIdentityId { get; init; }
    public required Guid EnrolledIdentityId { get; init; }
    public required string EnrolledEmail { get; init; }
    public required Guid UnenrolledIdentityId { get; init; }
    public required string UnenrolledEmail { get; init; }
    public required Guid OtherEnrolledIdentityId { get; init; }
    public required Guid RevokableIdentityId { get; init; }
    public required Guid RevokableEnrollmentId { get; init; }
    public required Guid SuspendableIdentityId { get; init; }
    public required Guid Lesson1Id { get; init; }
    public required Guid ProductId { get; init; }
    public required Guid ActivityId { get; init; }            // Lesson 1's activity (published assignment)
    public required Guid DraftLessonId { get; init; }
    public required Guid DraftLessonActivityId { get; init; } // an activity on the UNPUBLISHED Lesson 3, with a published assignment
    public required Guid DraftLessonActivityFile { get; init; }
    public required Guid UnlockableIdentityId { get; init; }  // enrolled, no progress: Lesson 2 is locked for them

    public required Guid Video1 { get; init; }        // real bytes, on rev1 (pinned) of published Lesson 1
    public required Guid Video1b { get; init; }       // on rev2 (current) of Lesson 1
    public required Guid Video2 { get; init; }        // Lesson 2 (locked)
    public required Guid Video3 { get; init; }        // Lesson 3 (draft)
    public required Guid VisibleResource { get; init; }
    public required Guid TutorOnlyResource { get; init; }
    public required Guid ArchivedResource { get; init; }
    public required Guid ActivityFile { get; init; }
    public required Guid EnrolledSubmissionFile { get; init; }
    public required Guid UnreferencedByEnrolled { get; init; }
    public required Guid UnreferencedByTutor { get; init; }
    public required Guid CoverOfPublished { get; init; }
    public required Guid CoverOfDraft { get; init; }
    public required Guid Logo { get; init; }
    public required Guid VisibleImageResource { get; init; }   // learner-visible lesson resource that is a JPEG (cacheable)
    public required Guid TutorOnlyImageResource { get; init; } // hidden lesson resource that is a PNG (never cacheable)
    public required Guid ActivityImageFile { get; init; }      // an activity file that is a PNG (never cacheable)
    public required Guid SubmissionImage { get; init; }        // a learner's submission file that is a PNG (never cacheable)
    public required Guid VisibleAndActivityImage { get; init; } // a learner-visible lesson image that is ALSO an activity file
    public required Guid VisibleAndHiddenImage { get; init; }   // a learner-visible lesson image that is ALSO a tutor-only resource elsewhere
    public required Guid CoverAndSubmissionImage { get; init; } // an Image-category cover that is ALSO a learner's submission file
    public required byte[] ImageBytes { get; init; }

    public required byte[] Video1Bytes { get; init; }
    public required byte[] Video1bBytes { get; init; }
    public required byte[] ResourceBytes { get; init; }
    public required byte[] CoverBytes { get; init; }
    public required string RevokableEmail { get; init; }

    public static async Task<AssetAccessWorld> BuildAsync(
        WebApplicationFactory<Program> host, HttpClient client, string unique)
    {
        var adminToken = await TestOnboarding.LoginAsync(client, PlatformApiTestFixture.AdminEmail, PlatformApiTestFixture.AdminPassword);
        var tutor = await TestOnboarding.OnboardTutorAsync(client, adminToken, $"{unique}-tutor@integrationtest.local", unique);
        var other = await TestOnboarding.OnboardTutorAsync(client, adminToken, $"{unique}-other@integrationtest.local", $"{unique}-b");

        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<ILearningAssetStorage>();

        var workspace = await db.Workspaces.SingleAsync(w => w.Slug == unique);
        var otherWorkspace = await db.Workspaces.SingleAsync(w => w.Slug == $"{unique}-b");
        var tutorMembership = await db.Memberships.Include(m => m.Roles)
            .SingleAsync(m => m.WorkspaceId == workspace.Id && m.Roles.Any(r => r.Name == WorkspaceRoleName.Owner));
        var otherTutorMembership = await db.Memberships.Include(m => m.Roles)
            .SingleAsync(m => m.WorkspaceId == otherWorkspace.Id && m.Roles.Any(r => r.Name == WorkspaceRoleName.Owner));

        Membership NewMember(string label, params WorkspaceRoleName[] roles)
        {
            var identity = Identity.Create($"{unique}-{label}@integrationtest.local",
                BCrypt.Net.BCrypt.HashPassword(LearnerPassword), $"Test {label}");
            db.Identities.Add(identity);
            var membership = Membership.Create(identity.Id, workspace.Id, roles);
            membership.Activate();
            db.Memberships.Add(membership);
            return membership;
        }

        var teacher = NewMember("teacher", WorkspaceRoleName.Teacher);
        var parent = NewMember("parent", WorkspaceRoleName.Parent);
        var enrolled = NewMember("enrolled", WorkspaceRoleName.Learner);
        var unenrolled = NewMember("unenrolled", WorkspaceRoleName.Learner);
        var otherEnrolled = NewMember("peer", WorkspaceRoleName.Learner);
        var revokable = NewMember("revokable", WorkspaceRoleName.Learner);
        var suspendable = NewMember("suspendable", WorkspaceRoleName.Learner);
        var unlockable = NewMember("unlockable", WorkspaceRoleName.Learner);

        LearningAsset NewAsset(LearningAssetCategory category, Guid uploaderMembershipId, string contentType, string name,
            string? objectKey = null, long size = 1000)
        {
            var asset = LearningAsset.Upload(workspace.Id, uploaderMembershipId, category, name, name, contentType, size,
                storageProvider: storage.ProviderName, objectKey: objectKey ?? $"{workspace.Id:N}/{Guid.NewGuid():N}.bin");
            db.LearningAssets.Add(asset);
            return asset;
        }

        async Task<(string Key, byte[] Bytes)> StoreAsync(string name, int length, int seed)
        {
            var bytes = Enumerable.Range(0, length).Select(i => (byte)((i * seed + 3) % 251)).ToArray();
            await using var input = new MemoryStream(bytes);
            return (await storage.SaveAsync(workspace.Id, name, input, default), bytes);
        }

        // Real bytes for the assets the HTTP tests read back; every other asset is a row only.
        var video1Bytes = Enumerable.Range(0, 20_000).Select(i => (byte)((i * 13 + 5) % 251)).ToArray();
        string video1Key;
        await using (var input = new MemoryStream(video1Bytes))
            video1Key = await storage.SaveAsync(workspace.Id, "video1.mp4", input, default);

        var video1 = NewAsset(LearningAssetCategory.Video, tutorMembership.Id, "video/mp4", "video1.mp4", video1Key, video1Bytes.Length);
        var (video1bKey, video1bBytes) = await StoreAsync("video1b.mp4", 9_000, 17);
        var video1b = NewAsset(LearningAssetCategory.Video, tutorMembership.Id, "video/mp4", "video1b.mp4", video1bKey, video1bBytes.Length);
        var video2 = NewAsset(LearningAssetCategory.Video, tutorMembership.Id, "video/mp4", "video2.mp4");
        var video3 = NewAsset(LearningAssetCategory.Video, tutorMembership.Id, "video/mp4", "video3.mp4");
        var (resourceKey, resourceBytes) = await StoreAsync("handout.pdf", 4_000, 7);
        var visibleResource = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "application/pdf", "handout.pdf", resourceKey, resourceBytes.Length);
        var tutorOnly = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "application/pdf", "tutor-notes.pdf");
        var archivedResource = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "application/pdf", "old-handout.pdf");
        var activityFile = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "application/pdf", "worksheet.pdf");
        var submissionFile = NewAsset(LearningAssetCategory.Resource, enrolled.Id, "application/pdf", "my-answer.pdf");
        var unreferencedByEnrolled = NewAsset(LearningAssetCategory.Resource, enrolled.Id, "application/pdf", "just-uploaded.pdf");
        var unreferencedByTutor = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "application/pdf", "unused.pdf");
        var (coverKey, coverBytes) = await StoreAsync("cover.png", 2_500, 11);
        var coverPublished = NewAsset(LearningAssetCategory.Image, tutorMembership.Id, "image/png", "cover.png", coverKey, coverBytes.Length);
        var coverDraft = NewAsset(LearningAssetCategory.Image, tutorMembership.Id, "image/png", "draft-cover.png");
        var draftActivityFile = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "application/pdf", "draft-worksheet.pdf");
        var (logoKey, logoBytes) = await StoreAsync("logo.png", 1_500, 19);
        var logo = NewAsset(LearningAssetCategory.Image, tutorMembership.Id, "image/png", "logo.png", logoKey, logoBytes.Length);
        var (imageKey, imageBytes) = await StoreAsync("photo.bin", 3_000, 23);
        var visibleImage = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "image/jpeg", "diagram.jpg", imageKey, imageBytes.Length);
        var tutorOnlyImage = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "image/png", "answer-key.png", imageKey, imageBytes.Length);
        var activityImage = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "image/png", "worksheet.png", imageKey, imageBytes.Length);
        var visibleAndActivity = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "image/png", "both-a.png", imageKey, imageBytes.Length);
        var visibleAndHidden = NewAsset(LearningAssetCategory.Resource, tutorMembership.Id, "image/png", "both-b.png", imageKey, imageBytes.Length);
        var coverAndSubmission = NewAsset(LearningAssetCategory.Image, tutorMembership.Id, "image/png", "both-c.png", imageKey, imageBytes.Length);
        var submissionImage = NewAsset(LearningAssetCategory.Resource, otherEnrolled.Id, "image/png", "my-photo.png", imageKey, imageBytes.Length);
        archivedResource.Archive();

        workspace = await db.Workspaces.SingleAsync(w => w.Id == workspace.Id); // tracked copy for branding
        workspace.UpdateBranding(logo.Id, null, null);

        // Product + lessons ---------------------------------------------------
        var product = LearningProduct.Create(workspace.Id, tutorMembership.Id, "Course", enrollmentMode: EnrollmentMode.Open);
        var draftProduct = LearningProduct.Create(workspace.Id, tutorMembership.Id, "Draft course", enrollmentMode: EnrollmentMode.Open);
        product.SetCoverImage(coverPublished.Id);
        draftProduct.SetCoverImage(coverDraft.Id);
        var coverProduct = LearningProduct.Create(workspace.Id, tutorMembership.Id, "Course with a doubled-up image", enrollmentMode: EnrollmentMode.Open);
        coverProduct.SetCoverImage(coverAndSubmission.Id);

        var lesson1 = Lesson.Create(workspace.Id, product.Id, "Lesson 1", tutorMembership.Id);
        var lesson2 = Lesson.Create(workspace.Id, product.Id, "Lesson 2", tutorMembership.Id);
        var lesson3 = Lesson.Create(workspace.Id, product.Id, "Lesson 3 (draft)", tutorMembership.Id);

        var rev1 = lesson1.DraftRevision!;
        rev1.Edit("Lesson 1", "Body one", 5, LessonDeliveryMode.Recorded);
        rev1.AttachVideo(video1.Id);
        rev1.AddResource(visibleResource.Id, visibleToLearners: true);
        rev1.AddResource(tutorOnly.Id, visibleToLearners: false);
        rev1.AddResource(archivedResource.Id, visibleToLearners: true);
        var activity = rev1.AddLearningActivity(LearningActivityType.Homework, "Worksheet", "Do it", activityFileAssetId: activityFile.Id);
        rev1.AddResource(visibleImage.Id, visibleToLearners: true);
        rev1.AddResource(tutorOnlyImage.Id, visibleToLearners: false);
        var imageActivity = rev1.AddLearningActivity(LearningActivityType.Homework, "Photo worksheet", "Look at it", activityFileAssetId: activityImage.Id);
        rev1.AddResource(visibleAndActivity.Id, visibleToLearners: true);
        rev1.AddResource(visibleAndHidden.Id, visibleToLearners: true);
        var bothActivity = rev1.AddLearningActivity(LearningActivityType.Homework, "Both roles", "x", activityFileAssetId: visibleAndActivity.Id);
        lesson1.PublishDraft();

        var rev2 = lesson1.StartRevision(tutorMembership.Id);
        rev2.Edit("Lesson 1", "Body one, revised", 5, LessonDeliveryMode.Recorded);
        rev2.RemoveVideo();
        rev2.AttachVideo(video1b.Id);
        rev2.AddResource(visibleAndHidden.Id, visibleToLearners: false);
        lesson1.PublishDraft();

        lesson2.DraftRevision!.Edit("Lesson 2", "Body two", 5, LessonDeliveryMode.Recorded);
        lesson2.DraftRevision!.AttachVideo(video2.Id);
        lesson2.PublishDraft();

        lesson3.DraftRevision!.Edit("Lesson 3", "Body three", 5, LessonDeliveryMode.Recorded);
        lesson3.DraftRevision!.AttachVideo(video3.Id);
        var draftActivity = lesson3.DraftRevision!.AddLearningActivity(
            LearningActivityType.Homework, "Draft worksheet", "not live yet", activityFileAssetId: draftActivityFile.Id);

        var curriculum = Curriculum.Create(workspace.Id, product.Id, "Course curriculum");
        var unit = curriculum.AddUnit("Unit 1");
        curriculum.AddLessonToUnit(unit.Id, lesson1.Id);
        curriculum.AddLessonToUnit(unit.Id, lesson2.Id);
        curriculum.SetSequentialUnlock(true);
        curriculum.Publish();
        product.Publish(hasPublishedCurriculum: true);

        // Enrollments, the Enrolled learner pinned to rev1, an assignment and a submission ----
        var enrolledEnrollment = Enrollment.Create(workspace.Id, product.Id, enrolled.Id);
        var otherEnrollment = Enrollment.Create(workspace.Id, product.Id, otherEnrolled.Id);
        var revokableEnrollment = Enrollment.Create(workspace.Id, product.Id, revokable.Id);
        var suspendableEnrollment = Enrollment.Create(workspace.Id, product.Id, suspendable.Id);
        var unlockableEnrollment = Enrollment.Create(workspace.Id, product.Id, unlockable.Id);
        db.Enrollments.AddRange(enrolledEnrollment, otherEnrollment, revokableEnrollment, suspendableEnrollment, unlockableEnrollment);

        db.LessonProgresses.Add(LessonProgress.Start(enrolledEnrollment.Id, lesson1.Id, rev1.Id));

        var assignment = Assignment.Create(workspace.Id, activity.Id, product.Id, tutorMembership.Id);
        assignment.Configure(AssignmentAvailabilityMode.Immediate, null, AssignmentDueDateMode.None, null, null, null,
            AssignmentAttemptMode.Single, null, AssignmentEvaluationMethod.Manual, false, false);
        assignment.Publish(DateTime.UtcNow);
        db.Assignments.Add(assignment);

        // An assignment that is published although its lesson is not: what the assignment view would let a learner see.
        var draftAssignment = Assignment.Create(workspace.Id, draftActivity.Id, product.Id, tutorMembership.Id);
        draftAssignment.Configure(AssignmentAvailabilityMode.Immediate, null, AssignmentDueDateMode.None, null, null, null,
            AssignmentAttemptMode.Single, null, AssignmentEvaluationMethod.Manual, false, false);
        draftAssignment.Publish(DateTime.UtcNow);
        db.Assignments.Add(draftAssignment);

        var imageAssignment = Assignment.Create(workspace.Id, imageActivity.Id, product.Id, tutorMembership.Id);
        imageAssignment.Configure(AssignmentAvailabilityMode.Immediate, null, AssignmentDueDateMode.None, null, null, null,
            AssignmentAttemptMode.Single, null, AssignmentEvaluationMethod.Manual, false, false);
        imageAssignment.Publish(DateTime.UtcNow);
        db.Assignments.Add(imageAssignment);

        // The other learner's submission, whose file is an image.
        var imageSubmission = Submission.StartForAssignment(assignment.Id, otherEnrolled.Id, otherEnrollment.Id, 1);
        imageSubmission.RecordResponse(null, submissionImage.Id);
        db.Submissions.Add(imageSubmission);

        var bothAssignment = Assignment.Create(workspace.Id, bothActivity.Id, product.Id, tutorMembership.Id);
        bothAssignment.Configure(AssignmentAvailabilityMode.Immediate, null, AssignmentDueDateMode.None, null, null, null,
            AssignmentAttemptMode.Single, null, AssignmentEvaluationMethod.Manual, false, false);
        bothAssignment.Publish(DateTime.UtcNow);
        db.Assignments.Add(bothAssignment);

        // A second submission by the other learner, on the image assignment, whose file is an Image-category cover.
        var coverSubmission = Submission.StartForAssignment(imageAssignment.Id, otherEnrolled.Id, otherEnrollment.Id, 1);
        coverSubmission.RecordResponse(null, coverAndSubmission.Id);
        db.Submissions.Add(coverSubmission);

        var submission = Submission.StartForAssignment(assignment.Id, enrolled.Id, enrolledEnrollment.Id, 1);
        submission.RecordResponse(null, submissionFile.Id);
        db.Submissions.Add(submission);

        db.LearningProducts.AddRange(product, draftProduct, coverProduct);
        db.Lessons.AddRange(lesson1, lesson2, lesson3);
        db.Curricula.Add(curriculum);

        await db.SaveChangesAsync();

        Guid IdentityOf(Membership m) => m.IdentityId;

        return new AssetAccessWorld
        {
            Slug = unique,
            OtherSlug = $"{unique}-b",
            WorkspaceId = workspace.Id,
            TutorToken = tutor.Token,
            OtherTutorToken = other.Token,
            TutorIdentityId = IdentityOf(tutorMembership),
            OtherTutorIdentityId = IdentityOf(otherTutorMembership),
            TeacherIdentityId = IdentityOf(teacher),
            ParentIdentityId = IdentityOf(parent),
            EnrolledIdentityId = IdentityOf(enrolled),
            EnrolledEmail = $"{unique}-enrolled@integrationtest.local",
            UnenrolledIdentityId = IdentityOf(unenrolled),
            UnenrolledEmail = $"{unique}-unenrolled@integrationtest.local",
            OtherEnrolledIdentityId = IdentityOf(otherEnrolled),
            RevokableIdentityId = IdentityOf(revokable),
            RevokableEnrollmentId = revokableEnrollment.Id,
            SuspendableIdentityId = IdentityOf(suspendable),
            Lesson1Id = lesson1.Id,
            ProductId = product.Id,
            ActivityId = activity.Id,
            DraftLessonId = lesson3.Id,
            DraftLessonActivityId = draftActivity.Id,
            DraftLessonActivityFile = draftActivityFile.Id,
            UnlockableIdentityId = IdentityOf(unlockable),
            Video1 = video1.Id, Video1b = video1b.Id, Video2 = video2.Id, Video3 = video3.Id,
            VisibleResource = visibleResource.Id, TutorOnlyResource = tutorOnly.Id, ArchivedResource = archivedResource.Id,
            ActivityFile = activityFile.Id, EnrolledSubmissionFile = submissionFile.Id,
            UnreferencedByEnrolled = unreferencedByEnrolled.Id, UnreferencedByTutor = unreferencedByTutor.Id,
            CoverOfPublished = coverPublished.Id, CoverOfDraft = coverDraft.Id, Logo = logo.Id,
            VisibleImageResource = visibleImage.Id, TutorOnlyImageResource = tutorOnlyImage.Id,
            ActivityImageFile = activityImage.Id, SubmissionImage = submissionImage.Id, ImageBytes = imageBytes,
            VisibleAndActivityImage = visibleAndActivity.Id, VisibleAndHiddenImage = visibleAndHidden.Id,
            CoverAndSubmissionImage = coverAndSubmission.Id,
            Video1Bytes = video1Bytes, Video1bBytes = video1bBytes, ResourceBytes = resourceBytes, CoverBytes = coverBytes,
            RevokableEmail = $"{unique}-revokable@integrationtest.local",
        };
    }
}
