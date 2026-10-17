import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AXE_TAGS, THEME_MODES, leftoverLatin } from "../lib/audit.mjs";
import { APP_SCREENS, ROLE_ENTRY, SLUG, walk, TIPS_KEY, DISMISSED_TIPS } from "./screens.js";

/* =========================================================================
   In-app audit: every screen in screens.js (owner, learner, admin) × EN/AR ×
   the four theme modes in THEME_MODES, replaying API traffic recorded from a real seeded backend
   (record.mjs) — so it needs no backend and sees real response shapes.

   Same bar as the entry-screen audit: axe (WCAG 2.1 A/AA incl. contrast)
   clean, correct lang/dir, no English left on an Arabic screen, and
   desktop + mobile screenshots for the PR.
   ========================================================================= */

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const META = JSON.parse(fs.readFileSync(path.join(FIXTURES, "meta.json"), "utf8"));
const SHOTS = path.resolve(import.meta.dirname, "../.output/app-shots");

// Latin text that is data here: the workspace's address, and — on the admin catalog editor
// only — the catalog's own product codes and stored (English) names, which that screen edits.
const CATALOG_DATA = [
  "Solo Professional", "Solo Essential", "Solo Free", "Solo AI+", "AI Assessment", "AI Mentor", "AI Author",
  "Extra Students", "Extra Storage", "Collaboration+", "Collaboration", "Branding",
  "solo-professional", "solo-essential", "solo-free", "solo-ai-plus",
  "AiAssessment", "AiMentor", "AiAuthor", "ExtraStudents", "ExtraStorage", "CollaborationPlus",
];
const ALLOWED = { default: [SLUG], "admin-catalog": [SLUG, ...CATALOG_DATA] };

/** The recordings carry the recording stack's own origin; HAR replay matches full URLs, so each
 *  recording is re-pointed at the origin this run serves on (once per worker). */
const rebased = {};
function harFor(role, baseURL) {
  if (rebased[role]) return rebased[role];
  const har = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${role}.har`), "utf8"));
  const origin = new URL(baseURL).origin;
  for (const entry of har.log.entries) entry.request.url = entry.request.url.replace(/^https?:\/\/[^/]+/, origin);
  const file = path.join(os.tmpdir(), `audit-${role}-${process.pid}.har`);
  fs.writeFileSync(file, JSON.stringify(har));
  return (rebased[role] = file);
}

async function replay(context, role, unexpected, baseURL) {
  // Registered first so it runs last: anything the recording doesn't cover.
  await context.route("**/api/**", (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      unexpected.push(`${req.method()} ${new URL(req.url()).pathname}`);
      return route.fulfill({ status: 404, json: { message: "not in recording" } });
    }
    return route.fulfill({ status: 204 });
  });
  await context.routeFromHAR(harFor(role, baseURL), { url: "**/api/**", notFound: "fallback" });
}

/** Opens `screen` as its role in `lang`/`mode`, runs every check, and writes the screenshots.
 *  `routes(context)` may override recorded responses; `act(page)` puts the screen in a state. */
async function auditScreen({ browser, baseURL }, screen, lang, mode, { shotId = screen.id, routes, act } = {}) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 860 }, colorScheme: mode.os, reducedMotion: "reduce" });
  const unexpected = [];
  await replay(context, screen.role, unexpected, baseURL);
  if (routes) await routes(context);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(META.recordedAt));
  await page.addInitScript(([session, lang, stored, key, tips]) => {
    try { // also runs in the email previews' sandboxed iframe, where storage is off-limits
      localStorage.setItem("platform.session", session);
      localStorage.setItem("platform.lang", lang);
      if (stored) localStorage.setItem("platform.theme", stored);
      localStorage.setItem(key, tips);
    } catch { /* sandboxed frame */ }
  }, [JSON.stringify(META.sessions[screen.role]), lang, mode.stored, TIPS_KEY, JSON.stringify(DISMISSED_TIPS)]);

  await page.goto(ROLE_ENTRY[screen.role]);
  await page.waitForLoadState("networkidle");
  await walk(page, screen);
  if (act) await act(page);

  expect(unexpected, "the screen requested something the recording doesn't have — re-run npm run audit:record").toEqual([]);

  await expect(page.locator("html")).toHaveAttribute("lang", lang);
  await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  await expect(page.locator("html")).toHaveAttribute("data-theme", mode.theme);

  // The email previews render whole emails in a sandboxed iframe; those are audited by the
  // backend's own email tests, not here.
  const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).exclude("iframe").analyze();
  const violations = axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(violations, "axe found accessibility/contrast problems").toEqual([]);

  if (lang === "ar") {
    const text = await page.locator("body").innerText();
    expect(leftoverLatin(text, ALLOWED[screen.id] ?? ALLOWED.default), "English text left on an Arabic screen").toEqual([]);
  }

  const dir = path.join(SHOTS, shotId);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${lang}-${mode.id}-desktop.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400); // let layout settle at the new width before the mobile shot
  await page.screenshot({ path: path.join(dir, `${lang}-${mode.id}-mobile.png`), fullPage: true });
  await context.close();
}

for (const screen of APP_SCREENS) {
  for (const lang of ["en", "ar"]) {
    for (const mode of THEME_MODES) {
      test(`${screen.id} · ${lang} · ${mode.id}`, ({ browser, baseURL }) => auditScreen({ browser, baseURL }, screen, lang, mode));
    }
  }
}

// AI buttons in the states the seeded (Solo Professional) workspace never shows on its own: locked
// with the note beside it open, and a refused call's note under the field. The subscription the
// screen reads is the recorded one with one thing changed, so the rest of the screen is unchanged.
const ownerHar = JSON.parse(fs.readFileSync(path.join(FIXTURES, "owner.har"), "utf8"));
const recorded = (pattern) => JSON.parse(ownerHar.log.entries.find(
  (e) => e.request.method === "GET" && pattern.test(new URL(e.request.url).pathname)).response.content.text);
const recordedSubscription = recorded(/\/subscription$/);
const withSubscription = (change) => (context) => context.route(`**/api/workspaces/${SLUG}/subscription`,
  (route) => route.fulfill({ json: change(structuredClone(recordedSubscription)) }));
// The seeded course is published, so its lessons are view only and show no AI buttons; served as
// a draft (as it is while a tutor writes it), the lesson's editing tools appear.
const asDraftCurriculum = (context) => context.route("**/api/workspaces/*/products/*/curriculum", (route) =>
  route.request().method() === "GET"
    ? route.fulfill({ json: { ...recorded(/\/products\/[^/]+\/curriculum$/), status: "Draft" } })
    : route.fallback());
const screenById = (id) => APP_SCREENS.find((s) => s.id === id);

const AI_STATES = [
  { id: "ai-locked-credits", screen: "owner-setup", name: "Branding AI with no credits left",
    routes: withSubscription((s) => ({ ...s, aiCreditsRemaining: 0 })),
    act: async (page) => {
      await page.locator(".lw-setup__identity > button").first().click();
      await page.locator(".lw-setup__desclabel .lw-ai-locked").focus();
      await page.keyboard.press("Enter");     // aria-disabled, not disabled: keyboard users can still open the note
      await expect(page.getByRole("dialog")).toBeVisible();
    } },
  { id: "ai-locked-plan", screen: "owner-lesson-editor", name: "Assessment AI not in the plan (Free/Essential)",
    routes: async (context) => {
      await asDraftCurriculum(context);
      // The recording never opened this tab: an empty draft quiz, in AssessmentResponse's shape.
      await context.route("**/api/workspaces/*/lessons/*/assessment", (route) => route.request().method() === "GET"
        ? route.fulfill({ json: { id: null, lessonId: route.request().url().split("/lessons/")[1].split("/")[0], title: null, status: "Draft",
                                  kind: "Interactive", passingThresholdPercent: 70, publicationBlocker: null, questions: [], attemptLimit: null } })
        : route.fallback());
      await withSubscription((s) => ({ ...s, entitlements: s.entitlements.map((e) => (e.key === "profile:Assessment" ? { ...e, value: "Foundation" } : e)) }))(context);
    },
    act: async (page) => {
      await page.locator(".lw-studio__tabs button").nth(3).click();
      await page.locator(".lw-ai-locked").first().focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
    } },
  { id: "ai-error-inline", screen: "owner-setup", name: "A refused AI call, inline under its field",
    routes: (context) => context.route(`**/api/workspaces/${SLUG}/setup/ai-suggest-description`,
      (route) => route.fulfill({ status: 403, json: { message: "AI-suggested branding text needs the Professional plan." } })),
    act: async (page) => {
      await page.locator(".lw-setup__identity > button").first().click();
      await page.locator(".lw-setup__desclabel button").click();
      await expect(page.getByRole("alert").filter({ hasText: /./ }).last()).toBeVisible();
    } },
];

// The "Assign activity" dialog (lesson editor → Activities → Assign), in its Draft and Published
// states. The seeded lessons have no activities, so one is added to the recorded lesson, and the
// assignment it opens is served as a draft or as published (with a due date and an attempt limit,
// so "Apply new due date" / "Apply attempt limit" show too).
const ACTIVITY = { id: "00000000-0000-4000-8000-0000000000a1", title: "ورقة عمل: مساحة شبه المنحرف", type: "Homework",
  position: 0, hasAssignment: true, assignmentStatus: "Draft", instructions: null };
const withActivity = (context) => context.route(/\/api\/workspaces\/[^/]+\/lessons\/[^/?]+$/, (route) => {
  const pathname = new URL(route.request().url()).pathname;
  const entry = route.request().method() === "GET" && ownerHar.log.entries.find(
    (e) => e.request.method === "GET" && new URL(e.request.url).pathname === pathname);
  if (!entry) return route.fallback();
  const lesson = JSON.parse(entry.response.content.text);
  for (const revision of [lesson.currentRevision, lesson.draftRevision].filter(Boolean)) revision.learningActivities = [ACTIVITY];
  return route.fulfill({ json: lesson });
});
const assignment = (status) => ({
  id: "00000000-0000-4000-8000-0000000000b1", learningActivityId: ACTIVITY.id, learningProductId: "00000000-0000-4000-8000-0000000000c1",
  status, availabilityMode: "Immediate", scheduledAvailabilityAt: null,
  dueDateMode: status === "Draft" ? "None" : "Fixed", dueAt: status === "Draft" ? null : "2026-10-20T15:00:00Z",
  submissionWindowStartAt: null, submissionWindowEndAt: null,
  attemptMode: status === "Draft" ? "Single" : "Multiple", maxAttempts: status === "Draft" ? null : 3,
  evaluationMethod: "Manual", visible: true, notifyOnPublish: true, notifyOnFeedbackPublished: true,
  configured: status !== "Draft", createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z",
  publishedAt: status === "Draft" ? null : "2026-10-01T10:00:00Z", closedAt: null, archivedAt: null,
  publicationBlocker: status === "Draft" ? "Configure this assignment before publishing." : null,
});

/** Every control in the dialog lies within the dialog, at 1280×720 and at phone width. */
async function expectControlsInsideDialog(page) {
  for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    const panel = page.locator(".lw-modal__panel");
    const box = await panel.boundingBox();
    const outside = [];
    for (const control of await panel.locator("input, select, textarea, button").all()) {
      if (!(await control.isVisible())) continue;
      const b = await control.boundingBox();
      if (b.x < box.x - 0.5 || b.x + b.width > box.x + box.width + 0.5)
        outside.push(`${await control.evaluate((el) => el.outerHTML.slice(0, 80))} at x ${Math.round(b.x)}–${Math.round(b.x + b.width)} (dialog ${Math.round(box.x)}–${Math.round(box.x + box.width)}, ${size.width}px)`);
    }
    expect(outside, "controls outside the dialog").toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 860 });
}

const DIALOG_STATES = ["Draft", "Published"].map((status) => ({
  id: `assign-dialog-${status.toLowerCase()}`, screen: "owner-lesson-editor",
  routes: async (context) => {
    await withActivity(context);
    await context.route("**/api/workspaces/*/lessons/*/activities/*/assignment", (route) =>
      route.request().method() === "GET" ? route.fulfill({ json: assignment(status) }) : route.fallback());
  },
  act: async (page) => {
    await page.locator(".lw-studio__tabs button").last().click();         // Activities
    await page.locator(".lw-studio__unitrow .lw-btn").filter({ has: page.locator("svg.lucide-send") }).first().click();
    await expect(page.locator(".lw-modal__panel .lw-studio__draftform")).toBeVisible();
    if (status === "Published") await expect(page.locator(".lw-modal__panel .lw-studio__draftform > button")).toHaveCount(2);
    await expectControlsInsideDialog(page);
  },
}));

// PR #16 follow-ups. A refused "Publish changes" explains itself inline and names the lessons
// (one live lesson with an unready draft, one never-live empty lesson that publishing skips);
// the Assignments list with every status and the "Remove from learners" dialog; and the
// learner's assignment cards with a result, feedback, Closed and Submitted.
const recordedCurriculum = recorded(/\/products\/[^/]+\/curriculum$/);
const refusedCurriculum = () => {
  const c = structuredClone(recordedCurriculum);
  c.draftOpen = true;
  const unit = c.units[0];
  unit.lessons[0] = { ...unit.lessons[0], hasOpenDraft: true, publishBlocker: "NeedsContent" };
  unit.lessons.push({ id: "00000000-0000-4000-8000-0000000000d1", title: "درس جديد: محيط الدائرة", status: "Draft",
    revisionCount: 1, hasOpenDraft: true, estimatedMinutes: null, publishBlocker: "NeedsContent" });
  return c;
};
const overviewRow = (id, title, status, extra = {}) => ({
  assignmentId: `00000000-0000-4000-8000-0000000000e${id}`, learningActivityId: `00000000-0000-4000-8000-0000000000f${id}`,
  activityTitle: title, activityType: "Homework", lessonId: recordedCurriculum.units[0].lessons[0].id, lessonTitle: recordedCurriculum.units[0].lessons[0].title,
  productId: recordedCurriculum.learningProductId, productTitle: recordedCurriculum.productTitle, status,
  dueAt: "2026-10-20T15:00:00Z", recipientCount: 3, submittedCount: 1, ...extra,
});
const learnerRow = (id, title, learnerStatus, extra = {}) => ({
  assignmentId: `00000000-0000-4000-8000-00000000001${id}`, learningActivityId: `00000000-0000-4000-8000-00000000002${id}`,
  activityTitle: title, activityType: "Homework", lessonId: recordedCurriculum.units[0].lessons[0].id, lessonTitle: recordedCurriculum.units[0].lessons[0].title,
  productId: recordedCurriculum.learningProductId, productTitle: recordedCurriculum.productTitle,
  dueAt: "2026-10-20T15:00:00Z", learnerStatus, submissionId: null, passed: null, hasFeedback: false, ...extra,
});
const FOLLOWUP_STATES = [
  { id: "publish-refused", screen: "owner-studio-course",
    routes: async (context) => {
      await context.route("**/api/workspaces/*/products/*/curriculum", (route) =>
        route.request().method() === "GET" ? route.fulfill({ json: refusedCurriculum() }) : route.fallback());
      await context.route("**/api/workspaces/*/products/*/curriculum/publish", (route) => route.fulfill({ status: 409, json: {
        message: "Some lessons have changes that can't be published yet: مساحة شبه المنحرف: A lesson revision needs content before it can be published." } }));
    },
    act: async (page) => {
      await page.locator(".lw-studio__bar .lw-btn--accent").click();
      await expect(page.getByRole("alert")).toBeVisible();
    } },
  { id: "assignments-remove", screen: "owner-assignments",
    routes: (context) => context.route(`**/api/workspaces/${SLUG}/assignments`, (route) => route.fulfill({ json: { rows: [
      overviewRow(1, "ورقة عمل: مساحة شبه المنحرف", "Active"),
      overviewRow(2, "تدريب: مساحة شبه المنحرف", "Closed", { submittedCount: 2 }),
      overviewRow(3, "واجب قديم", "Archived"),
    ] } })),
    act: async (page) => {
      await page.locator("tr", { hasText: "تدريب: مساحة شبه المنحرف" }).getByRole("button").click();
      await expect(page.getByRole("dialog")).toBeVisible();
    } },
  { id: "learner-assignment-cards", screen: "learner-assignments",
    routes: (context) => context.route(`**/api/workspaces/${SLUG}/learn/assignments`, (route) => route.fulfill({ json: { rows: [
      learnerRow(1, "واجب: مساحة شبه المنحرف", "Completed", { passed: true, hasFeedback: true, submissionId: "00000000-0000-4000-8000-000000000031" }),
      learnerRow(2, "تدريب إضافي", "Submitted", { submissionId: "00000000-0000-4000-8000-000000000032" }),
      learnerRow(3, "ورقة عمل: الدائرة", "Closed"),
      learnerRow(4, "مراجعة الوحدة", "Overdue"),
      learnerRow(5, "تمارين الأسبوع", "Available", { dueAt: null }),
    ] } })),
    act: async (page) => { await expect(page.locator(".lw-lassign__row")).toHaveCount(5); } },
];

for (const state of FOLLOWUP_STATES) {
  for (const lang of ["en", "ar"]) {
    for (const mode of THEME_MODES) {
      test(`${state.id} · ${lang} · ${mode.id}`, ({ browser, baseURL }) =>
        auditScreen({ browser, baseURL }, screenById(state.screen), lang, mode, { shotId: state.id, routes: state.routes, act: state.act }));
    }
  }
}

for (const state of DIALOG_STATES) {
  for (const lang of ["en", "ar"]) {
    for (const mode of THEME_MODES) {
      test(`${state.id} · ${lang} · ${mode.id}`, ({ browser, baseURL }) =>
        auditScreen({ browser, baseURL }, screenById(state.screen), lang, mode, { shotId: state.id, routes: state.routes, act: state.act }));
    }
  }
}

for (const state of AI_STATES) {
  for (const lang of ["en", "ar"]) {
    for (const mode of THEME_MODES) {
      test(`${state.id} · ${lang} · ${mode.id}`, ({ browser, baseURL }) =>
        auditScreen({ browser, baseURL }, screenById(state.screen), lang, mode, { shotId: state.id, routes: state.routes, act: state.act }));
    }
  }
}

// The Overview's live banner is how a tutor shares their enrolment link — it once pointed at
// /{slug}, a route that doesn't exist. Its link, its copied text and where it actually lands.
test("overview enrolment link opens the public join page, not 404", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 860 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseURL).origin });
  const unexpected = [];
  await replay(context, "owner", unexpected, baseURL);
  // The join page's own lookup isn't part of the owner's recording.
  await context.route(`**/api/workspaces/${SLUG}/join`, (route) =>
    route.fulfill({ json: { workspaceName: "أكاديمية النور", description: null, acceptingRequests: true } }));
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(META.recordedAt));
  await page.addInitScript(([session, key, tips]) => {
    localStorage.setItem("platform.session", session);
    localStorage.setItem("platform.lang", "en");
    localStorage.setItem(key, tips);
  }, [JSON.stringify(META.sessions.owner), TIPS_KEY, JSON.stringify(DISMISSED_TIPS)]);
  await page.goto(ROLE_ENTRY.owner);
  await page.waitForLoadState("networkidle");

  const expected = `${new URL(baseURL).origin}/join/${SLUG}`;
  const link = page.locator(".lw-home__livelink a");
  await expect(link).toHaveAttribute("href", `/join/${SLUG}`);
  await page.locator(".lw-home__livecopy").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);

  const [joinPage] = await Promise.all([context.waitForEvent("page"), link.click()]);
  await joinPage.waitForLoadState("networkidle");
  expect(joinPage.url()).toBe(expected);
  await expect(joinPage.locator("form.lw-entry__form")).toBeVisible();
  await expect(joinPage.getByText("أكاديمية النور")).toBeVisible();
  expect(unexpected).toEqual([]);
  await context.close();
});
