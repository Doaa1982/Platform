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
      accent: "#2D5BD1",
      asideFrom: "#1B2430",
      asideVia: "#24344B",
      asideTo: "#2D5BD1",
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
      accent: "#1E7F63",
      asideFrom: "#132520",
      asideVia: "#1B3B31",
      asideTo: "#1E7F63",
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
