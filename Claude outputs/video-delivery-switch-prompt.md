# Task: make video delivery switchable (Presigned R2 URL ↔ API proxy)

## Context
Video playback currently always gets a direct R2 presigned URL whenever the storage
provider supports it (`LearningAssetsController.Access`, ~line 90:
`if (asset.Category == Video && storage.SupportsPresignedRead)`). R2 always does, so
the `/content` proxy route is never used for video in production.

In Chrome, direct-to-R2 playback occasionally stalls (TD-023, suspected QUIC/HTTP3
between Chrome and R2's edge — not yet confirmed). Safari does not show it. We want an
operator-controlled switch so production can route video through the app's own
`/content` proxy WITHOUT a rebuild or redeploy, if the stall turns out to hurt users.
This is an emergency lever, not a new default.

## What to build
1. New config key `Storage:VideoDelivery`, values `Presigned` (default) or `Proxy`,
   case-insensitive. Unknown value → fail at startup with a clear message (same
   fail-fast style as `AssetAccessOptions.Resolve`).
   - Put it on `AssetAccessOptions` (Services/AssetAccessToken.cs) as an enum
     property, resolved inside `Resolve(...)`, so it's validated once at startup.
2. In `LearningAssetsController.Access`, only take the presigned branch when
   `VideoDelivery == Presigned && storage.SupportsPresignedRead`. Otherwise fall
   through to the existing token + `/content` path, which already uses
   `VideoProxyTokenLifetime` for video.
3. Update the XML doc comment on `VideoProxyTokenLifetime` — it currently says
   "dev/test use"; it now also covers production when `VideoDelivery=Proxy`.
4. Log once at startup which video delivery mode is active (Information level).
5. Do NOT change: authorization (`LearningAssetAccessPolicy`), the token format,
   the `/content` endpoint's behaviour, the presigned code path itself, or
   `playbackRefresh.js` (it already refreshes whatever URL `/access` returns and
   handles both the `"presigned"` and token response shapes — verify this, and
   only touch it if it genuinely treats the two differently in a way that breaks).
6. Add `"VideoDelivery": "Presigned"` to the `Storage` section in
   `appsettings.json` so the setting is discoverable.

## Tests
- Integration tests (existing WebApplicationFactory + Testcontainers setup):
  - With `Storage:VideoDelivery=Proxy`, `POST .../access` for a video returns a
    `/api/workspaces/{slug}/learning-assets/{id}/content?t=...` URL (not an R2 URL),
    and a ranged GET on it returns 206 with correct `Content-Range`.
  - With the default, behaviour is unchanged (existing presigned tests still pass).
  - An invalid value (e.g. `Storage:VideoDelivery=Banana`) fails startup.
- Run the full backend test suite and the frontend unit tests. Don't run the
  Playwright E2E suite unless asked.

## Constraints
- Keep the diff small and in the existing code style (comments explain *why*).
- No new packages. Don't commit; leave changes in the working tree and report:
  files changed, test results, and exactly how to flip the switch on Azure
  (App Service setting name: `Storage__VideoDelivery`, value `Proxy`).
- Add a one-line note to TD-023 in `Documents/Technical Debt Backlog.md` that
  this switch now exists as a mitigation.
