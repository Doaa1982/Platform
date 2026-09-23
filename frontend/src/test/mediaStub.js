/* A stand-in for HTMLMediaElement's playback behaviour, for tests. jsdom has none of it (no loading, no seeking, no
   playing), so this models the parts the refresh controller depends on — including the one that makes refreshing
   hard: assigning a new `src` resets the position to 0, the rate to 1 and the element to paused. While the element has
   no metadata, setting currentTime stores a start position which the getter reports, as the HTML spec describes. */

export function installMediaStub(video, { playRejects = false, duration = 600, reportsZeroUntilMetadata = false } = {}) {
  const state = {
    src: "", actual: 0, defaultStart: 0, readyState: 0, paused: true,
    playbackRate: 1, volume: 1, muted: false, error: null,
    playCalls: 0, pauseCalls: 0, srcAssignments: [], eventLog: [], writes: [],
    playRejects,
  };

  const emit = (name) => {
    // Record what a listener would read at this instant — the "did anything observe about 0" evidence.
    state.eventLog.push({ name, currentTime: video.currentTime });
    if (name === "loadedmetadata") state.writes.push({ prop: "loadedmetadata" });
    video.dispatchEvent(new Event(name));
  };

  const define = (name, descriptor) => Object.defineProperty(video, name, { configurable: true, ...descriptor });

  define("src", {
    get: () => state.src,
    set: (value) => {
      state.src = value;
      state.srcAssignments.push(value);
      // The media element load algorithm: everything about the previous source is discarded.
      state.actual = 0;
      state.defaultStart = 0;
      state.readyState = 0;
      state.paused = true;
      state.playbackRate = 1;
      // Real elements QUEUE these (they fire after the code that set the source has finished its current step), and
      // when they fire a start position assigned in the meantime is what currentTime reports.
      queueMicrotask(() => {
        emit("emptied");
        emit("timeupdate");
      });
    },
  });
  define("currentTime", {
    // A browser that does not honour a pre-set start position reports 0 until the metadata arrives.
    get: () => (state.readyState === 0 ? (reportsZeroUntilMetadata ? 0 : state.defaultStart) : state.actual),
    set: (value) => {
      state.writes.push({ prop: "currentTime", value });
      if (state.readyState === 0) { state.defaultStart = value; return; }
      state.actual = value;
      emit("seeking");
      queueMicrotask(() => emit("seeked"));
    },
  });
  define("paused", { get: () => state.paused });
  define("ended", { get: () => false });
  define("duration", { get: () => (state.readyState === 0 ? NaN : duration) });
  define("readyState", { get: () => state.readyState });
  define("error", { get: () => state.error });
  define("playbackRate", { get: () => state.playbackRate, set: (v) => { state.writes.push({ prop: "playbackRate", value: v }); state.playbackRate = v; } });
  define("volume", { get: () => state.volume, set: (v) => { state.writes.push({ prop: "volume", value: v }); state.volume = v; } });
  define("muted", { get: () => state.muted, set: (v) => { state.writes.push({ prop: "muted", value: v }); state.muted = v; } });
  define("play", {
    value: () => {
      state.playCalls += 1;
      state.writes.push({ prop: "play" });
      if (state.playRejects) return Promise.reject(new DOMException("play() was blocked", "NotAllowedError"));
      state.paused = false;
      emit("play");
      return Promise.resolve();
    },
  });
  define("pause", {
    value: () => { state.pauseCalls += 1; if (!state.paused) { state.paused = true; emit("pause"); } },
  });
  define("load", { value: () => {} });

  return {
    state,
    emit,
    /** The source's metadata arrives: the pending start position becomes the actual one. */
    loadMetadata() {
      state.readyState = 1;
      state.actual = state.defaultStart;
      state.defaultStart = 0;
      emit("loadedmetadata");
    },
    /** The learner drags the scrubber (or the code seeks): before metadata it only sets the start position. */
    userSeek(seconds) { video.currentTime = seconds; },
    /** Playback is under way from `seconds`, with the given settings. */
    playFrom(seconds, { rate = 1, volume = 1, muted = false } = {}) {
      state.readyState = 4;
      state.actual = seconds;
      state.paused = false;
      state.playbackRate = rate;
      state.volume = volume;
      state.muted = muted;
    },
    pausedAt(seconds) {
      state.readyState = 4;
      state.actual = seconds;
      state.paused = true;
    },
    failWith(code) { state.error = { code }; emit("error"); },
  };
}
