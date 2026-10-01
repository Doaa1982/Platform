/* =========================================================================
   Every screen inside the app, per role, and how to reach it — shared by the
   fixture recorder (record.mjs) and the audit (app-screens.spec.js), so both
   always visit exactly the same screens the same way.

   Navigation is by stable hooks (data-nav-id, the admin tab order) or by the
   seed's own Arabic course/lesson titles, which are data and so read the same
   whichever UI language is active.
   ========================================================================= */

export const COURSE = "الرياضيات للصف الثامن";
export const LESSON = "مساحة شبه المنحرف";
export const SLUG = "al-noor";

export const ROLE_ENTRY = { owner: "/teach", learner: "/learn", admin: "/admin" };

const owner = (id, name, nav, extra = {}) => ({ role: "owner", id: `owner-${id}`, name, nav, ...extra });
const learner = (id, name, nav, extra = {}) => ({ role: "learner", id: `learner-${id}`, name, nav, ...extra });
const admin = (id, name, tab) => ({ role: "admin", id: `admin-${id}`, name, tab });

export const APP_SCREENS = [
  owner("overview", "Overview", "overview"),
  owner("products", "Learning products", "products"),
  owner("studio", "Content Studio", "studio"),
  owner("studio-course", "Content Studio: course curriculum", "studio", { open: [COURSE] }),
  owner("lesson-editor", "Lesson editor", "studio", { open: [COURSE, LESSON] }),
  owner("edit-lesson", "Edit lesson", "editLesson"),
  owner("members", "Members", "members"),
  owner("enrollment", "Course enrollment", "enrollment"),
  owner("assessment", "Assessment & certificates", "assessment"),
  owner("assignments", "Assignments", "assignments"),
  owner("setup", "Workspace setup", "setup"),
  owner("billing", "Billing", "billing"),
  owner("plans", "Plans & add-ons", "plans"),
  owner("ai-credits", "AI credits", "aiCredits"),
  owner("settings", "Workspace settings", "settings"),

  learner("dashboard", "Learner dashboard", "dashboard"),
  learner("courses", "My courses", "courses"),
  learner("course", "Course curriculum", "courses", { open: [COURSE] }),
  learner("lesson", "Lesson", "courses", { open: [COURSE, LESSON] }),
  learner("assessments", "Assessments", "assessments"),
  learner("assignments", "Assignments", "assignments"),
  learner("ai", "AI tutor", "ai"),

  admin("applications", "Admin: applications", 0),
  admin("invitations", "Admin: workspaces & invitations", 1),
  admin("subscriptions", "Admin: subscriptions", 2),
  admin("credit-purchases", "Admin: credit purchases", 3),
  admin("catalog", "Admin: catalog", 4),
  admin("overrides", "Admin: entitlement overrides", 5),
  admin("emails", "Admin: email previews", 6),
];

export const TIPS_KEY = "lw.dismissedTips";
export const DISMISSED_TIPS = [`trialGift:${SLUG}`];

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
}

/** From the role's landing route, navigates to `screen`. */
export async function walk(page, screen) {
  if (screen.role === "admin") {
    await page.locator('[role="tab"]').nth(screen.tab).click();
  } else if (screen.role === "owner") {
    await page.locator(`[data-nav-id="${screen.nav}"]`).first().click();
  } else {
    const link = page.locator(`[data-nav-id="${screen.nav}"]`).first();
    if (!(await link.isVisible())) await page.locator("[data-nav-more]").click();
    await page.locator(`[data-nav-id="${screen.nav}"]`).first().click();
  }
  await settle(page);
  for (const text of screen.open ?? []) {
    await page.getByText(text, { exact: true }).first().click();
    await settle(page);
  }
}
