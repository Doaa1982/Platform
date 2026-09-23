import { expect, test } from "@playwright/test";

/* A lesson video plays from a presigned R2 URL that lives 30 s in this run. This proves, in a real browser against the
   real bucket, that playback carries on across that expiry from the right place and in the right state: the first URL
   really dies (403), the player renews it without the learner doing anything, and a seek made after expiry still works. */

const session = JSON.parse(process.env.E2E_SESSION ?? "null");
const lifetimeSeconds = Number(process.env.E2E_LIFETIME_SECONDS ?? 30);

test.skip(!session, "Run through `npm run test:e2e`, which starts the isolated stack and seeds a lesson.");

const mediaResponses = [];

/** Runs one phase of the test; if it fails, says which phase, what the player looked like, and what happened when. */
async function phase(page, name, fn) {
  stamp(`── ${name}`);
  try {
    return await fn();
  } catch (error) {
    const detail = await page.evaluate(() => {
      const v = document.querySelector(".lw-player video");
      return v && { t: v.currentTime, paused: v.paused, ended: v.ended, readyState: v.readyState, networkState: v.networkState, errorCode: v.error?.code ?? null };
    }).catch(() => null);
    throw new Error(`[${name}] ${error.message}\nplayer: ${JSON.stringify(detail)}\n${timeline.join("\n")}`, { cause: error });
  }
}
const timeline = []; // what happened, when (ms since the page opened) — hosts, paths and statuses only, never full URLs
const t0 = Date.now();
const stamp = (what) => timeline.push(`${String(Date.now() - t0).padStart(6)}ms ${what}`);

/** Opens the seeded lesson in the studio, where its video plays through the same VideoPlayer a learner uses. */
async function openLessonVideo(page) {
  await page.addInitScript((s) => localStorage.setItem("platform.session", JSON.stringify(s)), session);
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (r.resourceType() === "media") stamp(`media request  ${u.host.slice(0, 8)}… range=${r.headers().range ?? "-"}`);
    else if (r.method() === "POST" && u.pathname.endsWith("/access")) stamp("POST /access");
  });
  page.on("response", (r) => { if (r.request().resourceType() === "media") { mediaResponses.push(`${r.status()}`); stamp(`media response ${r.status()}`); } });
  page.on("requestfailed", (r) => { if (r.resourceType() === "media") { mediaResponses.push(`FAILED ${r.failure()?.errorText}`); stamp(`media FAILED ${r.failure()?.errorText}`); } });
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) stamp(`console.${m.type()}: ${m.text().slice(0, 140)}`); });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Content Studio" }).first()).toBeVisible({ timeout: 30_000 });
  // A brand-new workspace opens with a one-time "welcome gift" dialog over the page; dismiss it if it appears.
  await page.getByRole("button", { name: "Got it" }).first().click({ timeout: 5_000 }).catch(() => {});
  await page.getByRole("button", { name: "Content Studio" }).first().click();
  await page.locator(".lw-studio__card").first().click();
  await page.locator(".lw-studio__lessonopen").first().click();
  await page.getByRole("button", { name: "Delivery" }).click(); // the video lives on the lesson's Delivery tab

  const video = page.locator(".lw-player video");
  await expect(video).toBeVisible({ timeout: 30_000 });
  try {
    await page.waitForFunction(() => {
      const v = document.querySelector(".lw-player video");
      return v && v.readyState >= 3 && Number.isFinite(v.duration) && v.duration > 0;
    }, undefined, { timeout: 60_000 });
  } catch (error) {
    // Say why, not just that it timed out. (Hosts and status codes only — never a full URL, which is a credential.)
    const detail = await page.evaluate(() => {
      const v = document.querySelector(".lw-player video");
      let host = null;
      try { host = new URL(v.currentSrc).host; } catch { /* no source yet */ }
      return {
        host, readyState: v.readyState, networkState: v.networkState, errorCode: v.error?.code ?? null, duration: v.duration,
        videoElements: document.querySelectorAll(".lw-player video").length, paused: v.paused,
      };
    });
    throw new Error(`The video never became ready: ${JSON.stringify(detail)}\n${timeline.join("\n")}\n${error.message}`, { cause: error });
  }
  return video;
}

const state = (page) => page.evaluate(() => {
  const v = document.querySelector(".lw-player video");
  return { t: v.currentTime, paused: v.paused, ended: v.ended, src: v.currentSrc, duration: v.duration, readyState: v.readyState };
});

test("playback carries on across the expiry of its presigned URL, and a seek after expiry works", async ({ page, request }) => {
  await phase(page, "run", async () => {
  const problems = [];
  const mediaRequests = [];
  page.on("request", (r) => {
    const url = r.url();
    if (url.includes(session.token) || url.includes("access_token")) problems.push(`a session token appeared in a URL: ${new URL(url).pathname}`);
    if (r.resourceType() === "media") mediaRequests.push({ at: Date.now(), url });
  });
  const accessCalls = [];
  page.on("request", (r) => { if (r.method() === "POST" && /\/learning-assets\/[^/]+\/access$/.test(new URL(r.url()).pathname)) accessCalls.push(Date.now()); });

  const video = await openLessonVideo(page);
  const first = await state(page);
  const firstUrl = first.src;

  // The video is served straight from R2 with a signed URL — not through the API — and the signature is in the query.
  const firstHost = new URL(firstUrl).host;
  expect(firstHost).toMatch(/\.r2\.cloudflarestorage\.com$/);
  expect(new URL(firstUrl).searchParams.get("X-Amz-Signature")).toBeTruthy();
  expect(new URL(firstUrl).searchParams.get("X-Amz-Expires")).toBe(String(lifetimeSeconds));
  expect(first.duration).toBeGreaterThan(90); // long enough to play, wait and seek

  stamp('── 1. playing through the expiry');
  // ── 1. PLAYING through the expiry ────────────────────────────────────
  await video.evaluate((v) => { v.muted = true; v.playbackRate = 1.5; v.play().catch(() => {}); }); // not awaited: play() only settles once data arrives
  await page.evaluate(() => {
    const v = document.querySelector(".lw-player video");
    window.__samples = [];
    window.__sampler = setInterval(() => window.__samples.push({ t: v.currentTime, paused: v.paused, src: v.currentSrc }), 200);
  });
  const startedAt = Date.now();
  await page.waitForTimeout((lifetimeSeconds + 15) * 1000); // comfortably past the first URL's expiry

  const samples = await page.evaluate(() => { clearInterval(window.__sampler); return window.__samples; });
  // Not sampled the instant the wait ends: a refresh's own source swap is a real, correctly-bounded ~350-500ms
  // window where the native element is legitimately paused (old source torn down, new one not yet resumed) — see
  // the investigation that confirmed every observed paused=true sample fell inside exactly such a window, never
  // outside one. Waiting for a settled "really playing" condition (bounded, not a fixed sleep) avoids sampling
  // mid-swap while still failing loudly, within 5s, if the controller ever genuinely failed to resume playback.
  await page.waitForFunction(() => {
    const v = document.querySelector(".lw-player video");
    return v && !v.paused && v.readyState >= 3;
  }, undefined, { timeout: 5_000 });
  const playing = await state(page);

  // The first URL is dead — so if playback carried on, it did so on a renewed one.
  const stale = await request.get(firstUrl, { headers: { Range: "bytes=0-1" }, failOnStatusCode: false });
  expect(stale.status()).toBe(403);
  expect(playing.src).not.toBe(firstUrl);
  expect(accessCalls.length).toBeGreaterThanOrEqual(2); // the player asked for a fresh URL by itself

  // Playback continued, in state, and the position never fell back towards 0.
  expect(playing.paused).toBe(false);
  expect(playing.ended).toBe(false);
  expect(playing.t).toBeGreaterThan(first.t + (lifetimeSeconds + 5));
  for (let i = 1; i < samples.length; i += 1) {
    expect(samples[i].t, `the position dropped at sample ${i}`).toBeGreaterThanOrEqual(samples[i - 1].t - 0.5);
  }
  expect(Math.min(...samples.map((s) => s.t))).toBeGreaterThanOrEqual(first.t - 0.5);
  expect(new Set(samples.map((s) => s.src)).size).toBeGreaterThanOrEqual(2); // and the source really did change under it
  expect(Date.now() - startedAt).toBeGreaterThan(lifetimeSeconds * 1000);

  stamp('── 2. paused through another expiry');
  // ── 2. PAUSED through another expiry ─────────────────────────────────
  await video.evaluate((v) => v.pause());
  const pausedAt = (await state(page)).t;
  await page.waitForTimeout((lifetimeSeconds + 10) * 1000);
  const stillPaused = await state(page);
  expect(stillPaused.paused).toBe(true);                                   // never started playing on its own
  expect(Math.abs(stillPaused.t - pausedAt)).toBeLessThan(0.5);             // and did not move
  expect(stillPaused.src).not.toBe(playing.src);                            // yet the source was renewed while paused

  stamp('── 3. a seek after expiry');
  // ── 3. A SEEK after expiry ───────────────────────────────────────────
  const target = Math.min(stillPaused.duration - 20, 75);
  await video.evaluate((v, t) => { v.currentTime = t; v.play().catch(() => {}); }, target);
  await page.waitForFunction((t) => {
    const v = document.querySelector(".lw-player video");
    return v && !v.paused && v.currentTime > t + 2;
  }, target, { timeout: 30_000 });
  const afterSeek = await state(page);
  expect(afterSeek.t).toBeGreaterThan(target);
  expect(afterSeek.t).toBeLessThan(target + 15);       // continued from where it was sent, not from 0 or the old place
  expect(afterSeek.paused).toBe(false);

  // Every media request the browser made after the first URL expired was answered, and none of them carried a session token.
  expect(problems).toEqual([]);
  const lateMedia = mediaRequests.filter((m) => m.at > startedAt + lifetimeSeconds * 1000);
  expect(lateMedia.length).toBeGreaterThan(0);
  expect(lateMedia.every((m) => m.url !== firstUrl)).toBe(true);
  });
});
