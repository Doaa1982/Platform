import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

/* =========================================================================
   Guard: no entry screen renders text that didn't come from translations.

   t() is replaced with one that wraps every string as ⟦key⟧. After a screen
   renders, every visible text node must be either such a marker or data the
   test itself supplied (a name, an email, a workspace) — anything else is a
   hard-coded string, or an API message shown raw, and fails here. Aria labels
   and titles are checked the same way.
   ========================================================================= */

const marker = (key) => `⟦${key}⟧`;

vi.mock("../i18n/useLanguage", () => ({
  useLanguage: () => ({ t: marker, lang: "en", dir: "ltr", setLang: () => {}, toggleLang: () => {} }),
}));
vi.mock("../theme/useTheme", () => ({ useTheme: () => ({ mode: "light", toggleMode: () => {}, setMode: () => {} }) }));

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock("../auth/authContext", () => ({ useAuth: () => auth.value }));

const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
const SERVER_ENGLISH = "Raw server message that must never be shown.";

vi.mock("../api/client", async (importOriginal) => {
  const failing = () => Promise.reject(Object.assign(new Error(SERVER_ENGLISH), { status: 404 }));
  return {
    ...(await importOriginal()),
    getCommercialPlans: vi.fn(async () => []),
    getSignupStatus: vi.fn(async () => ({ fullName: "Sara Ahmed", email: "sara@example.com", status: "UnderReview", headline: SERVER_ENGLISH, detail: SERVER_ENGLISH, submittedAt: "2026-09-28T10:00:00Z" })),
    getJoinRequestStatus: vi.fn(async () => ({ fullName: "Omar Hassan", email: "omar@example.com", status: "Submitted", headline: SERVER_ENGLISH, detail: SERVER_ENGLISH, submittedAt: "2026-09-28T10:00:00Z" })),
    previewInvitation: vi.fn(async () => ({ workspaceName: "Al Noor Academy", intendedRole: "Teacher", email: "sara@example.com", expiresAt: future, accountExists: false })),
    previewJoin: vi.fn(async () => ({ workspaceName: "Al Noor Academy", description: "Math for grade 8", acceptingRequests: true })),
    previewPasswordReset: vi.fn(async () => ({ email: "sara@example.com", expiresAt: future })),
    failing,
  };
});

import * as api from "../api/client";
import { formatDate } from "../i18n/format";
import LandingScreen from "./LandingScreen.jsx";
import LoginScreen from "./LoginScreen.jsx";
import AdminLogin from "./AdminLogin.jsx";
import ApplyScreen from "./ApplyScreen.jsx";
import SignupStatusScreen from "./SignupStatusScreen.jsx";
import ForgotPasswordScreen from "./ForgotPasswordScreen.jsx";
import ResetPasswordScreen from "./ResetPasswordScreen.jsx";
import InviteScreen from "./InviteScreen.jsx";
import JoinScreen from "./JoinScreen.jsx";
import JoinRequestStatusScreen from "./JoinRequestStatusScreen.jsx";
import WorkspacePicker from "./WorkspacePicker.jsx";
import NotFoundScreen from "./NotFoundScreen.jsx";

// Data the test supplied, which is allowed on screen untranslated. LANGUAGES' native names are
// data too (the switcher always offers each language in its own name).
// Dev-only demo credentials (shown under import.meta.env.DEV) and formatted dates are data too.
const DATA = ["Sara Ahmed", "Omar Hassan", "sara@example.com", "omar@example.com", "Al Noor Academy", "Math for grade 8",
  "Bright Minds", "English", "العربية", "tutor@platform.com", "learner@platform.com", "admin@platform.com", "Test1234",
  formatDate("en", "2026-09-28T10:00:00Z")];

function untranslated(container) {
  const leftovers = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("style, script")) continue;
    let rest = node.textContent;
    rest = rest.replace(/⟦[\w.]+⟧/g, " ");
    for (const d of DATA) rest = rest.split(d).join(" ");
    rest = rest.replace(/[\s\d.,:;·•…()\-–—/!?%+*⁨⁩]/g, ""); // punctuation, digits, the required-field *
    if (rest && !/^[A-Z]$/.test(rest)) leftovers.push(node.textContent.trim()); // a single letter is a workspace's initial
  }
  for (const el of container.querySelectorAll("[aria-label], [title], [placeholder], [alt]")) {
    for (const attr of ["aria-label", "title", "placeholder", "alt"]) {
      const v = el.getAttribute(attr);
      if (v && !/^⟦[\w.]+⟧$/.test(v) && !DATA.includes(v)) leftovers.push(`${attr}="${v}"`);
    }
  }
  return leftovers;
}

const noop = () => {};
const baseAuth = { signIn: noop, signOut: noop, adoptSession: noop, selectWorkspace: noop, sessionExpired: false };

const CASES = [
  ["Landing", () => <LandingScreen onBecomeTutor={noop} onSignIn={noop} />],
  ["Login", () => <LoginScreen side="teach" onBack={noop} onForgotPassword={noop} />],
  ["Login after session expired", () => <LoginScreen side="learn" onBack={noop} onForgotPassword={noop} />, { sessionExpired: true }],
  ["Admin sign in", () => <AdminLogin onBack={noop} />],
  ["Apply", () => <ApplyScreen onBack={noop} onSignIn={noop} onStatus={noop} />],
  ["Application status", () => <SignupStatusScreen token="t" />, {}, "signupStatus.underReviewTitle"],
  ["Forgot password", () => <ForgotPasswordScreen onBack={noop} />],
  ["Reset password", () => <ResetPasswordScreen token="t" onDone={noop} />, {}, "resetPassword.title"],
  ["Invitation", () => <InviteScreen token="t" onAccepted={noop} />, {}, "invite.joinTitle"],
  ["Join", () => <JoinScreen slug="al-noor" onSignIn={noop} />, {}, "join.eyebrow"],
  ["Join request status", () => <JoinRequestStatusScreen token="t" />, {}, "joinStatus.submittedTitle"],
  ["Workspace picker", () => <WorkspacePicker side="teach" onSwitchSide={noop} />, {
    me: { email: "sara@example.com" },
    workspaces: [
      { workspaceId: "1", name: "Al Noor Academy", slug: "a", membershipStatus: "Active", roles: ["Owner"] },
      { workspaceId: "2", name: "Bright Minds", slug: "b", membershipStatus: "Suspended", roles: ["Teacher"] },
    ],
  }, "picker.title"],
  ["Not found", () => <NotFoundScreen onHome={noop} />],
];

// jsdom has no matchMedia; the landing page asks for prefers-reduced-motion.
window.matchMedia ??= () => ({ matches: true, addEventListener() {}, removeEventListener() {} });

describe("entry screens render only translated text", () => {
  afterEach(() => { cleanup(); auth.value = {}; });

  for (const [name, renderScreen, authExtra = {}, readyKey] of CASES) {
    it(name, async () => {
      auth.value = { ...baseAuth, ...authExtra };
      const { container } = render(renderScreen());
      if (readyKey) await waitFor(() => expect(container.textContent).toContain(marker(readyKey)));
      expect(untranslated(container)).toEqual([]);
    });
  }

  it("an API failure is shown as a translated message, never the server's text", async () => {
    api.getSignupStatus.mockImplementationOnce(api.failing);
    const { container } = render(<SignupStatusScreen token="bad" />);
    await waitFor(() => expect(container.textContent).toContain(marker("signupStatus.invalidTitle")));
    expect(container.textContent).not.toContain(SERVER_ENGLISH);
    expect(container.textContent).toContain(marker("signupStatus.invalidBody"));
  });
});
