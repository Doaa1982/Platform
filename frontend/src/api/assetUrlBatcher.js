/* =========================================================================
   ASSET URL BATCHER — pure, framework-free.

   A list screen with twenty covers would otherwise send twenty "give me a URL"
   requests, each running its own authorization. This collects every ask made
   in the same moment (same user, same workspace) into ONE request of at most
   `maxBatch` ids, and hands each caller back just its own answer.

   The server answers every "no" identically ({ available: false }), so an
   unavailable asset rejects with the same error whatever the reason.
   ========================================================================= */

export class AssetUnavailableError extends Error {
  constructor() {
    super("This file is not available.");
    this.name = "AssetUnavailableError";
    this.status = 404;
  }
}

export function createAssetUrlBatcher({ fetchBatch, delayMs = 10, maxBatch = 50, setTimer = setTimeout } = {}) {
  const groups = new Map(); // "token|slug" -> { token, slug, waiters: Map<assetId, [{ resolve, reject }]> }

  function request(token, slug, assetId) {
    const groupKey = `${token}|${slug}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = { token, slug, waiters: new Map() };
      groups.set(groupKey, group);
      setTimer(() => flush(groupKey), delayMs);
    }

    return new Promise((resolve, reject) => {
      const list = group.waiters.get(assetId) ?? [];
      list.push({ resolve, reject });
      group.waiters.set(assetId, list);
    });
  }

  function flush(groupKey) {
    const group = groups.get(groupKey);
    groups.delete(groupKey);
    if (!group) return;

    const ids = [...group.waiters.keys()];
    for (let i = 0; i < ids.length; i += maxBatch) {
      send(group, ids.slice(i, i + maxBatch));
    }
  }

  async function send(group, ids) {
    let response;
    try {
      response = await fetchBatch(group.token, group.slug, ids);
    } catch (error) {
      for (const id of ids) for (const w of group.waiters.get(id)) w.reject(error);
      return;
    }

    const byId = new Map((response?.items ?? []).map((item) => [item.assetId, item]));
    for (const id of ids) {
      const item = byId.get(id);
      for (const w of group.waiters.get(id)) {
        if (item?.available && item.url) w.resolve({ url: item.url, expiresAt: item.expiresAt });
        else w.reject(new AssetUnavailableError());
      }
    }
  }

  return { request };
}
