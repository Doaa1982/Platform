import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/* =========================================================================
   PR #16 follow-ups:
   · a refused "Publish changes" explains itself inline, naming each lesson as a link;
   · the lesson editor's notes in Edit Mode all say saved changes stay private;
   · Assignments: translated statuses (never a raw enum), "Remove from learners" via an
     in-app dialog, an Archived filter;
   · the learner's My Assignments cards: result, feedback, Closed, neutral "Submitted".
   t() wraps every key as ⟦key⟧, so any text that didn't come from translations stands out.
   ========================================================================= */

const marker = (key) => `⟦${key}⟧`;
vi.mock("../i18n/useLanguage", () => ({ useLanguage: () => ({ t: marker, lang: "en", dir: "ltr" }) }));
vi.mock("../auth/authContext", () => ({ useAuth: () => ({ session: { token: "T" }, workspace: { slug: "math-for-all" } }) }));
vi.mock("../components/VideoPlayer", () => ({ default: () => null }));
vi.mock("../components/AiSuggestButton", () => ({ default: () => null, AiErrorNote: () => null }));
vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal()),
  getProducts: vi.fn(),
  getCurriculum: vi.fn(),
  curriculumTransition: vi.fn(),
  getLesson: vi.fn(),
  getAssignmentsOverview: vi.fn(),
  getAssignmentSubmissions: vi.fn(),
  assignmentTransition: vi.fn(),
  getMyAssignments: vi.fn(),
}));

import * as api from "../api/client";
import ContentStudioScreen, { LessonEditorScreen } from "./ContentStudioScreen.jsx";
import AssignmentsOverviewScreen from "./AssignmentsOverviewScreen.jsx";
import LearnerAssignmentsScreen from "./LearnerAssignmentsScreen.jsx";

const SERVER_409 = "Some lessons have changes that can't be published yet: Solving two-step equations: A lesson revision needs content before it can be published.";

const lessonRow = (extra) => ({ id: "l1", title: "Solving two-step equations", status: "Published", revisionCount: 2, hasOpenDraft: true, estimatedMinutes: 10, publishBlocker: null, ...extra });
const curriculum = (lessons, extra) => ({
  id: "c1", learningProductId: "p1", productTitle: "Algebra", productStatus: "Published", title: "Algebra",
  status: "Published", canAuthor: true, publicationBlocker: null, requiresSequentialCompletion: false, draftOpen: true,
  units: [{ id: "u1", title: "Equations", position: 1, lessons }], unplacedLessons: [], ...extra,
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Publish changes, refused", () => {
  it("shows the refusal inline (not a toast), naming each blocking lesson as a link, until the tutor retries", async () => {
    const blocked = lessonRow({ publishBlocker: "NeedsContent" });
    api.getCurriculum.mockResolvedValue(curriculum([blocked, lessonRow({ id: "l2", title: "One-step equations", hasOpenDraft: false })]));
    api.curriculumTransition.mockRejectedValue(Object.assign(new Error(SERVER_409), { status: 409 }));

    render(<ContentStudioScreen productId="p1" onSelectProduct={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(marker("studio.publishChanges")) }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(marker("studio.publishRefusedTitle"));
    expect(within(alert).getByRole("button", { name: "Solving two-step equations" })).toBeTruthy();
    expect(alert.textContent).toContain(marker("studio.blockerNeedsContent"));
    expect(alert.textContent).not.toContain("One-step equations"); // a ready lesson isn't listed
    expect(alert.closest(".lw-studio__readiness")).not.toBeNull(); // inline, beside the button — not Message's fixed toast
  });

  it("falls back to the server's own message when it isn't about unready lessons", async () => {
    api.getCurriculum.mockResolvedValue(curriculum([lessonRow()]));
    api.curriculumTransition.mockRejectedValue(Object.assign(new Error("Every unit needs at least one lesson."), { status: 409 }));

    render(<ContentStudioScreen productId="p1" onSelectProduct={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(marker("studio.publishChanges")) }));
    expect((await screen.findByRole("alert")).textContent).toContain("Every unit needs at least one lesson.");
  });

  it("lists live lessons that aren't ready before Publish is clicked, and never-live ones as not included", async () => {
    api.getCurriculum.mockResolvedValue(curriculum([
      lessonRow({ publishBlocker: "NeedsVideo" }),
      lessonRow({ id: "l3", title: "Empty new lesson", status: "Draft", revisionCount: 1, publishBlocker: "NeedsContent" }),
    ]));

    render(<ContentStudioScreen productId="p1" onSelectProduct={() => {}} />);
    const notReady = (await screen.findByText(marker("studio.notReadyTitle"))).closest(".lw-studio__notready");
    expect(within(notReady).getByRole("button", { name: "Solving two-step equations" })).toBeTruthy();
    expect(notReady.textContent).toContain(marker("studio.blockerNeedsVideo"));
    const skipped = screen.getByText(marker("studio.notIncludedTitle")).closest(".lw-studio__notincluded");
    expect(within(skipped).getByRole("button", { name: "Empty new lesson" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Lesson editor in Edit Mode", () => {
  const revision = (extra) => ({
    id: "r2", version: 2, status: "Draft", title: "Solving two-step equations", body: "Body", estimatedMinutes: 10,
    deliveryMode: "Reading", video: null, videoUrl: null, whatYoullLearn: null, learningObjectives: null, glossary: null,
    homework: null, resources: [], learningActivities: [], requireQuizToComplete: false, ...extra,
  });
  const lesson = (extra) => ({
    id: "l1", title: "Solving two-step equations", status: "Published",
    currentRevision: revision({ id: "r1", version: 1, status: "Published" }), draftRevision: null, history: [], ...extra,
  });
  async function openEditor(curriculumExtra, lessonDetail) {
    api.getProducts.mockResolvedValue({ products: [{ id: "p1", title: "Algebra" }] });
    api.getCurriculum.mockResolvedValue(curriculum([lessonRow({ hasOpenDraft: !!lessonDetail.draftRevision })], curriculumExtra));
    api.getLesson.mockResolvedValue(lessonDetail);
    const view = render(<LessonEditorScreen initialProductId="p1" initialLessonId="l1" onBack={() => {}} />);
    await screen.findByText(marker("studio.tabContent"));
    return view;
  }

  it("never says a save or a lesson Publish goes live right away, and hides the per-lesson Publish", async () => {
    const { container } = await openEditor({ draftOpen: true }, lesson({ draftRevision: revision() }));
    const text = container.textContent;
    expect(text).toContain(marker("studio.editModeDraftNote"));
    expect(text).toContain(marker("studio.editModeSaveHintMid"));
    expect(text).not.toContain(marker("studio.saveDraftHintSuffix")); // "Publish makes this version visible to learners right away"
    expect(text).not.toContain(marker("studio.learnersSeeThat"));
    expect(screen.queryByRole("button", { name: new RegExp(`^\\s*${marker("studio.publish")}\\s*$`) })).toBeNull();
    expect(screen.getByRole("button", { name: marker("studio.saveDraft") })).toBeTruthy();
  });

  it("before the first save, says Save changes keeps the change private", async () => {
    const { container } = await openEditor({ draftOpen: true }, lesson());
    expect(container.textContent).toContain(marker("studio.editModeSaveChangesMid"));
    expect(container.textContent).not.toContain(marker("studio.publishedDirectNoteSuffix")); // "updates it immediately"
  });

  it("outside Edit Mode, keeps the direct-publish notes and the Publish button", async () => {
    const { container } = await openEditor({ status: "Draft", draftOpen: false }, lesson({ status: "Draft", currentRevision: null, draftRevision: revision() }));
    expect(container.textContent).toContain(marker("studio.saveDraftHintSuffix"));
    expect(screen.getByRole("button", { name: new RegExp(marker("studio.publish")) })).toBeTruthy();
  });
});

describe("Assignments (teacher)", () => {
  const row = (extra) => ({
    assignmentId: "a1", learningActivityId: "act1", activityTitle: "Practice: one-step equations", activityType: "Homework",
    lessonId: "l1", lessonTitle: "One-step equations", productId: "p1", productTitle: "Algebra",
    status: "Active", dueAt: null, recipientCount: 3, submittedCount: 1, ...extra,
  });

  it("shows translated statuses, hides archived ones behind a filter, and archives through an in-app dialog", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    api.getAssignmentsOverview.mockResolvedValue({ rows: [
      row(), row({ assignmentId: "a2", learningActivityId: "act0", status: "Closed" }), row({ assignmentId: "a3", activityTitle: "Old quiz", status: "Archived" }),
    ] });
    api.assignmentTransition.mockResolvedValue({});

    const { container } = render(<AssignmentsOverviewScreen />);
    await screen.findByText(marker("assignOverview.statusClosed"));
    expect(screen.getByText(marker("assignOverview.statusActive"))).toBeTruthy();
    expect(container.querySelector("table").textContent.replace(/⟦[\w.]+⟧/g, " ")).not.toMatch(/\b(Active|Closed|Archived)\b/);
    expect(screen.queryByText("Old quiz")).toBeNull();

    const closedRow = screen.getByText(marker("assignOverview.statusClosed")).closest("tr");
    fireEvent.click(within(closedRow).getByRole("button", { name: new RegExp(marker("assignOverview.removeFromLearners")) }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain(marker("assignOverview.removeBody"));
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(marker("assignOverview.removeConfirm")) }));
    await waitFor(() => expect(api.assignmentTransition).toHaveBeenCalledWith("T", "math-for-all", "l1", "act0", "archive"));
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(marker("assignOverview.filterArchived")) }));
    expect(await screen.findByText("Old quiz")).toBeTruthy();
    expect(screen.getByText(marker("assignOverview.statusArchived"))).toBeTruthy();
  });

  it("the Submissions page translates every submission status, including NotStarted", async () => {
    api.getAssignmentsOverview.mockResolvedValue({ rows: [row()] });
    const learner = (id, status, extra) => ({ membershipId: id, fullName: `Learner ${id}`, email: `${id}@example.com`, submissionId: status === "NotStarted" ? null : `s${id}`,
      status, attemptNumber: 1, responseText: null, responseLearningAssetId: null, feedback: null, passed: null, evaluatedAt: null, startedAt: null, ...extra });
    api.getAssignmentSubmissions.mockResolvedValue({
      assignment: { status: "Closed" },
      rows: [learner("1", "NotStarted"), learner("2", "InProgress"), learner("3", "Submitted"), learner("4", "UnderReview"), learner("5", "Evaluated", { passed: true })],
    });

    render(<AssignmentsOverviewScreen />);
    fireEvent.click(await screen.findByText("Practice: one-step equations"));
    await screen.findByText(marker("assignOverview.subNotStarted"));
    const table = screen.getByRole("table");
    for (const key of ["subNotStarted", "subInProgress", "subSubmitted", "subUnderReview", "subEvaluated"])
      expect(table.textContent).toContain(marker(`assignOverview.${key}`));
    const visible = (table.textContent + document.querySelector(".lw-assign__meta").textContent).replace(/⟦[\w.]+⟧/g, " ");
    expect(visible).not.toMatch(/NotStarted|InProgress|UnderReview|\bEvaluated\b|\bClosed\b/);
    expect(screen.getByRole("button", { name: new RegExp(marker("assignOverview.removeFromLearners")) })).toBeTruthy();
  });
});

describe("My Assignments (learner)", () => {
  const row = (extra) => ({
    assignmentId: "a1", learningActivityId: "act1", activityTitle: "Homework 1", activityType: "Homework",
    lessonId: "l1", lessonTitle: "Equations", productId: "p1", productTitle: "Algebra",
    dueAt: "2026-10-20T10:00:00Z", learnerStatus: "Available", submissionId: null, passed: null, hasFeedback: false, ...extra,
  });

  it("shows the result and feedback of a completed item, Closed for a closed one, and Submitted in a neutral style", async () => {
    api.getMyAssignments.mockResolvedValue({ rows: [
      row({ learnerStatus: "Completed", passed: true, hasFeedback: true }),
      row({ assignmentId: "a2", activityTitle: "Homework 2", learnerStatus: "Closed" }),
      row({ assignmentId: "a3", activityTitle: "Homework 3", learnerStatus: "Submitted" }),
    ] });
    render(<LearnerAssignmentsScreen onOpenAssignment={() => {}} />);

    const completed = (await screen.findByText("Homework 1")).closest("button");
    expect(completed.textContent).toContain(marker("learnerAssignments.resultPassed"));
    expect(completed.textContent).toContain(marker("learnerAssignments.viewFeedback"));
    expect(completed.textContent).toContain(marker("learnerAssignments.dueLabel"));

    const closed = screen.getByText("Homework 2").closest("button");
    expect(closed.textContent).toContain(marker("learnerAssignments.statusClosed"));
    expect(closed.textContent).not.toContain(marker("learnerAssignments.statusOverdue"));

    const submittedPill = screen.getByText(marker("learnerAssignments.statusSubmitted")).closest(".lw-lassign__pill");
    expect(submittedPill.className).toContain("is-waiting");
    expect(submittedPill.className).not.toContain("is-failed");
  });
});
