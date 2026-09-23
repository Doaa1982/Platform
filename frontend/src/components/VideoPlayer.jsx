import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as api from "../api/client";
import { createPlaybackController } from "../api/playbackRefresh";
import { useLanguage } from "../i18n/useLanguage";
import { detectVideoSource, youtubeWatchUrl } from "../utils/videoEmbed";
import { loadYouTubeIframeApi } from "../utils/youtubeIframeApi";

/* =========================================================================
   VIDEO PLAYER — the one place either video source (an uploaded/direct
   file, or a YouTube link) gets turned into pixels. Normalizes a native
   <video> element and a YouTube IFrame Player behind one identical
   imperative interface (play/pause/seekTo/getCurrentTime/getDuration) and
   one identical event-prop interface (onDurationChange/onTimeUpdate/
   onEnded/onError), so callers — Content Studio's VideoSection and the
   learner's checkpoint-driven player — don't need to know or care which
   backend is actually rendering.

   YouTube has no native `timeupdate` equivalent, so its onTimeUpdate is
   approximated by polling player.getCurrentTime() every POLL_INTERVAL_MS
   once the player is ready — the one place semantics aren't identical to
   the native path, just close enough for a checkpoint pause to feel instant.

   An uploaded video is played through `assetAccess` ({ token, slug, assetId })
   instead of `src`. Its URL is short-lived, so a playback controller (see
   api/playbackRefresh) fetches it, renews it before it expires, and swaps the
   new one into this same <video> element without losing the learner's place.
   While a swap is in progress no event or error is forwarded to the caller.
   ========================================================================= */

const POLL_INTERVAL_MS = 250;

// YouTube onError codes: https://developers.google.com/youtube/iframe_api_reference#onError
const YOUTUBE_ERROR_MESSAGE_KEYS = {
  2: "unavailable", // invalid video id
  5: "unavailable", // HTML5 player error
  100: "unavailable", // removed/private
  101: "embedDisabled", // owner disabled embedding
  150: "embedDisabled", // same as 101, legacy code
};

const OVERLAY_STYLE = {
  position: "absolute", inset: 0, background: "transparent", cursor: "default",
};

const FALLBACK_STYLE = {
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  gap: 10, padding: 20, textAlign: "center", background: "rgba(0,0,0,0.04)",
};

const FALLBACK_LINK_STYLE = { color: "inherit", textDecoration: "underline", fontSize: "0.85rem" };

const VideoPlayer = forwardRef(function VideoPlayer(
  { src, assetAccess, controls = true, className, style, onDurationChange, onTimeUpdate, onEnded, onError },
  ref
) {
  const { t } = useLanguage();
  const source = assetAccess ? { type: "native", url: null } : detectVideoSource(src);

  const videoElRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const durationReportedRef = useRef(false);

  const [fallback, setFallback] = useState(null);

  // Asset mode: the controller, the flag that gates forwarded events during a swap, and what the learner is told.
  const controllerRef = useRef(null);
  const swappingRef = useRef(false);
  const accessKey = assetAccess ? `${assetAccess.token}|${assetAccess.slug}|${assetAccess.assetId}` : null;
  const accessRef = useRef(assetAccess);
  const [notice, setNotice] = useState({ key: null, accessEnded: false, playBlocked: false });
  const accessEnded = notice.key === accessKey && notice.accessEnded;
  const playBlocked = notice.key === accessKey && notice.playBlocked;

  // Latest-callback ref: the YouTube setup effect below must only ever
  // re-run because the *video itself* changed (youtubeVideoId), never
  // because a parent re-render passed a structurally-new inline arrow
  // function for one of these props — that would tear down and recreate
  // the YouTube player (interrupting playback) on every unrelated state
  // change in the consumer. Updated after render (not during) so it stays
  // compiler-safe.
  const callbacksRef = useRef({});
  useEffect(() => {
    callbacksRef.current = { onDurationChange, onTimeUpdate, onEnded, onError };
    accessRef.current = assetAccess;
  });

  useEffect(() => {
    if (!accessKey) return undefined;
    const media = videoElRef.current;
    if (!media) return undefined;

    const { token, slug, assetId } = accessRef.current;
    const controller = createPlaybackController({
      media,
      fetchAccess: () => api.requestLearningAssetAccess(token, slug, assetId),
      onSwapStateChange: (isSwapping) => { swappingRef.current = isSwapping; },
      onDenied: () => setNotice((n) => ({ key: accessKey, accessEnded: true, playBlocked: n.key === accessKey && n.playBlocked })),
      onPlayBlocked: () => setNotice((n) => ({ key: accessKey, accessEnded: n.key === accessKey && n.accessEnded, playBlocked: true })),
      onFatalError: () => {
        setFallback({ messageKey: "unavailable", link: null });
        callbacksRef.current.onError?.({ source: "native" });
      },
    });
    controllerRef.current = controller;
    controller.start();

    return () => {
      controller.dispose();
      controllerRef.current = null;
      swappingRef.current = false;
    };
  }, [accessKey]);

  useImperativeHandle(ref, () => ({
    play() {
      if (source.type === "youtube") {
        playerRef.current?.playVideo?.();
        return Promise.resolve();
      }
      return videoElRef.current?.play?.() ?? Promise.resolve();
    },
    pause() {
      if (source.type === "youtube") playerRef.current?.pauseVideo?.();
      else videoElRef.current?.pause?.();
    },
    seekTo(seconds) {
      if (source.type === "youtube") playerRef.current?.seekTo?.(seconds, true);
      else if (controllerRef.current) controllerRef.current.seekTo(seconds);
      else if (videoElRef.current) videoElRef.current.currentTime = seconds;
    },
    getCurrentTime() {
      if (source.type === "youtube") return playerRef.current?.getCurrentTime?.() ?? 0;
      // While a source is being swapped the element momentarily reports 0; the controller keeps the real position.
      return controllerRef.current?.getPosition() ?? videoElRef.current?.currentTime ?? 0;
    },
    getDuration() {
      return source.type === "youtube"
        ? (playerRef.current?.getDuration?.() ?? 0)
        : (videoElRef.current?.duration ?? 0);
    },
  }));

  const youtubeVideoId = source.type === "youtube" ? source.videoId : null;

  useEffect(() => {
    if (!youtubeVideoId) return;
    let cancelled = false;
    durationReportedRef.current = false;
    setFallback(null);

    const reportDurationOnce = () => {
      if (durationReportedRef.current) return;
      const duration = playerRef.current?.getDuration?.() ?? 0;
      if (duration > 0) {
        durationReportedRef.current = true;
        callbacksRef.current.onDurationChange?.(duration);
      }
    };

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        playerRef.current = new YT.Player(containerRef.current, {
          videoId: youtubeVideoId,
          playerVars: { rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              reportDurationOnce();
              pollRef.current = setInterval(() => {
                const current = playerRef.current?.getCurrentTime?.();
                if (typeof current === "number") callbacksRef.current.onTimeUpdate?.(current);
                reportDurationOnce();
              }, POLL_INTERVAL_MS);
            },
            onStateChange: (event) => {
              if (event.data === window.YT?.PlayerState?.ENDED) callbacksRef.current.onEnded?.();
            },
            onError: (event) => {
              const messageKey = YOUTUBE_ERROR_MESSAGE_KEYS[event.data] ?? "unavailable";
              setFallback({ messageKey, link: youtubeWatchUrl(youtubeVideoId) });
              callbacksRef.current.onError?.({ source: "youtube", code: event.data });
            },
          },
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setFallback({ messageKey: "loadFailed", link: youtubeWatchUrl(youtubeVideoId) });
        callbacksRef.current.onError?.({ source: "youtube", message: err.message });
      });

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // Deliberately depends only on youtubeVideoId — see callbacksRef above.
  }, [youtubeVideoId]);

  if (fallback) {
    // "loadFailed" and "unavailable" can both be caused by an ad blocker or
    // privacy extension intercepting the request (confirmed during testing —
    // works fine in a clean/incognito profile, fails with certain extensions
    // active) as much as by a genuinely broken link, so only those two get
    // the troubleshooting hint. "embedDisabled" has a known, different cause
    // (the video owner disabled embedding) and doesn't need it.
    const showHint = fallback.messageKey === "loadFailed" || fallback.messageKey === "unavailable";
    return (
      <div className={className} style={{ ...FALLBACK_STYLE, ...style }}>
        <p style={{ margin: 0 }}>{t(`videoPlayer.${fallback.messageKey}`)}</p>
        {showHint && (
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>{t("videoPlayer.troubleshootHint")}</p>
        )}
        {fallback.link && (
          <a href={fallback.link} target="_blank" rel="noreferrer" style={FALLBACK_LINK_STYLE}>
            {t("videoPlayer.watchOnYouTube")}
          </a>
        )}
      </div>
    );
  }

  if (source.type === "youtube") {
    // YT.Player defaults its generated iframe to a fixed 640x390 unless told
    // otherwise, ignoring the container's own CSS size — the global
    // `.lw-videoplayer__youtube iframe` rule (App.jsx CSS) forces it to fill
    // this wrapper instead, so a YouTube video occupies exactly the same
    // frame a native <video> or direct-file URL would in the same spot.
    const youtubeClassName = className ? `lw-videoplayer__youtube ${className}` : "lw-videoplayer__youtube";
    return (
      <div className={youtubeClassName} style={{ position: "relative", ...style }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        {!controls && <div style={OVERLAY_STYLE} />}
      </div>
    );
  }

  const showFallback = (messageKey) => {
    controllerRef.current?.dispose();
    setFallback({ messageKey, link: null });
    onError?.({ source: "native" });
  };

  // The element handlers forward nothing while a source is being swapped: no progress, ended, duration or error
  // can reach the caller from the element's momentary reset.
  const video = (
    <video
      ref={videoElRef}
      {...(assetAccess ? {} : { src: source.url })}
      controls={controls}
      className={className}
      style={assetAccess ? { ...style, width: "100%", height: "100%" } : style}
      onLoadedMetadata={(e) => { if (!swappingRef.current) onDurationChange?.(e.target.duration); }}
      onTimeUpdate={(e) => { if (!swappingRef.current) onTimeUpdate?.(e.target.currentTime); }}
      onEnded={() => { if (!swappingRef.current) onEnded?.(); }}
      onError={() => {
        if (swappingRef.current) return;
        if (controllerRef.current?.handleMediaError()) return; // the source expired and is being renewed
        showFallback("unavailable");
      }}
    />
  );

  if (!assetAccess) return video;

  return (
    <div style={{ position: "relative", width: style?.width ?? "100%", height: style?.height ?? "100%" }}>
      {video}
      {playBlocked && (
        <button
          type="button"
          className="lw-btn lw-btn--primary"
          style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
          onClick={() => {
            setNotice((n) => ({ ...n, playBlocked: false }));
            // A click is a user gesture, so this normally succeeds; if it still fails there is nothing more to offer.
            Promise.resolve(videoElRef.current?.play?.()).catch(() => {});
          }}
        >
          {t("videoPlayer.resume")}
        </button>
      )}
      {accessEnded && (
        <p
          role="alert"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, margin: 0, padding: "10px 14px", textAlign: "center", fontSize: "0.85rem", background: "rgba(0,0,0,0.72)", color: "#fff" }}
        >
          {t("videoPlayer.accessEnded")}
        </p>
      )}
    </div>
  );
});

export default VideoPlayer;
