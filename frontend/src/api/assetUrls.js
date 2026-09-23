import { createAssetUrlCache } from "./assetUrlCache";
import { createAssetUrlBatcher } from "./assetUrlBatcher";
import { requestLearningAssetAccessBatch } from "./client";

/** The app-wide cache of issued asset URLs. Held in memory only, never persisted. */
export const assetUrls = createAssetUrlCache();

/** One entry per user, workspace, asset and disposition — a URL issued to one user is never handed to another. */
export function assetUrlKey(token, slug, assetId, download = false) {
  return `${token}|${slug}|${assetId}|${download ? "attachment" : "inline"}`;
}

/** Collects same-moment asks for Image-category assets (list-screen covers) into one request. */
export const assetBatcher = createAssetUrlBatcher({ fetchBatch: requestLearningAssetAccessBatch });
