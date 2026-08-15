import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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
  { src, controls = true, className, style, onDurationChange, onTimeUpdate, onEnded, onError },
  ref
) {
  const { t } = useLanguage();
  const source = detectVideoSource(src);

  const videoElRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const durationReportedRef = useRef(false);

  const [fallback, setFallback] = useState(null);

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
  });

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
      else if (videoElRef.current) videoElRef.current.currentTime = seconds;
    },
    getCurrentTime() {
      return source.type === "youtube"
        ? (playerRef.current?.getCurrentTime?.() ?? 0)
        : (videoElRef.current?.currentTime ?? 0);
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

  return (
    <video
      ref={videoElRef}
      src={source.url}
      controls={controls}
      className={className}
      style={style}
      onLoadedMetadata={(e) => onDurationChange?.(e.target.duration)}
      onTimeUpdate={(e) => onTimeUpdate?.(e.target.currentTime)}
      onEnded={() => onEnded?.()}
      onError={() => {
        setFallback({ messageKey: "unavailable", link: null });
        onError?.({ source: "native" });
      }}
    />
  );
});

export default VideoPlayer;
