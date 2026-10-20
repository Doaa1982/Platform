/* =========================================================================
   Marketing analytics — Google Analytics 4.

   Off unless VITE_GA_MEASUREMENT_ID is set at build time (the deploy
   workflow passes the GA_MEASUREMENT_ID repository variable). Local dev,
   tests and the screen audit build without it, so nothing loads there.

   What is sent, and what never is:
   - Page views, with every secret token in the path replaced by ":token"
     (invitation, password reset, signup and join-request status links are
     bearer credentials — they must never reach a third party).
   - Only utm_* parameters survive from the query string, so campaign
     attribution works and nothing else in a URL leaks.
   - A few named funnel events. No names, emails, or free text: event
     parameters are fixed labels and workspace slugs only.

   Every call is wrapped so analytics can never break the app.
   ========================================================================= */

const ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

// Paths whose last segment is a bearer token (see AppRoot's route list).
const TOKEN_ROUTES = [
  /^(\/invite\/)[^/]+/,
  /^(\/apply\/status\/)[^/]+/,
  /^(\/join-requests\/status\/)[^/]+/,
  /^(\/reset-password\/)[^/]+/,
];

/** The path as analytics may see it: token segments replaced, trailing slash dropped. */
export function redactPath(pathname) {
  let path = pathname || "/";
  for (const re of TOKEN_ROUTES) path = path.replace(re, "$1:token");
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** Keep only utm_* parameters from a query string ("" when there are none). */
export function campaignQuery(search) {
  const kept = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(search || "")) {
    if (k.toLowerCase().startsWith("utm_")) kept.append(k, v);
  }
  const q = kept.toString();
  return q ? `?${q}` : "";
}

export function isEnabled() {
  return typeof window !== "undefined" && typeof ID === "string" && /^G-[A-Z0-9]+$/.test(ID);
}

let started = false;

/** Load gtag.js once. Page views are sent by trackPageView, not automatically. */
export function initAnalytics() {
  if (started || !isEnabled()) return;
  started = true;
  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    // send_page_view off: the SPA reports its own (redacted) page views.
    window.gtag("config", ID, { send_page_view: false });
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;
    document.head.appendChild(s);
  } catch { /* analytics must never break the app */ }
}

function send(name, params) {
  if (!isEnabled() || typeof window.gtag !== "function") return;
  try { window.gtag("event", name, params); } catch { /* ignore */ }
}

/** One page view for the current location, redacted. */
export function trackPageView(pathname = window.location.pathname, search = window.location.search) {
  const path = redactPath(pathname);
  send("page_view", {
    page_path: path,
    page_location: `${window.location.origin}${path}${campaignQuery(search)}`,
    page_title: document.title,
  });
}

/* ── Funnel events ────────────────────────────────────────────────────────
   Names match GA4's recommended events where one exists (sign_up), so they
   can be marked as key events in GA without custom setup. */

/** A "Become a tutor" button was clicked; `where` is "hero" or "plans". */
export function trackTutorCta(where) {
  send("cta_click", { cta: "become_tutor", location: where });
}

/** A tutor application was submitted successfully. */
export function trackSignUp() {
  send("sign_up", { method: "tutor_application" });
}

/** A lesson went live. The first one per workspace (in this browser) also sends first_lesson_published. */
export function trackLessonPublished(workspaceSlug) {
  send("lesson_published", { workspace: workspaceSlug || "" });
  if (!workspaceSlug) return;
  const key = `tt.firstLessonPublished.${workspaceSlug}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch { /* storage blocked — still send; GA counts unique workspaces anyway */ }
  send("first_lesson_published", { workspace: workspaceSlug });
}
