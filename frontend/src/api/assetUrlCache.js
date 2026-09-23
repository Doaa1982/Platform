/* =========================================================================
   ASSET URL CACHE — pure, framework-free.

   The API hands out short-lived, asset-scoped URLs (POST .../access). This
   remembers each one until shortly before it expires, and makes sure that
   however many components ask for the same asset at once, only one request
   goes out. A failed request is never remembered, so the next ask retries.

   Keys must identify the user as well as the asset (the URL is bound to
   whoever asked), so callers include the session in the key — see keyFor().
   ========================================================================= */

export function createAssetUrlCache({ now = Date.now, skewMs = 60_000 } = {}) {
  const entries = new Map();   // key -> { url, expiresAtMs }
  const inflight = new Map();  // key -> Promise<{ url, expiresAtMs }>

  function isFresh(entry) {
    return Boolean(entry) && entry.expiresAtMs - now() > skewMs;
  }

  /** Cached while it has more than `skewMs` of life left; otherwise fetched (once, however many callers). */
  function get(key, fetcher) {
    const hit = entries.get(key);
    if (isFresh(hit)) return Promise.resolve(hit);

    const pending = inflight.get(key);
    if (pending) return pending;

    // Deferred with Promise.resolve().then so a fetcher that throws synchronously still becomes a rejected promise,
    // and the in-flight entry is set before the finally-cleanup can run.
    const request = Promise.resolve()
      .then(fetcher)
      .then(({ url, expiresAt }) => {
        const entry = { url, expiresAtMs: Date.parse(expiresAt) };
        entries.set(key, entry);
        return entry;
      })
      .finally(() => {
        if (inflight.get(key) === request) inflight.delete(key);
      });

    inflight.set(key, request);
    return request;
  }

  /** How long until a refresh is due for an entry that expires at `expiresAtMs`. */
  function msUntilRefresh(expiresAtMs) {
    return Math.max(expiresAtMs - now() - skewMs, 0);
  }

  return {
    get,
    msUntilRefresh,
    invalidate: (key) => { entries.delete(key); },
    clear: () => { entries.clear(); },
  };
}
