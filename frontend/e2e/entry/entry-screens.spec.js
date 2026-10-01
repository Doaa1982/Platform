import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { AXE_TAGS, leftoverLatin } from "../lib/audit.mjs";
import fs from "node:fs";
import path from "node:path";
import { SCREENS, SESSION_KEY } from "./screens.js";

/* =========================================================================
   Entry-screen audit: every screen in screens.js × EN/AR × light/dark.

   For each:
     · axe (WCAG 2 A + AA, including color contrast) must find nothing;
     · in Arabic, no English may remain on screen apart from the user data the
       fixtures supplied and the brand name — this is the check that catches a
       hard-coded string or an untranslated API message (the original bug);
     · the page root carries the right lang/dir;
     · desktop and mobile screenshots are written for the PR.
   ========================================================================= */

const SHOTS = path.resolve(import.meta.dirname, "../.output/entry-shots");
const DEVICES = { desktop: { width: 1280, height: 860 }, mobile: { width: 390, height: 844 } };

// Latin data on an Arabic entry page, beyond what the shared check always allows: the fixtures'
// own workspace names/descriptions, and a workspace's initial on its card.
const DATA = [
  "Al Noor Academy", "Bright Minds Tutoring", "Science Club", "Old Academy", "Omar Hassan",
  "Math and Arabic for grades 7 to 9, taught live and recorded.", "QR",
  /\/apply\/status\/\S+/g,
  /[A-Z]{1,3}\b/g,
];

async function installApi(page, screen, unexpected) {
  const stubs = { "PUT /api/me/language": { status: 204 }, ...screen.api };
  await page.route("**/api/**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const key = Object.keys(stubs).find((k) => {
      const [method, prefix] = k.split(" ");
      return method === req.method() && url.pathname.startsWith(prefix);
    });
    if (!key) {
      unexpected.push(`${req.method()} ${url.pathname}`);
      return route.fulfill({ status: 404, json: { message: "unstubbed" } });
    }
    const { status = 200, json } = stubs[key];
    return route.fulfill(status === 204 ? { status } : { status, json });
  });
}

async function open(page, screen, lang, theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript(({ lang, theme, session, key }) => {
    localStorage.setItem("platform.lang", lang);
    localStorage.setItem("platform.theme", theme);
    if (session) localStorage.setItem(key, JSON.stringify(session));
  }, { lang, theme, session: screen.session ?? null, key: SESSION_KEY });
  await page.goto(screen.route);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.querySelector('[role="status"] .lw-entry__spin'));
  if (screen.act) await screen.act(page);
}


for (const screen of SCREENS) {
  for (const lang of ["en", "ar"]) {
    for (const theme of ["light", "dark"]) {
      test(`${screen.id} · ${lang} · ${theme}`, async ({ page }) => {
        const unexpected = [];
        await installApi(page, screen, unexpected);
        await page.setViewportSize(DEVICES.desktop);
        await open(page, screen, lang, theme);

        expect(unexpected, "the screen called an endpoint this audit doesn't stub").toEqual([]);

        const root = page.locator(".lw-entry").first();
        await expect(root).toHaveAttribute("lang", lang);
        await expect(root).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");

        const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        const violations = axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
        expect(violations, "axe found accessibility/contrast problems").toEqual([]);

        if (lang === "ar") {
          const text = await page.locator("body").innerText();
          expect(leftoverLatin(text, DATA), "English text left on an Arabic screen").toEqual([]);
        }

        const dir = path.join(SHOTS, screen.id);
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${lang}-${theme}-desktop.png`), fullPage: true });
        await page.setViewportSize(DEVICES.mobile);
        await page.waitForTimeout(400); // let layout settle at the new width before the mobile shot
        await page.screenshot({ path: path.join(dir, `${lang}-${theme}-mobile.png`), fullPage: true });
      });
    }
  }
}
