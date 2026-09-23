/* =========================================================================
   PLAYBACK REFRESH — renews a video's short-lived source URL without the
   learner noticing.

   A video's URL (a presigned R2 URL, or the API's proxy token URL) expires.
   This keeps one <video> element playing across that expiry by fetching a new
   URL and swapping it in, restoring exactly where the learner was:

     save   currentTime, paused, playbackRate, volume, muted
     swap   set the new src (and pre-set the start position)
     on loadedmetadata:  restore currentTime, then rate, volume, muted;
                         if it was playing call play() — a refused play()
                         shows a play control; if it was paused, stay paused
                         and NEVER call play().

   Guarantees:
   - One <video> element, no double-buffering.
   - While a swap is in progress `swapping` is true and the player forwards no
     events or errors to its callers, so nothing downstream (progress, "video
     watched", checkpoint questions) can observe the element's momentary reset
     to 0. getPosition() reports the saved position throughout.
   - A learner's seek while a refresh is in progress wins over the saved time.
   - However many triggers fire, only one request is in flight.
   - If the API refuses (access revoked) the video keeps its position, the
     caller is told, and nothing restarts.
   - A source that never delivers metadata (a stalled connection — seen with
     Chrome and R2 over QUIC) is abandoned after a while and replaced with a
     fresh one, a couple of times, before the failure is reported.

   Pure of React: everything it touches (the media element, the fetch, the
   clock, the timers) is passed in, so it is tested against a stubbed element.
   ========================================================================= */

export const REFRESH_LEAD_MS = 5 * 60_000;   // refresh about five minutes before expiry
export const FORCE_REMAINING_MS = 60_000;    // ...and force it at a minute or less, even mid-playback

const isDenied = (error) => error?.status === 403 || error?.status === 404;

export function createPlaybackController({
  media,
  fetchAccess,
  onSwapStateChange = () => {},
  onDenied = () => {},
  onPlayBlocked = () => {},
  onFatalError = () => {},
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  leadMs = REFRESH_LEAD_MS,
  forceMs = FORCE_REMAINING_MS,
  suspectMs = 10_000,        // "expiry is suspected" once this close to (or past) it
  retryMs = 5_000,           // wait before retrying a refresh that failed for a reason other than a refusal
  reactiveCooldownMs = 15_000,
  settleTimeoutMs = 5_000,
  loadTimeoutMs = 20_000,    // no metadata this long after a source is set: treat the load as stalled
  maxLoadRetries = 2,
}) {
  let expiresAtMs = 0;
  let inflight = null;
  let swapping = false;
  let restoring = false;
  let userSeekTarget = null;
  let savedTime = 0;
  let proactiveDue = false;
  let denied = false;
  let disposed = false;
  let lastReactiveAt = -Infinity;
  let swapFailures = 0;
  let loadRetries = 0;
  let loadTimer = null;
  let failSwap = null; // set while a swap is in progress
  const timers = { proactive: null, force: null, retry: null };
  let detach = () => {};

  // ── timers ────────────────────────────────────────────────────────────

  function clearTimers() {
    for (const name of Object.keys(timers)) {
      if (timers[name] !== null) clearTimer(timers[name]);
      timers[name] = null;
    }
  }

  /**
   * Due times are fractions of a short lifetime (a 30 s test URL cannot be refreshed "five minutes before expiry"),
   * so a short lifetime never causes an immediate, repeating refresh.
   */
  function schedule() {
    clearTimers();
    if (denied || disposed) return;
    const lifetime = Math.max(expiresAtMs - now(), 1);
    const lead = Math.min(leadMs, lifetime / 2);
    const force = Math.min(forceMs, lifetime / 4);
    timers.proactive = setTimer(onProactiveDue, Math.max(lifetime - lead, 0));
    timers.force = setTimer(() => { refresh("forced"); }, Math.max(lifetime - force, 0));
  }

  function onProactiveDue() {
    if (denied || disposed) return;
    if (media.paused) refresh("proactive-paused");   // paused: renew at once
    else proactiveDue = true;                        // playing: wait for the next pause or seek (the force timer is the backstop)
  }

  // ── events on the element ─────────────────────────────────────────────

  function onPause() {
    if (proactiveDue && !swapping && !inflight) refresh("proactive-pause");
  }

  function onSeeking() {
    if (restoring || disposed) return;               // our own restore, not the learner
    if (inflight || swapping) {
      userSeekTarget = media.currentTime;            // the learner's target wins over the saved time
    } else if (proactiveDue) {
      userSeekTarget = media.currentTime;
      refresh("proactive-seek");
    }
  }

  function onStalled() {
    if (swapping || denied || disposed) return;
    if (now() >= expiresAtMs - suspectMs) reactiveRefresh();
  }

  function reactiveRefresh() {
    if (now() - lastReactiveAt < reactiveCooldownMs) return false;
    lastReactiveAt = now();
    refresh("reactive");
    return true;
  }

  // ── stalled-load watchdog ─────────────────────────────────────────────

  function disarmWatchdog() {
    if (loadTimer !== null) clearTimer(loadTimer);
    loadTimer = null;
  }

  function armWatchdog() {
    disarmWatchdog();
    loadTimer = setTimer(onLoadTimeout, loadTimeoutMs);
  }

  function onLoadTimeout() {
    loadTimer = null;
    if (disposed || denied || media.readyState > 0) return;   // metadata did arrive, or there is nothing to wait for
    if (failSwap) { failSwap(); return; }                     // a swap's new source stalled
    loadRetries += 1;                                         // the first source stalled
    if (loadRetries > maxLoadRetries) onFatalError(new Error("The video source never loaded."));
    else refresh("load-timeout");
  }

  function onAnyMetadata() {
    disarmWatchdog();
    loadRetries = 0;
  }

  media.addEventListener("loadedmetadata", onAnyMetadata);
  media.addEventListener("pause", onPause);
  media.addEventListener("seeking", onSeeking);
  media.addEventListener("stalled", onStalled);
  detach = () => {
    disarmWatchdog();
    media.removeEventListener("loadedmetadata", onAnyMetadata);
    media.removeEventListener("pause", onPause);
    media.removeEventListener("seeking", onSeeking);
    media.removeEventListener("stalled", onStalled);
  };

  // ── loading a source ──────────────────────────────────────────────────

  async function start() {
    let next;
    try {
      next = await fetchAccess();
    } catch (error) {
      if (disposed) return;
      if (isDenied(error)) { denied = true; onDenied(error); } else onFatalError(error);
      return;
    }
    if (disposed) return;
    expiresAtMs = Date.parse(next.expiresAt);
    media.src = next.url;   // the first source: an ordinary load, not a swap
    armWatchdog();
    schedule();
  }

  // ── refresh ───────────────────────────────────────────────────────────

  /** One request at a time, however many triggers fire: a second caller gets the first caller's promise. */
  function refresh(reason) {
    if (disposed) return Promise.resolve();
    if (inflight) return inflight;

    proactiveDue = false;
    const run = (async () => {
      let next;
      try {
        next = await fetchAccess(reason);
      } catch (error) {
        handleFetchFailure(error);
        return;
      }
      if (disposed) return;
      denied = false;
      await swap(next);
    })();
    const tracked = run.finally(() => { if (inflight === tracked) inflight = null; });
    inflight = tracked;
    return tracked;
  }

  function handleFetchFailure(error) {
    if (disposed) return;
    userSeekTarget = null;
    if (isDenied(error)) {
      // Access is gone: keep the picture and the position exactly as they are, stop trying, say so.
      denied = true;
      clearTimers();
      onDenied(error);
      return;
    }
    timers.retry = setTimer(() => { timers.retry = null; refresh("retry"); }, retryMs);
  }

  function swap({ url, expiresAt }) {
    const snapshot = {
      time: userSeekTarget ?? media.currentTime,
      paused: media.paused,
      rate: media.playbackRate,
      volume: media.volume,
      muted: media.muted,
    };
    userSeekTarget = null;
    savedTime = snapshot.time;
    expiresAtMs = Date.parse(expiresAt);
    swapping = true;
    onSwapStateChange(true);

    return new Promise((resolve) => {
      let settleTimer = null;

      const finish = () => {
        media.removeEventListener("loadedmetadata", onLoaded);
        media.removeEventListener("seeked", onSeeked);
        media.removeEventListener("error", onSwapError);
        if (settleTimer !== null) clearTimer(settleTimer);
        disarmWatchdog();
        failSwap = null;
        restoring = false;
        swapping = false;
        onSwapStateChange(false);
        schedule();
        resolve();
      };

      const onSeeked = () => finish();

      const onLoaded = () => {
        media.removeEventListener("loadedmetadata", onLoaded);
        swapFailures = 0;

        // If the learner scrubbed while the element had no metadata yet, the element's pending start position differs
        // from what we assigned: that is their seek, and it wins.
        const observed = media.currentTime;
        const target = Math.abs(observed - snapshot.time) > 0.5 ? observed : snapshot.time;
        savedTime = target;

        const needsSeek = Math.abs(media.currentTime - target) > 0.25;
        if (needsSeek) { restoring = true; media.currentTime = target; }

        // A new source resets these; put them back, in the order the element expects.
        media.playbackRate = snapshot.rate;
        media.volume = snapshot.volume;
        media.muted = snapshot.muted;

        if (!snapshot.paused) {
          // It was playing: carry on. A refused play() (autoplay policy) is not an error — show a play control instead.
          Promise.resolve(media.play()).catch(() => onPlayBlocked());
        }
        // (If it was paused we never call play().)

        if (needsSeek) {
          media.addEventListener("seeked", onSeeked);
          settleTimer = setTimer(finish, settleTimeoutMs);
        } else {
          finish();
        }
      };

      const onSwapError = () => {
        // The new source failed to load (or stalled). Not forwarded to the caller: try once more, then give up loudly.
        media.removeEventListener("loadedmetadata", onLoaded);
        media.removeEventListener("seeked", onSeeked);
        media.removeEventListener("error", onSwapError);
        if (settleTimer !== null) clearTimer(settleTimer);
        disarmWatchdog();
        failSwap = null;
        restoring = false;
        swapping = false;
        onSwapStateChange(false);
        swapFailures += 1;
        if (swapFailures >= 2) { onFatalError(new Error("The refreshed video source could not be loaded.")); resolve(); return; }
        timers.retry = setTimer(() => { timers.retry = null; refresh("retry"); }, retryMs);
        resolve();
      };
      failSwap = onSwapError;

      media.addEventListener("loadedmetadata", onLoaded);
      media.addEventListener("error", onSwapError);

      media.src = url;
      armWatchdog();
      // Setting the start position on an element that has no metadata yet stores it as the position to begin at, so the
      // element never reports 0 while the new source loads.
      try { media.currentTime = snapshot.time; } catch { /* restored again on loadedmetadata */ }
    });
  }

  // ── what the player asks ──────────────────────────────────────────────

  return {
    start,
    refresh,

    /** The learner's position: the saved one while a swap is in progress, never the element's momentary reset. */
    getPosition() {
      if (swapping) return userSeekTarget ?? savedTime;
      return media.currentTime;
    },

    /** A seek from code (e.g. a checkpoint jump). During a refresh it is treated like the learner's own seek and wins. */
    seekTo(seconds) {
      if (inflight || swapping) userSeekTarget = seconds;
      try { media.currentTime = seconds; } catch { /* applied on loadedmetadata */ }
    },

    get swapping() { return swapping; },
    get denied() { return denied; },
    get expiresAtMs() { return expiresAtMs; },

    /**
     * A media error. Returns true when it was dealt with here (a swap's own failure, or the source expiring, which
     * is renewed) so the caller must NOT treat it as a failure; false for a genuine one (an unsupported format,
     * or access that was refused).
     */
    handleMediaError() {
      if (disposed) return true;
      if (swapping) return true;
      if (denied) return false;
      const suspected = now() >= expiresAtMs - suspectMs || media.error?.code === 2;
      return suspected ? reactiveRefresh() || Boolean(inflight) : false;
    },

    dispose() {
      disposed = true;
      clearTimers();
      detach();
    },
  };
}
