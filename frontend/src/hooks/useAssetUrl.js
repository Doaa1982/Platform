import { useEffect, useState } from "react";
import * as api from "../api/client";
import { assetUrls, assetBatcher, assetUrlKey } from "../api/assetUrls";

const EMPTY = { key: null, url: null, expiresAtMs: null, error: null };

/**
 * A short-lived, asset-scoped URL for one asset — the replacement for putting the session token in a URL.
 *
 * Returns { url, error }; `url` is null until the API has authorised the caller (and stays null if it refuses,
 * with the reason in `error`). Issued URLs are cached per user+asset until about a minute before they expire and
 * concurrent callers share one request. By default the URL is quietly renewed before it expires, which suits an
 * <img> or <iframe>; pass autoRefresh:false for a <video>, whose source must not be swapped mid-playback. Pass
 * batch:true for Image-category assets on a list screen: same-moment asks share one request.
 */
export function useAssetUrl(token, slug, assetId, { download = false, autoRefresh = true, batch = false } = {}) {
  const key = token && slug && assetId ? assetUrlKey(token, slug, assetId, download) : null;
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!key) return undefined;

    let cancelled = false;
    let timer = null;

    const load = () => {
      assetUrls
        .get(key, () => (batch
          ? assetBatcher.request(token, slug, assetId)
          : api.requestLearningAssetAccess(token, slug, assetId, { download })))
        .then(({ url, expiresAtMs }) => {
          if (cancelled) return;
          setState({ key, url, expiresAtMs, error: null });
          if (autoRefresh) timer = setTimeout(load, Math.max(assetUrls.msUntilRefresh(expiresAtMs), 5_000));
        })
        .catch((error) => {
          if (!cancelled) setState({ key, url: null, expiresAtMs: null, error });
        });
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [key, token, slug, assetId, download, autoRefresh, batch]);

  return state.key === key ? state : EMPTY;
}
