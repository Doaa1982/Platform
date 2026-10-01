/* =========================================================================
   APP PALETTES — the platform's own colors, fonts and radii as CSS custom
   properties, applied as an inline style on a .lw-root element.

   Shared by the signed-in app (App.jsx) and the entry screens (EntryShell), so
   both are the same product: cream paper + burgundy for tutors and the entry
   screens, the student notebook palette for learners, each with its dark
   counterpart. Moved here unchanged from App.jsx.
   ========================================================================= */

export const TUTOR_SHARED = {
  "--radius": "12px", "--radius-sm": "8px",
  "--font-display": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "--font-body": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "--font-mono": "'IBM Plex Mono', monospace",
};

export const STUDENT_SHARED = {
  "--radius": "14px", "--radius-sm": "8px",
  "--font-display": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "--font-body": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "--font-mono": "'IBM Plex Mono', monospace",
};

export const TUTOR_LIGHT = {
  ...TUTOR_SHARED,
  "--bg": "#F3ECD8", "--surface": "#FBF7EA", "--surface-2": "#EFE4C6",
  "--ink": "#241A10", "--ink-soft": "#6E5C43", "--accent": "#7A2E2E",
  // accent-2 darkened 2026-08-15 (WCAG pass) — #A9772F only cleared 3.3:1
  // as text against --bg/--surface-2 (used directly as text/icon color in
  // several places: .lw-rationale, .lw-scorepill, .lw-eventlog__item,
  // .lw-badge.is-earned svg); #855E25 clears 4.5:1+ there and also improves
  // (without breaking) the accent-2-as-fill-with-white-text spots.
  "--accent-2": "#855E25", "--line": "#D8C9A3", "--danger": "#7A2E2E",
  // success (2026-08-21, added for Message's toast, the only place that
  // previously ignored theming): #1E7D61 already clears 4.5:1+ against
  // every light --surface in this app (calibrated 2026-08-15 for Message's
  // old fixed light background), reused here rather than picked anew.
  "--success": "#1E7D61",
  "--on-accent": "#F3ECD8",
  // Added 2026-08-15 (WCAG pass): --accent-2 is also used as a solid FILL
  // behind text/icons (chat avatars, stepper dots, active row buttons) —
  // a separate role from --on-accent (which pairs with --accent). White
  // clears 5.79:1 here.
  "--on-accent-2": "#FFFFFF",
  "--nav-bg": "#241A10", "--nav-text": "#F3ECD8",
  "--bar-bg": "#FBF7EA", "--bar-ink": "#241A10", "--bar-line": "#D8C9A3",
  "--bar-hover-line": "#C4B48A", "--bar-panel-shadow": "rgba(36,26,16,0.18)",
  "--bar-role-bg": "#F2E1D9", "--bar-role-ink": "#7A2E2E",
  "--bar-active-bg": "#F2E1D9", "--bar-active-ink": "#7A2E2E", "--bar-active-line": "#E3C9BC",
  "--bar-hover-bg": "#F3ECD8", "--bar-unread-bg": "#F2E1D9", "--bar-unread-hover-bg": "#ECD3C4",
  // page-texture alpha halved (2026-08-26, "make the notebook lines more
  // transparent" — every theme below matches): decorative-only, so no WCAG
  // floor applies, just a fainter hint of the ruled-paper texture.
  "--page-texture": "repeating-linear-gradient(to bottom, transparent 0 34px, rgba(122,46,46,0.045) 34px 35px)",
  "--callout-bg": "#EFE4C6", "--callout-line": "#855E25",
};

export const TUTOR_DARK = {
  ...TUTOR_SHARED,
  "--bg": "#0B0F17", "--surface": "#111827", "--surface-2": "#1E293B",
  "--ink": "#F8FAFC", "--ink-soft": "#94A3B8", "--accent": "#00A3BF",
  "--accent-2": "#38BDF8", "--line": "rgba(255,255,255,0.08)", "--danger": "#F43F5E",
  "--success": "#10B981",
  "--on-accent": "#FFFFFF",
  "--on-accent-2": "#070A11",
  "--nav-bg": "#070A11", "--nav-text": "#F8FAFC",
  "--bar-bg": "#0B0F17", "--bar-ink": "#F8FAFC", "--bar-line": "rgba(255,255,255,0.08)",
  "--bar-hover-line": "rgba(255,255,255,0.16)", "--bar-panel-shadow": "rgba(0,0,0,0.6)",
  "--bar-role-bg": "rgba(0,163,191,0.12)", "--bar-role-ink": "#00C2CB",
  "--bar-active-bg": "rgba(0,163,191,0.18)", "--bar-active-ink": "#00E5FF", "--bar-active-line": "rgba(0,163,191,0.3)",
  "--bar-hover-bg": "#1E293B", "--bar-unread-bg": "rgba(244,63,94,0.16)", "--bar-unread-hover-bg": "rgba(244,63,94,0.26)",
  "--page-texture": "none",
  "--callout-bg": "#1E293B", "--callout-line": "#00A3BF",
};

export const STUDENT_LIGHT = {
  ...STUDENT_SHARED,
  "--bg": "#FAF6EC", "--surface": "#FFFEFA", "--surface-2": "#EEF3FA",
  "--ink": "#1F2E4D",
  "--ink-soft": "#6A707B",
  "--accent": "#D52929",
  "--accent-2": "#2E66D7", "--line": "#B9D0EE", "--danger": "#D52929",
  "--success": "#1E7D61",
  "--on-accent": "#FFFFFF",
  "--on-accent-2": "#FFFFFF",
  "--nav-bg": "#1B1B1D", "--nav-text": "#FAF6EC",
  "--bar-bg": "#FFFEFA", "--bar-ink": "#1F2E4D", "--bar-line": "#B9D0EE",
  "--bar-hover-line": "#9DBCE0", "--bar-panel-shadow": "rgba(31,46,77,0.16)",
  "--bar-role-bg": "#EAF1FC", "--bar-role-ink": "#2E66D7",
  "--bar-active-bg": "#EAF1FC", "--bar-active-ink": "#2E66D7", "--bar-active-line": "#D3E3FA",
  "--bar-hover-bg": "#FAF6EC", "--bar-unread-bg": "#FDEBEB", "--bar-unread-hover-bg": "#FBDCDC",
  "--page-texture": "repeating-linear-gradient(to bottom, transparent 0 27px, rgba(59,111,217,0.08) 27px 28px)",
  "--callout-bg": "#FFF3A3", "--callout-line": "#9C8A1A",
};

export const STUDENT_DARK = {
  ...STUDENT_SHARED,
  "--bg": "#0B0F17", "--surface": "#111827", "--surface-2": "#1E293B",
  "--ink": "#F8FAFC", "--ink-soft": "#94A3B8",
  "--accent": "#00A3BF",
  "--accent-2": "#38BDF8", "--line": "rgba(255,255,255,0.08)", "--danger": "#F43F5E",
  "--success": "#10B981",
  "--on-accent": "#FFFFFF",
  "--on-accent-2": "#070A11",
  "--nav-bg": "#070A11", "--nav-text": "#F8FAFC",
  "--bar-bg": "#0B0F17", "--bar-ink": "#F8FAFC", "--bar-line": "rgba(255,255,255,0.08)",
  "--bar-hover-line": "rgba(255,255,255,0.16)", "--bar-panel-shadow": "rgba(0,0,0,0.6)",
  "--bar-role-bg": "rgba(0,163,191,0.12)", "--bar-role-ink": "#00C2CB",
  "--bar-active-bg": "rgba(0,163,191,0.18)", "--bar-active-ink": "#00E5FF", "--bar-active-line": "rgba(0,163,191,0.3)",
  "--bar-hover-bg": "#1E293B", "--bar-unread-bg": "rgba(244,63,94,0.16)", "--bar-unread-hover-bg": "rgba(244,63,94,0.26)",
  "--page-texture": "none",
  "--callout-bg": "#1E293B", "--callout-line": "#00A3BF",
};

/** Which palette applies: tutor (and every entry screen) vs. learner, light vs. dark. */
export function paletteFor(role, mode) {
  return role === "learner"
    ? (mode === "dark" ? STUDENT_DARK : STUDENT_LIGHT)
    : (mode === "dark" ? TUTOR_DARK : TUTOR_LIGHT);
}
