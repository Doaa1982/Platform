/* =========================================================================
   The checks every audited screen must pass — shared by the entry-screen
   audit (e2e/entry) and the in-app audit (e2e/app).
   ========================================================================= */
import AxeBuilder from "@axe-core/playwright";

export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** How a screen can end up light or dark: following the OS (nothing stored), or the in-app toggle
 *  (a stored choice) overriding an OS set the other way. The two "toggle" modes are the ones that
 *  catch a style keyed to prefers-color-scheme instead of html[data-theme]. */
export const THEME_MODES = [
  { id: "os-light", os: "light", stored: null, theme: "light" },
  { id: "os-dark", os: "dark", stored: null, theme: "dark" },
  { id: "toggle-dark", os: "light", stored: "dark", theme: "dark" },
  { id: "toggle-light", os: "dark", stored: "light", theme: "light" },
];

/** Latin text that may legitimately appear on an Arabic screen: the brand, the switcher's own
 *  "English", emails, URLs/slugs, and short codes the caller passes (e.g. a workspace's initial). */
const ALWAYS_ALLOWED = [
  "Teach Tandem", "English",
  /[\w.+-]+@[\w.-]+\.\w+/g,            // emails
  /https?:\/\/\S+/g,                    // links shown for copying
  /(?:^|\s)\/[a-z0-9][a-z0-9/-]*/g,      // slugs and app paths ("/al-noor", "/apply/status/abc")
];

export function leftoverLatin(text, extraAllowed = []) {
  let rest = text;
  // Longest strings first, so "CollaborationPlus" goes before "Collaboration" can split it.
  const strings = [...ALWAYS_ALLOWED, ...extraAllowed].filter((a) => typeof a === "string").sort((a, b) => b.length - a.length);
  const patterns = [...ALWAYS_ALLOWED, ...extraAllowed].filter((a) => typeof a !== "string");
  for (const allowed of [...strings, ...patterns]) {
    rest = typeof allowed === "string" ? rest.split(allowed).join(" ") : rest.replace(allowed, " ");
  }
  return [...new Set(rest.match(/[A-Za-z]{2,}/g) ?? [])];
}

export async function axeViolations(page) {
  const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 6).join(", ")}`);
}
