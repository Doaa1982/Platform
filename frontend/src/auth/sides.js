/* =========================================================================
   SIDES — the two doors into the platform.

   A "side" is a UX grouping, NOT a permission. The domain has no global tutor
   or learner: roles live on Membership and are scoped to one Workspace
   (Membership Aggregate Design, INV-005). So a side only decides which door
   someone came through and which surface to render — never what they may do.

   Authorization always comes from the roles the API returns for the selected
   Workspace. Entering through /teach in a Workspace where you hold only
   Learner gets you the learner surface, not the tutor one.
   ========================================================================= */

/** Role names (from Workspace Access Context §4.4) that belong to each side. */
export const SIDES = {
  teach: {
    key: "teach",
    path: "/teach",
    label: "Teaching",
    roles: ["Owner", "Administrator", "Teacher", "AssistantTeacher", "FinanceManager"],
    chooser: {
      title: "I teach",
      blurb: "Build courses, run your academy, and work with your learners.",
    },
    login: {
      eyebrow: "For educators",
      heading: "Sign in to teach",
      sub: "Your academy, your learners, your content.",
      asideTitle: "Run your academy,\nnot your admin.",
      asideText:
        "Build courses, publish lessons, and see how your learners are actually doing — all in one workspace you control.",
      // Leather-ledger warm palette (Notebook Theme, 2026-08-15). `accent`
      // is TUTOR_LIGHT's primary --accent (deep maroon), not accent-2 gold:
      // a WCAG pass (2026-08-15) found gold only cleared 3.59:1 as small
      // text on this cream background (needs 4.5:1) — maroon clears 8.54:1
      // and still visually matches the leather-ledger cover gradient below.
      accent: "#7A2E2E",
      asideFrom: "#15100B",
      asideVia: "#2C2419",
      asideTo: "#7A2E2E",
      texture: "repeating-linear-gradient(to bottom, transparent 0 34px, rgba(122,46,46,0.09) 34px 35px)",
      devSeed: "tutor@platform.com",
    },
  },

  learn: {
    key: "learn",
    path: "/learn",
    label: "Learning",
    roles: ["Learner", "Parent"],
    chooser: {
      title: "I'm learning",
      blurb: "Continue your courses, track progress, and talk to your tutor.",
    },
    login: {
      eyebrow: "For learners",
      heading: "Sign in to learn",
      sub: "Pick up where you left off.",
      asideTitle: "Every lesson,\nright where you left it.",
      asideText:
        "Your courses, your progress, and your tutor — together in one place, whichever academy you belong to.",
      // Composition-notebook palette (Notebook Theme, 2026-08-15) — matches
      // STUDENT_LIGHT's accent/accent-2 in App.jsx (post-WCAG-pass values,
      // 2026-08-15: original #D93A3A/#3B6FD9 each cleared only ~4.2:1 as
      // small text/aside text and are now #D52929/#2E66D7, both 4.5:1+).
      // Cover fades from the dark green surface into the student's blue,
      // a marbled-notebook feel, and the accent carries through to the
      // dashboard the student lands on after signing in.
      accent: "#D52929",
      asideFrom: "#16241D",
      asideVia: "#1C2C23",
      asideTo: "#2E66D7",
      texture: "repeating-linear-gradient(to bottom, transparent 0 27px, rgba(59,111,217,0.16) 27px 28px)",
      devSeed: "learner@platform.com",
    },
  },
};

export const SIDE_KEYS = Object.keys(SIDES);

/** Does this set of Workspace roles grant access to the given side? */
export function rolesMatchSide(roles, sideKey) {
  const side = SIDES[sideKey];
  if (!side) return false;
  return roles.some((r) => side.roles.includes(r));
}

/** Every side these roles can enter — a Membership may qualify for both. */
export function sidesForRoles(roles) {
  return SIDE_KEYS.filter((key) => rolesMatchSide(roles, key));
}

/** The side a path maps to, or null for anything else. */
export function sideFromPath(pathname) {
  const segment = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
  return SIDE_KEYS.includes(segment) ? segment : null;
}
