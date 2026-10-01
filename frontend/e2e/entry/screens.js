/* =========================================================================
   Every screen someone can reach before (or while) getting into a workspace,
   each in a fixed state, with the API answers that produce it stubbed — so the
   audit (axe, raw-text, screenshots) needs no backend and is deterministic.

   `api` maps "METHOD /api/path-regex" to a response; anything not listed fails
   the test, so a screen calling an endpoint we didn't expect is noticed.
   `act` drives the page into a state reachable only by interaction.
   ========================================================================= */

const inDays = (d) => new Date(Date.now() + d * 86_400_000).toISOString();
const SUBMITTED = "2026-09-28T10:00:00Z";

const session = { token: "e2e-token", expiresAt: inDays(1), fullName: "Sara Ahmed" };

const me = (workspaces) => ({
  identityId: "00000000-0000-0000-0000-000000000001",
  email: "sara.ahmed@example.com",
  fullName: "سارة أحمد",
  workspaces,
});

const ws = (name, slug, roles, membershipStatus = "Active") =>
  ({ workspaceId: crypto.randomUUID(), name, slug, membershipStatus, roles });

const signup = (status, extra = {}) => ({
  "GET /api/signup-requests/status/": {
    json: { fullName: "سارة أحمد", email: "sara.ahmed@example.com", status, headline: "x", detail: "x", submittedAt: SUBMITTED, ...extra },
  },
});

const joinStatus = (status) => ({
  "GET /api/join-requests/status/": {
    json: { fullName: "Omar Hassan", email: "omar@example.com", status, headline: "x", detail: "x", submittedAt: SUBMITTED },
  },
});

const invite = (extra) => ({
  "GET /api/invitations/": {
    json: { workspaceName: "أكاديمية النور", intendedRole: "Learner", email: "new.student@example.com", expiresAt: inDays(7), accountExists: false, ...extra },
  },
});

const join = (extra) => ({
  "GET /api/workspaces/al-noor/join": {
    json: { workspaceName: "Al Noor Academy", description: "Math and Arabic for grades 7 to 9, taught live and recorded.", acceptingRequests: true, ...extra },
  },
});

const notFound = (prefix) => ({ [prefix]: { status: 404, json: { message: "Not found (server English, must not be shown)." } } });

export const SCREENS = [
  { id: "landing", name: "Landing", route: "/", roles: "Visitor", api: { "GET /api/catalog/plans": { json: [] } } },

  { id: "login-tutor", name: "Sign in (tutor)", route: "/teach", roles: "Tutor, owner" },
  { id: "login-student", name: "Sign in (student)", route: "/learn", roles: "Student" },
  { id: "login-error", name: "Sign in: wrong password", route: "/teach", roles: "Tutor, student",
    api: { "POST /api/auth/login": { status: 401, json: { message: "Invalid credentials." } } },
    act: async (page) => {
      await page.fill('input[type="email"]', "sara@example.com");
      await page.fill('input[name="password"]', "wrong-password");
      await page.click('button[type="submit"]');
      await page.waitForSelector('[role="alert"]');
    } },
  { id: "session-expired", name: "Session expired", route: "/teach", roles: "Everyone signed in", session,
    api: { "GET /api/me": { status: 401, json: { message: "Token expired." } } } },
  { id: "session-error", name: "Session couldn't load", route: "/teach", roles: "Everyone signed in", session,
    api: { "GET /api/me": { status: 500, json: { message: "Internal server error." } } } },

  { id: "forgot", name: "Forgot password", route: "/forgot-password/teach", roles: "Everyone" },
  { id: "forgot-sent", name: "Forgot password: link sent", route: "/forgot-password/teach", roles: "Everyone",
    api: { "POST /api/auth/forgot-password": { json: { message: "ok" } } },
    act: async (page) => {
      await page.fill('input[type="email"]', "sara.ahmed@example.com");
      await page.click('button[type="submit"]');
      await page.waitForSelector(".lw-entry__mark--good");
    } },
  { id: "reset", name: "Reset password", route: "/reset-password/tok", roles: "Everyone",
    api: { "GET /api/auth/reset-password/": { json: { email: "sara.ahmed@example.com", expiresAt: inDays(0.04) } } } },
  { id: "reset-expired", name: "Reset link expired or used", route: "/reset-password/tok", roles: "Everyone",
    api: notFound("GET /api/auth/reset-password/") },

  { id: "apply", name: "Tutor application", route: "/apply", roles: "Prospective tutor" },
  { id: "apply-sent", name: "Application sent", route: "/apply", roles: "Prospective tutor",
    api: { "POST /api/signup-requests": { json: { requestId: "r1", statusLink: "/apply/status/abc123", delivered: false } } },
    act: async (page) => {
      await page.fill('input[autocomplete="name"]', "سارة أحمد");
      await page.fill('input[type="email"]', "sara.ahmed@example.com");
      await page.click('button[type="submit"]');
      await page.waitForSelector(".lw-entry__code");
    } },
  { id: "apply-review", name: "Application under review", route: "/apply/status/abc", roles: "Prospective tutor", api: signup("UnderReview") },
  { id: "apply-approved", name: "Application approved", route: "/apply/status/abc", roles: "Prospective tutor", api: signup("Approved") },
  { id: "apply-ready", name: "Application approved: workspace ready", route: "/apply/status/abc", roles: "Prospective tutor", api: signup("Approved", { workspaceReady: true }) },
  { id: "apply-rejected", name: "Application not approved", route: "/apply/status/abc", roles: "Prospective tutor", api: signup("Rejected") },
  { id: "apply-invalid", name: "Application link invalid", route: "/apply/status/abc", roles: "Prospective tutor", api: notFound("GET /api/signup-requests/status/") },

  { id: "invite-student", name: "Invitation (new student)", route: "/invite/tok", roles: "Student", api: invite() },
  { id: "invite-tutor", name: "Invitation (existing account, teacher)", route: "/invite/tok", roles: "Tutor",
    api: invite({ intendedRole: "Teacher", email: "mohamed.ali@example.com", accountExists: true }) },
  { id: "invite-owner", name: "Invitation (new workspace owner)", route: "/invite/tok", roles: "Workspace owner",
    api: invite({ intendedRole: "Owner", workspaceName: "Al Noor Academy", email: "owner@example.com" }) },
  { id: "invite-invalid", name: "Invitation expired, used or cancelled", route: "/invite/tok", roles: "Everyone invited",
    api: notFound("GET /api/invitations/") },

  { id: "join", name: "Request to join", route: "/join/al-noor", roles: "Student", api: join() },
  { id: "join-sent", name: "Join request sent", route: "/join/al-noor", roles: "Student",
    api: { ...join(), "POST /api/workspaces/al-noor/join": { json: { id: "j1", status: "Submitted", statusLink: "/join-requests/status/abc" } } },
    act: async (page) => {
      await page.fill('input[autocomplete="name"]', "Omar Hassan");
      await page.fill('input[type="email"]', "omar@example.com");
      await page.click('button[type="submit"]');
      await page.waitForSelector(".lw-entry__mark--good");
    } },
  { id: "join-closed", name: "Workspace not accepting requests", route: "/join/al-noor", roles: "Student", api: join({ acceptingRequests: false }) },
  { id: "join-invalid", name: "Join link invalid", route: "/join/al-noor", roles: "Student", api: notFound("GET /api/workspaces/al-noor/join") },
  { id: "join-status-waiting", name: "Join request waiting", route: "/join-requests/status/abc", roles: "Student", api: joinStatus("Submitted") },
  { id: "join-status-approved", name: "Join request approved", route: "/join-requests/status/abc", roles: "Student", api: joinStatus("Approved") },
  { id: "join-status-declined", name: "Join request declined", route: "/join-requests/status/abc", roles: "Student", api: joinStatus("Declined") },
  { id: "join-status-cancelled", name: "Join request cancelled", route: "/join-requests/status/abc", roles: "Student", api: joinStatus("Cancelled") },

  { id: "picker", name: "Choose a workspace", route: "/teach", roles: "Tutor in several workspaces", session,
    api: { "GET /api/me": { json: me([
      ws("أكاديمية النور", "al-noor", ["Owner"]),
      ws("Bright Minds Tutoring", "bright", ["Teacher", "AssistantTeacher"]),
      ws("Science Club", "science", ["Learner"]),
      ws("Old Academy", "old", ["Teacher"], "Suspended"),
    ]) } } },
  { id: "picker-none", name: "No workspace on this side", route: "/teach", roles: "Student who opened the tutor side", session,
    api: { "GET /api/me": { json: me([ws("Science Club", "science", ["Learner"])]) } } },

  { id: "admin-login", name: "Admin sign in", route: "/admin", roles: "Platform admin" },
  { id: "admin-denied", name: "Admin: access denied", route: "/admin", roles: "Signed-in non-admin", session,
    api: { "GET /api/me": { json: me([]) }, "GET /api/admin/": { status: 403, json: { message: "Forbidden." } } } },

  { id: "not-found", name: "Page not found", route: "/no-such-page", roles: "Everyone" },
];

export const SESSION_KEY = "platform.session";
