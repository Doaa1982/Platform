import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { installMediaStub } from "../test/mediaStub.js";

vi.mock("../i18n/useLanguage", () => ({ useLanguage: () => ({ t: (key) => key }) }));
vi.mock("../api/client", () => ({ requestLearningAssetAccess: vi.fn() }));

import * as api from "../api/client";
import VideoPlayer from "./VideoPlayer.jsx";

const HOUR = 60 * 60_000;
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

/** Renders the player in asset mode, installs the stub before the first (async) load, and returns everything a test needs. */
async function mount({ lifetimeMs = HOUR, playRejects = false, respond, reportsZeroUntilMetadata = false } = {}) {
  let n = 0;
  api.requestLearningAssetAccess.mockImplementation(respond ?? (async () => ({
    url: `/media/v${++n}`, expiresAt: new Date(Date.now() + lifetimeMs).toISOString(), kind: "presigned",
  })));

  const ref = createRef();
  const spies = { onTimeUpdate: vi.fn(), onEnded: vi.fn(), onError: vi.fn(), onDurationChange: vi.fn() };
  const view = render(<VideoPlayer ref={ref} assetAccess={{ token: "T", slug: "ws", assetId: "A" }} {...spies} />);
  const video = view.container.querySelector("video");
  const stub = installMediaStub(video, { playRejects, reportsZeroUntilMetadata }); // before the effect's first fetch settles
  await settle();
  return { ref, view, video, stub, spies };
}

/** Everything the player reported since the last call to this, then forgotten. */
const reportedSince = (spies) => {
  const out = Object.fromEntries(Object.entries(spies).map(([k, v]) => [k, v.mock.calls.slice()]));
  Object.values(spies).forEach((s) => s.mockClear());
  return out;
};

describe("VideoPlayer with an uploaded asset", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("gets its first source from the API, and reports the duration once the metadata arrives", async () => {
    const { stub, spies } = await mount();

    expect(stub.state.src).toBe("/media/v1");
    expect(api.requestLearningAssetAccess).toHaveBeenCalledWith("T", "ws", "A");

    stub.loadMetadata();
    expect(spies.onDurationChange).toHaveBeenCalledWith(600);
  });

  it("swaps a new source into the SAME element, and forwards no event, no error and no position near 0 while it does", async () => {
    const { ref, view, video, stub, spies } = await mount();
    stub.loadMetadata();
    stub.playFrom(200, { rate: 1.5, volume: 0.6, muted: true });
    reportedSince(spies); // forget the first load

    await advance(HOUR - 60_000); // the source is a minute from expiry: the player renews it
    expect(stub.state.srcAssignments).toEqual(["/media/v1", "/media/v2"]);
    expect(view.container.querySelectorAll("video")).toHaveLength(1);
    expect(view.container.querySelector("video")).toBe(video); // one element throughout — no double-buffering

    // Everything the element emits as it lets go of the old source and starts the new one...
    fireEvent(video, new Event("timeupdate"));
    fireEvent(video, new Event("ended"));
    fireEvent(video, new Event("emptied"));
    await settle();
    // ...reaches nobody.
    const during = reportedSince(spies);
    expect(during.onTimeUpdate).toEqual([]);
    expect(during.onEnded).toEqual([]);
    expect(during.onError).toEqual([]);
    expect(during.onDurationChange).toEqual([]);
    expect(ref.current.getCurrentTime()).toBeGreaterThan(199.5); // and the imperative API never says "0"

    stub.loadMetadata();
    await settle();

    // Playback is back at the same place, with the same settings; events flow again and none of them was near 0.
    expect(video.paused).toBe(false);
    expect(Math.abs(video.currentTime - 200)).toBeLessThan(0.5);
    expect([video.playbackRate, video.volume, video.muted]).toEqual([1.5, 0.6, true]);
    fireEvent(video, new Event("timeupdate"));
    const after = reportedSince(spies);
    expect(after.onTimeUpdate.length).toBeGreaterThan(0);
    expect(Math.min(...after.onTimeUpdate.map(([t]) => t))).toBeGreaterThan(199.5);
    expect(after.onEnded).toEqual([]);   // a refresh is never an "ended" or a "watched"
    expect(after.onError).toEqual([]);
  });

  it("an error while the NEW source is loading is not forwarded: it is retried once, and only reported if it repeats", async () => {
    const { video, stub, spies } = await mount();
    stub.loadMetadata();
    stub.pausedAt(90);
    reportedSince(spies);

    await advance(HOUR - 5 * 60_000);
    fireEvent(video, new Event("error")); // the renewed source failed to load
    await settle();
    expect(spies.onError).not.toHaveBeenCalled();
    expect(screen.queryByText("videoPlayer.unavailable")).toBeNull();

    await advance(5_000); // quietly asks for another source...
    expect(api.requestLearningAssetAccess).toHaveBeenCalledTimes(3);
    fireEvent(video, new Event("error")); // ...which fails as well
    await settle();

    expect(spies.onError).toHaveBeenCalledTimes(1);
    expect(screen.getByText("videoPlayer.unavailable")).toBeTruthy();
  });

  it("even on a browser whose element reads 0 until the metadata arrives, the reported position and every forwarded event stay at the saved time", async () => {
    const { ref, video, stub, spies } = await mount({ reportsZeroUntilMetadata: true });
    stub.loadMetadata();
    stub.playFrom(200);
    reportedSince(spies);

    await advance(HOUR - 60_000);
    expect(video.currentTime).toBe(0);                          // the element itself really does say 0 now
    expect(ref.current.getCurrentTime()).toBeGreaterThan(199.5); // but the player never repeats it
    fireEvent(video, new Event("timeupdate"));
    await settle();
    expect(reportedSince(spies).onTimeUpdate).toEqual([]);      // and no listener is ever handed the 0

    stub.loadMetadata(); // playFrom put the stub at readyState 4; a new source starts from none, so this is the real load
    await settle();
    expect(Math.abs(video.currentTime - 200)).toBeLessThan(0.5); // restored by the controller's explicit seek
  });

  it("a paused video is refreshed while paused, stays paused, and is never told to play", async () => {
    const { video, stub } = await mount();
    stub.loadMetadata();
    stub.pausedAt(123);

    await advance(HOUR - 5 * 60_000);
    stub.loadMetadata();
    await settle();

    expect(video.paused).toBe(true);
    expect(stub.state.playCalls).toBe(0);
    expect(Math.abs(video.currentTime - 123)).toBeLessThan(0.5);
    expect(screen.queryByText("videoPlayer.resume")).toBeNull();
  });

  it("if the browser refuses to resume, a play control is shown and works", async () => {
    const { video, stub } = await mount({ playRejects: true });
    stub.loadMetadata();
    stub.playFrom(80);

    await advance(HOUR - 60_000);
    stub.loadMetadata();
    await settle();

    const button = screen.getByText("videoPlayer.resume");
    expect(Math.abs(video.currentTime - 80)).toBeLessThan(0.5);

    stub.state.playRejects = false; // the click is a user gesture, which a browser lets through
    fireEvent.click(button);
    await settle();
    expect(stub.state.playCalls).toBe(2);
    expect(video.paused).toBe(false);
    expect(screen.queryByText("videoPlayer.resume")).toBeNull();
  });

  it("a refused refresh shows a clear message, keeps the picture and the position, and never restarts", async () => {
    let call = 0;
    const { video, stub, spies } = await mount({ respond: async () => {
      if (++call === 1) return { url: "/media/v1", expiresAt: new Date(Date.now() + HOUR).toISOString() };
      throw Object.assign(new Error("no access"), { status: 403 });
    } });
    stub.loadMetadata();
    stub.pausedAt(123);
    reportedSince(spies);

    await advance(HOUR - 5 * 60_000);
    await settle();

    expect(screen.getByRole("alert").textContent).toBe("videoPlayer.accessEnded");
    expect(stub.state.srcAssignments).toEqual(["/media/v1"]); // never swapped
    expect(video.currentTime).toBe(123);                        // never restarted
    expect(reportedSince(spies).onError).toEqual([]);          // an ended enrollment is not a broken video
  });

  it("a genuine playback error (not an expiry) still shows the video-unavailable fallback and is reported", async () => {
    const { stub, spies } = await mount();
    stub.loadMetadata();

    stub.failWith(4);
    await settle();

    expect(screen.getByText("videoPlayer.unavailable")).toBeTruthy();
    expect(spies.onError).toHaveBeenCalledTimes(1);
  });

  it("an error after the source has expired renews it instead of giving up", async () => {
    const { video, stub, spies } = await mount();
    stub.loadMetadata();
    stub.pausedAt(60);
    reportedSince(spies);

    vi.setSystemTime(Date.now() + HOUR - 3_000); // expiry passed while the laptop slept
    stub.failWith(2);
    await settle();
    expect(stub.state.srcAssignments).toEqual(["/media/v1", "/media/v2"]);
    expect(reportedSince(spies).onError).toEqual([]);

    stub.loadMetadata();
    await settle();
    expect(Math.abs(video.currentTime - 60)).toBeLessThan(0.5);
    expect(screen.queryByText("videoPlayer.unavailable")).toBeNull();
  });

  it("a seek from code during a refresh wins", async () => {
    const { ref, video, stub } = await mount();
    stub.loadMetadata();
    stub.playFrom(123);

    await advance(HOUR - 60_000);
    ref.current.seekTo(500); // a checkpoint jump mid-refresh
    expect(ref.current.getCurrentTime()).toBe(500);
    stub.loadMetadata();
    await settle();

    expect(Math.abs(video.currentTime - 500)).toBeLessThan(0.5);
  });
});
