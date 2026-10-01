import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AXE_TAGS, leftoverLatin } from "../lib/audit.mjs";
import { APP_SCREENS, ROLE_ENTRY, SLUG, walk, TIPS_KEY, DISMISSED_TIPS } from "./screens.js";

/* =========================================================================
   In-app audit: every screen in screens.js (owner, learner, admin) × EN/AR ×
   light/dark, replaying API traffic recorded from a real seeded backend
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

for (const screen of APP_SCREENS) {
  for (const lang of ["en", "ar"]) {
    for (const theme of ["light", "dark"]) {
      test(`${screen.id} · ${lang} · ${theme}`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 860 }, colorScheme: theme, reducedMotion: "reduce" });
        const unexpected = [];
        await replay(context, screen.role, unexpected, baseURL);
        const page = await context.newPage();
        await page.clock.setFixedTime(new Date(META.recordedAt));
        await page.addInitScript(([session, lang, theme, key, tips]) => {
          try { // also runs in the email previews' sandboxed iframe, where storage is off-limits
            localStorage.setItem("platform.session", session);
            localStorage.setItem("platform.lang", lang);
            localStorage.setItem("platform.theme", theme);
            localStorage.setItem(key, tips);
          } catch { /* sandboxed frame */ }
        }, [JSON.stringify(META.sessions[screen.role]), lang, theme, TIPS_KEY, JSON.stringify(DISMISSED_TIPS)]);

        await page.goto(ROLE_ENTRY[screen.role]);
        await page.waitForLoadState("networkidle");
        await walk(page, screen);

        expect(unexpected, "the screen requested something the recording doesn't have — re-run npm run audit:record").toEqual([]);

        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");

        // The email previews render whole emails in a sandboxed iframe; those are audited by the
        // backend's own email tests, not here.
        const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).exclude("iframe").analyze();
        const violations = axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
        expect(violations, "axe found accessibility/contrast problems").toEqual([]);

        if (lang === "ar") {
          const text = await page.locator("body").innerText();
          expect(leftoverLatin(text, ALLOWED[screen.id] ?? ALLOWED.default), "English text left on an Arabic screen").toEqual([]);
        }

        const dir = path.join(SHOTS, screen.id);
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${lang}-${theme}-desktop.png`), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(400); // let layout settle at the new width before the mobile shot
        await page.screenshot({ path: path.join(dir, `${lang}-${theme}-mobile.png`), fullPage: true });
        await context.close();
      });
    }
  }
}
