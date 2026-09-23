import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaybackController } from "./playbackRefresh.js";
import { installMediaStub } from "../test/mediaStub.js";

const HOUR = 60 * 60_000;

function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** A controller wired to a stubbed element, a scripted fetch and spies for everything it can tell its caller. */
async function setup({ lifetimeMs = HOUR, playRejects = false, fetchAccess } = {}) {
  const video = document.createElement("video");
  const stub = installMediaStub(video, { playRejects });
  let n = 0;
  const grant = () => ({ url: `/media/v${++n}`, expiresAt: new Date(Date.now() + lifetimeMs).toISOString() });
  const fetch = vi.fn(fetchAccess ?? (async () => grant()));
  const calls = { swap: [], denied: vi.fn(), playBlocked: vi.fn(), fatal: vi.fn() };
  const controller = createPlaybackController({
    media: video,
    fetchAccess: fetch,
    onSwapStateChange: (v) => calls.swap.push(v),
    onDenied: calls.denied,
    onPlayBlocked: calls.playBlocked,
    onFatalError: calls.fatal,
  });
  await controller.start();
  await vi.advanceTimersByTimeAsync(0);
  return { video, stub, controller, fetch, calls, grant };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

describe("playback refresh", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("a PAUSED refresh at about 123 s stays paused, never calls play(), and lands within 0.5 s", async () => {
    const t = await setup();
    t.stub.pausedAt(123);
    const before = t.stub.state.eventLog.length;

    await vi.advanceTimersByTimeAsync(HOUR - 5 * 60_000); // five minutes before expiry: due, and paused means now
    expect(t.fetch).toHaveBeenCalledTimes(2);
    expect(t.controller.swapping).toBe(true);
    expect(t.controller.getPosition()).toBeCloseTo(123, 0); // the saved position, throughout

    t.stub.loadMetadata();
    await settle();

    expect(t.controller.swapping).toBe(false);
    expect(t.video.paused).toBe(true);
    expect(t.stub.state.playCalls).toBe(0);
    expect(Math.abs(t.video.currentTime - 123)).toBeLessThan(0.5);
    // Nothing that fired during the whole refresh saw the position near 0.
    const seen = t.stub.state.eventLog.slice(before).map((e) => e.currentTime);
    expect(seen.length).toBeGreaterThan(0);
    expect(Math.min(...seen)).toBeGreaterThan(122.5);
  });

  it("a PLAYING refresh resumes, and keeps the rate, volume and muted state a new source would reset", async () => {
    const t = await setup();
    t.stub.playFrom(200, { rate: 1.5, volume: 0.6, muted: true });

    await vi.advanceTimersByTimeAsync(HOUR - 60_000); // the forced point: a minute left
    expect(t.fetch).toHaveBeenCalledTimes(2);
    expect(t.stub.state.playbackRate).toBe(1); // the new source really did reset it

    t.stub.loadMetadata();
    await settle();

    expect(t.stub.state.playCalls).toBe(1);
    expect(t.video.paused).toBe(false);
    expect(t.video.playbackRate).toBe(1.5);
    expect(t.video.volume).toBe(0.6);
    expect(t.video.muted).toBe(true);
    expect(Math.abs(t.video.currentTime - 200)).toBeLessThan(0.5);
  });

  it("puts the settings back in order once the new source's metadata has arrived: rate, then volume, then muted, then play", async () => {
    const t = await setup();
    t.stub.playFrom(200, { rate: 1.25, volume: 0.4, muted: true });
    await vi.advanceTimersByTimeAsync(HOUR - 60_000);
    const mark = t.stub.state.writes.length;

    t.stub.loadMetadata();
    await settle();

    const afterMetadata = t.stub.state.writes.slice(mark).map((w) => w.prop);
    expect(afterMetadata[0]).toBe("loadedmetadata");
    expect(afterMetadata.filter((p) => ["playbackRate", "volume", "muted", "play"].includes(p)))
      .toEqual(["playbackRate", "volume", "muted", "play"]);
    expect(t.stub.state.writes.filter((w) => w.prop === "volume").at(-1).value).toBe(0.4);
    expect(t.stub.state.writes.filter((w) => w.prop === "muted").at(-1).value).toBe(true);
  });

  it("a playing video is not interrupted at the five-minute mark; it renews at the next pause", async () => {
    const t = await setup();
    t.stub.playFrom(50);

    await vi.advanceTimersByTimeAsync(HOUR - 5 * 60_000); // due, but playing
    expect(t.fetch).toHaveBeenCalledTimes(1);

    t.video.pause();
    await settle();
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it("a playing video renews at the next seek, and the seek target is where it lands", async () => {
    const t = await setup();
    t.stub.playFrom(50);
    await vi.advanceTimersByTimeAsync(HOUR - 5 * 60_000);
    expect(t.fetch).toHaveBeenCalledTimes(1);

    t.stub.userSeek(300);
    await settle();
    expect(t.fetch).toHaveBeenCalledTimes(2);

    t.stub.loadMetadata();
    await settle();
    expect(Math.abs(t.video.currentTime - 300)).toBeLessThan(0.5);
  });

  it("is forced at a minute or less remaining even if the learner never pauses or seeks", async () => {
    const t = await setup();
    t.stub.playFrom(10);

    await vi.advanceTimersByTimeAsync(HOUR - 60_001);
    expect(t.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it("a seek while the refresh request is in flight wins over the saved position", async () => {
    const second = deferred();
    let call = 0;
    const t = await setup({ fetchAccess: async () => (++call === 1
      ? { url: "/media/v1", expiresAt: new Date(Date.now() + HOUR).toISOString() }
      : second.promise) });
    t.stub.playFrom(123);
    await vi.advanceTimersByTimeAsync(HOUR - 60_000); // forced: the request is now in flight
    expect(t.fetch).toHaveBeenCalledTimes(2);

    t.stub.userSeek(500); // the learner scrubs while we wait for the new URL
    second.resolve({ url: "/media/v2", expiresAt: new Date(Date.now() + HOUR).toISOString() });
    await settle();
    t.stub.loadMetadata();
    await settle();

    expect(Math.abs(t.video.currentTime - 500)).toBeLessThan(0.5);
  });

  it("a seek while the new source is loading also wins", async () => {
    const t = await setup();
    t.stub.playFrom(123);
    await vi.advanceTimersByTimeAsync(HOUR - 60_000);
    expect(t.controller.swapping).toBe(true);

    t.stub.userSeek(800); // no metadata yet, so this only sets the start position
    t.stub.loadMetadata();
    await settle();

    expect(Math.abs(t.video.currentTime - 800)).toBeLessThan(0.5);
  });

  it("concurrent triggers make one request", async () => {
    const t = await setup();
    t.stub.pausedAt(90);
    vi.setSystemTime(Date.now() + HOUR - 5_000); // expiry is imminent, so an error or a stall would each ask for a refresh

    const first = t.controller.refresh();
    const others = [t.controller.refresh(), t.controller.refresh()];
    t.controller.handleMediaError();
    t.video.dispatchEvent(new Event("stalled"));
    await settle();
    expect(others.every((p) => p === first)).toBe(true); // a second caller is handed the first caller's promise

    t.stub.loadMetadata(); // the one swap completes; every caller is released together
    const results = await Promise.all([first, ...others]);
    await settle();

    expect(results).toHaveLength(3);
    expect(t.fetch).toHaveBeenCalledTimes(2); // the first load, and exactly one refresh
  });

  it("a refused refresh keeps the position, says so once, stops trying and never restarts the video", async () => {
    let call = 0;
    const t = await setup({ fetchAccess: async () => {
      if (++call === 1) return { url: "/media/v1", expiresAt: new Date(Date.now() + HOUR).toISOString() };
      throw Object.assign(new Error("no access"), { status: 403 });
    } });
    t.stub.pausedAt(123);

    await vi.advanceTimersByTimeAsync(HOUR - 5 * 60_000);
    await settle();

    expect(t.calls.denied).toHaveBeenCalledTimes(1);
    expect(t.stub.state.srcAssignments).toHaveLength(1); // the source was never touched
    expect(t.video.currentTime).toBe(123);               // and the position is exactly where it was
    expect(t.controller.denied).toBe(true);
    expect(t.calls.swap).toEqual([]);                     // no swap, so nothing was ever gated

    await vi.advanceTimersByTimeAsync(3 * HOUR);          // it does not keep asking
    expect(t.fetch).toHaveBeenCalledTimes(2);
    expect(t.calls.denied).toHaveBeenCalledTimes(1);
  });

  it("a refused initial request is reported as access ended, not as a broken video", async () => {
    const t = await setup({ fetchAccess: async () => { throw Object.assign(new Error("gone"), { status: 404 }); } });

    expect(t.calls.denied).toHaveBeenCalledTimes(1);
    expect(t.calls.fatal).not.toHaveBeenCalled();
  });

  it("a play() the browser refuses shows a play control instead of failing", async () => {
    const t = await setup({ playRejects: true });
    t.stub.playFrom(60);
    await vi.advanceTimersByTimeAsync(HOUR - 60_000);

    t.stub.loadMetadata();
    await settle();

    expect(t.stub.state.playCalls).toBe(1);
    expect(t.calls.playBlocked).toHaveBeenCalledTimes(1);
    expect(Math.abs(t.video.currentTime - 60)).toBeLessThan(0.5);
  });

  it("the swap gate closes once the position has settled, and only then", async () => {
    const t = await setup();
    t.stub.pausedAt(70);
    await vi.advanceTimersByTimeAsync(HOUR - 5 * 60_000);
    expect(t.calls.swap).toEqual([true]);

    t.stub.loadMetadata();
    await settle();

    expect(t.calls.swap).toEqual([true, false]);
  });

  // ── a stalled connection ─────────────────────────────────────────────

  it("a first source that never delivers metadata is replaced with a fresh one, and playback then proceeds", async () => {
    const t = await setup();
    expect(t.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(19_000);
    expect(t.fetch).toHaveBeenCalledTimes(1);   // not hasty
    await vi.advanceTimersByTimeAsync(1_500);
    expect(t.fetch).toHaveBeenCalledTimes(2);   // a fresh URL after the stall
    expect(t.stub.state.srcAssignments).toEqual(["/media/v1", "/media/v2"]);

    t.stub.loadMetadata();
    await settle();
    expect(t.calls.fatal).not.toHaveBeenCalled();
    expect(t.controller.swapping).toBe(false);
  });

  it("metadata arriving in time cancels the watchdog", async () => {
    const t = await setup();
    await vi.advanceTimersByTimeAsync(5_000);
    t.stub.loadMetadata();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.fetch).toHaveBeenCalledTimes(1);
    expect(t.stub.state.srcAssignments).toEqual(["/media/v1"]);
  });

  it("a source that stalls again and again is reported, not retried forever", async () => {
    const t = await setup();

    await vi.advanceTimersByTimeAsync(20_500);   // first source stalled -> swap to a fresh one
    await vi.advanceTimersByTimeAsync(20_500);   // that stalled too -> quiet retry scheduled
    await vi.advanceTimersByTimeAsync(5_500);    // retry begins
    await vi.advanceTimersByTimeAsync(20_500);   // and stalled -> reported
    await settle();

    expect(t.calls.fatal).toHaveBeenCalledTimes(1);
    expect(t.fetch.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("a stalled swap does not strand the controller waiting for ever", async () => {
    const t = await setup();
    t.stub.pausedAt(70);
    await vi.advanceTimersByTimeAsync(HOUR - 5 * 60_000);
    expect(t.controller.swapping).toBe(true);

    await vi.advanceTimersByTimeAsync(20_500);   // the new source never delivered metadata
    expect(t.controller.swapping).toBe(false);   // released...
    await vi.advanceTimersByTimeAsync(5_500);    // ...and a fresh source requested
    expect(t.fetch).toHaveBeenCalledTimes(3);
    t.stub.loadMetadata();
    await settle();
    expect(Math.abs(t.video.currentTime - 70)).toBeLessThan(0.5);
  });

  // ── reactive renewal ─────────────────────────────────────────────────

  it("renews when an error arrives at or past expiry, and otherwise reports a genuine error", async () => {
    const t = await setup();
    t.stub.pausedAt(40);

    t.stub.state.error = { code: 4 };
    expect(t.controller.handleMediaError()).toBe(false); // a fresh URL and an unsupported-format style error: genuine
    expect(t.fetch).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + HOUR - 5_000); // expiry is suspected now
    expect(t.controller.handleMediaError()).toBe(true);
    await settle();
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it("a network error is treated as a possibly-expired source and renewed", async () => {
    const t = await setup();
    t.stub.pausedAt(40);
    t.stub.state.error = { code: 2 };

    expect(t.controller.handleMediaError()).toBe(true);
    await settle();
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not renew in a loop when errors keep coming", async () => {
    const t = await setup();
    t.stub.pausedAt(40);
    t.stub.state.error = { code: 2 };

    t.controller.handleMediaError();
    await settle();
    t.stub.loadMetadata();
    await settle();
    t.stub.state.error = { code: 2 };
    expect(t.controller.handleMediaError()).toBe(false); // inside the cooldown: report it
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it("a stall near expiry renews the source", async () => {
    const t = await setup();
    t.stub.pausedAt(40);
    vi.setSystemTime(Date.now() + HOUR - 2_000);

    t.video.dispatchEvent(new Event("stalled"));
    await settle();

    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  // ── the schedule itself ──────────────────────────────────────────────

  it("a short-lived URL is renewed at a fraction of its life, not in a tight loop", async () => {
    const t = await setup({ lifetimeMs: 30_000 });
    t.stub.pausedAt(20);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.fetch).toHaveBeenCalledTimes(1);   // not renewed immediately

    await vi.advanceTimersByTimeAsync(5_100);
    expect(t.fetch).toHaveBeenCalledTimes(2);   // renewed at half its life
    t.stub.loadMetadata();
    await settle();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.fetch).toHaveBeenCalledTimes(2);   // and the new URL's schedule restarts from its own issue time
  });

  it("a renewed source that fails to load is retried once, then reported", async () => {
    const t = await setup();
    t.stub.pausedAt(33);
    await vi.advanceTimersByTimeAsync(HOUR - 5 * 60_000);
    expect(t.controller.swapping).toBe(true);

    t.video.dispatchEvent(new Event("error")); // first failure: quietly retried
    await vi.advanceTimersByTimeAsync(5_000);
    expect(t.calls.fatal).not.toHaveBeenCalled();
    expect(t.fetch).toHaveBeenCalledTimes(3);

    t.video.dispatchEvent(new Event("error")); // second failure: now it is reported
    await settle();
    expect(t.calls.fatal).toHaveBeenCalledTimes(1);
  });
});
