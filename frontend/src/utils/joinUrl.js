/* =========================================================================
   The public join link for a workspace — /join/{slug}, the route AppRoot
   serves JoinScreen on. Every screen that shows, links, copies or QR-encodes
   it builds it here, never by hand: the Overview banner once linked to
   /{slug}, a route that doesn't exist.
   ========================================================================= */

/** "/join/{slug}". Stray slashes around the slug are dropped, so a slug stored or typed as
 *  "/al-noor" can never produce "/join//al-noor" or "//al-noor". */
export function joinPath(slug) {
  const clean = String(slug ?? "").trim().replace(/^\/+|\/+$/g, "");
  return `/join/${encodeURIComponent(clean)}`;
}

/** The full link to share: "{origin}/join/{slug}". */
export function joinUrl(slug, origin = window.location.origin) {
  return `${String(origin).replace(/\/+$/, "")}${joinPath(slug)}`;
}
