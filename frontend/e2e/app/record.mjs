/* =========================================================================
   Re-records the in-app audit's API fixtures:  npm run audit:record

   Starts a throwaway stack (stack.mjs), seeds a realistic Arabic academy
   through the real API (seed.mjs), walks every screen in screens.js as each
   role in both languages while Playwright records the API traffic, and writes:

     e2e/app/fixtures/{owner,learner,admin}.har   replayed by app-screens.spec.js
     e2e/app/fixtures/meta.json                   recording time + session shells
     e2e/entry/fixtures/catalog-plans.json        the real plan catalog, for the
                                                  landing page's plan cards

   The audit itself then needs no backend (CI replays these files). Re-run this
   after an API change that alters what a screen requests. Recordings are
   scrubbed of auth headers and tokens; every account and value in them is
   throwaway seed data.
   ========================================================================= */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { startStack, ADMIN } from "./stack.mjs";
import { seedAcademy } from "./seed.mjs";
import { APP_SCREENS, ROLE_ENTRY, walk, TIPS_KEY, DISMISSED_TIPS } from "./screens.js";

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const ENTRY_FIXTURES = path.join(import.meta.dirname, "../entry/fixtures");
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

function scrub(harPath) {
  const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
  for (const entry of har.log.entries) {
    entry.request.headers = entry.request.headers.filter((h) => !/^(authorization|cookie)$/i.test(h.name));
    entry.response.headers = entry.response.headers.filter((h) => !/^set-cookie$/i.test(h.name));
    if (entry.response.content?.text) entry.response.content.text = entry.response.content.text.replace(JWT, "redacted");
    if (entry.request.postData?.text) entry.request.postData.text = entry.request.postData.text.replace(JWT, "redacted");
  }
  fs.writeFileSync(harPath, JSON.stringify(har, null, 1));
}

const stack = await startStack();
let exitCode = 1;
try {
  console.log("seeding");
  const seeded = await seedAcademy({ apiBase: stack.apiBase, admin: ADMIN });
  const recordedAt = new Date().toISOString();
  fs.mkdirSync(FIXTURES, { recursive: true });
  fs.mkdirSync(ENTRY_FIXTURES, { recursive: true });

  const browser = await chromium.launch();
  for (const role of ["owner", "learner", "admin"]) {
    console.log(`recording ${role}`);
    const harPath = path.join(FIXTURES, `${role}.har`);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      recordHar: { path: harPath, urlFilter: "**/api/**", content: "embed", mode: "minimal" },
    });
    for (const lang of ["en", "ar"]) {
      for (const screen of APP_SCREENS.filter((s) => s.role === role)) {
        const page = await context.newPage();
        await page.addInitScript(([session, lang, key, tips]) => {
          localStorage.setItem("platform.session", session);
          localStorage.setItem("platform.lang", lang);
          localStorage.setItem(key, tips);
        }, [JSON.stringify(seeded.sessions[role]), lang, TIPS_KEY, JSON.stringify(DISMISSED_TIPS)]);
        await page.goto(stack.webBase + ROLE_ENTRY[role]);
        await page.waitForLoadState("networkidle");
        await walk(page, screen);
        await page.close();
      }
    }
    await context.close();
    scrub(harPath);
  }
  await browser.close();

  const sessions = Object.fromEntries(Object.entries(seeded.sessions).map(([role, s]) =>
    [role, { token: "audit-replay", expiresAt: s.expiresAt, fullName: s.fullName }]));
  fs.writeFileSync(path.join(FIXTURES, "meta.json"), JSON.stringify({ recordedAt, sessions }, null, 2));

  const plans = await (await fetch(`${stack.apiBase}/api/catalog/plans`)).json();
  fs.writeFileSync(path.join(ENTRY_FIXTURES, "catalog-plans.json"), JSON.stringify(plans, null, 2));

  console.log("recorded");
  exitCode = 0;
} catch (error) {
  console.error(`FAILED: ${error.message}`);
} finally {
  await stack.stop();
  process.exit(exitCode);
}
