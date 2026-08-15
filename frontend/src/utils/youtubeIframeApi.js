/* =========================================================================
   YOUTUBE IFRAME API LOADER — module-scoped singleton, same "inject once"
   spirit as hooks/useFonts.js, but promise-returning since VideoPlayer
   needs to know when window.YT.Player is actually usable, not just that
   the <script> tag exists. Needed even for "just playback": getting a
   YouTube video's duration requires this API's onReady -> getDuration()
   (oEmbed doesn't return duration, and the Data API v3 needs a backend key).
   ========================================================================= */

let apiPromise = null;

/** Loads https://www.youtube.com/iframe_api once; resolves with window.YT. */
export function loadYouTubeIframeApi() {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    // script.onerror doesn't reliably fire for ad-blocker/DNS-level blocks —
    // an explicit timeout is the only reliable way to fail instead of
    // hanging VideoPlayer's loading state forever.
    const timeout = setTimeout(() => {
      reject(new Error("YouTube player took too long to load."));
    }, 10000);

    // Chain any pre-existing callback rather than clobbering it, in case
    // something else on the page ever sets this global too.
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previousReady?.();
      resolve(window.YT);
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Couldn't load the YouTube player script."));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}
