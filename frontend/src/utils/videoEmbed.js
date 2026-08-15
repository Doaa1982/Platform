/* =========================================================================
   VIDEO EMBED — classifies a lesson's video URL so VideoPlayer knows
   whether to render a native <video> element or a YouTube embed. Pure,
   render-time only — the backend never needs to know this; VideoUrl stays
   an opaque string server-side (LessonRevision.SetVideoUrl does no format
   validation today, and this doesn't change that).
   ========================================================================= */

// Matches youtube.com/watch?v=ID (v= anywhere in the query string),
// youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID — with or
// without "www."/"m."/"-nocookie", case-insensitive. No `new URL()`
// parsing, so it tolerates slightly malformed input the same way
// SetVideoUrl already does (accepts anything non-empty).
const YOUTUBE_ID_PATTERN =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;

/** Extracts an 11-char YouTube video ID from any of YouTube's URL shapes, or null. */
export function parseYouTubeId(url) {
  if (!url) return null;
  const match = url.match(YOUTUBE_ID_PATTERN);
  return match ? match[1] : null;
}

/** Classifies a video source URL for VideoPlayer. Never throws. */
export function detectVideoSource(url) {
  const videoId = parseYouTubeId(url);
  return videoId ? { type: "youtube", videoId } : { type: "file", url };
}

/** Convenience link for the "watch on YouTube" fallback. */
export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
