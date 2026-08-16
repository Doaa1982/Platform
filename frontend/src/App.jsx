import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeftRight, Award, BarChart3, BookOpen, Bell, Bot, Building2, Calendar, CheckCircle2, ChevronDown, ClipboardCheck, CreditCard, LayoutDashboard, Lock, Megaphone, MessageCircle, MessageSquare, PlayCircle, Receipt, Rocket, Settings, UserCircle, Users, Wand2, X
} from "lucide-react";
import { useAuth } from "./auth/authContext";
import { SIDES, rolesMatchSide } from "./auth/sides";
import { useFonts } from "./hooks/useFonts";
import { useLanguage } from "./i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "./i18n/LanguageToggle";
import { useTheme } from "./theme/useTheme";
import ThemeToggle, { THEME_TOGGLE_CSS } from "./theme/ThemeToggle";
import MembersScreen from "./screens/MembersScreen";
import WorkspaceSetupScreen from "./screens/WorkspaceSetupScreen";
import WorkspaceHomeScreen from "./screens/WorkspaceHomeScreen";
import NotBuiltYet from "./screens/NotBuiltYet";
import ProductsScreen from "./screens/ProductsScreen";
import SubscriptionScreen from "./screens/SubscriptionScreen";
import ContentStudioScreen from "./screens/ContentStudioScreen";
import LearnerHomeScreen from "./screens/LearnerHomeScreen";
import LearnerCoursesScreen from "./screens/LearnerCoursesScreen";
import LearnerLessonScreen from "./screens/LearnerLessonScreen";
import AiAssistantScreen from "./screens/AiAssistantScreen";
import QuizScreen from "./screens/QuizScreen";
import LessonContentScreen from "./screens/LessonContentScreen";
import HomeworkScreen from "./screens/HomeworkScreen";
import ResourcesScreen from "./screens/ResourcesScreen";
import AssessmentsOverviewScreen from "./screens/AssessmentsOverviewScreen";
import LearnerAssessmentsScreen from "./screens/LearnerAssessmentsScreen";
import * as api from "./api/client";

/* =========================================================================
   TOKEN SYSTEMS — one per Academy (Learning Workspace).
   Every business capability below renders through the SAME components,
   driven entirely by these tokens + the CONTENT data. That is the concrete
   proof of "Branded Experience" / "Workspace-Native AI" as architected.
   ========================================================================= */

/* NOTEBOOK THEME (2026-08-15). Per-workspace branding is still not implemented
   (Technical Debt Backlog TD-006), so every workspace still renders in one of
   the platform's own defaults — there are just two of them now, chosen by
   which side of the platform is rendering, not by Workspace:

     Tutor  (side "teach", role "owner")   → "Leather Ledger": crisp/boxy
       radii, burgundy + brass on parchment, Caveat display font, Lora serif
       body — reads like a bound ledger, not a web app.
     Student (side "learn", role "learner") → "Composition Notebook": soft
       rounded radii, red-margin/blue-rule cream paper, Kalam display font,
       plain sans body (a fully handwritten body font hurt legibility on
       dense screens like tables and forms, so the handwriting stays on
       headings/eyebrows only).

   Both keep the same shape vocabulary (--radius/--radius-sm, --font-*,
   --bar-*, --nav-*) so every existing .lw-* component reskins automatically
   — nothing about the components themselves changed, only the tokens. See
   App()'s `theme` selection below, which picks one of the four palettes from
   `role` (owner/learner) × `mode` (light/dark). */

const TUTOR_SHARED = {
  "--radius": "6px", "--radius-sm": "4px",
  "--font-display": "'Caveat', cursive",
  "--font-body": "'Lora', Georgia, serif",
  "--font-mono": "'IBM Plex Mono', monospace",
};

const STUDENT_SHARED = {
  "--radius": "16px", "--radius-sm": "10px",
  "--font-display": "'Kalam', cursive",
  "--font-body": "'IBM Plex Sans', system-ui, sans-serif",
  "--font-mono": "'IBM Plex Mono', monospace",
};

const TUTOR_LIGHT = {
  ...TUTOR_SHARED,
  "--bg": "#F3ECD8", "--surface": "#FBF7EA", "--surface-2": "#EFE4C6",
  "--ink": "#241A10", "--ink-soft": "#6E5C43", "--accent": "#7A2E2E",
  // accent-2 darkened 2026-08-15 (WCAG pass) — #A9772F only cleared 3.3:1
  // as text against --bg/--surface-2 (used directly as text/icon color in
  // several places: .lw-rationale, .lw-scorepill, .lw-eventlog__item,
  // .lw-badge.is-earned svg); #855E25 clears 4.5:1+ there and also improves
  // (without breaking) the accent-2-as-fill-with-white-text spots.
  "--accent-2": "#855E25", "--line": "#D8C9A3", "--danger": "#7A2E2E",
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
  "--page-texture": "repeating-linear-gradient(to bottom, transparent 0 34px, rgba(122,46,46,0.09) 34px 35px)",
  "--callout-bg": "#EFE4C6", "--callout-line": "#855E25",
};

const TUTOR_DARK = {
  ...TUTOR_SHARED,
  "--bg": "#1C1712", "--surface": "#241D16", "--surface-2": "#2C2419",
  "--ink": "#F1EAD9", "--ink-soft": "#B3A48A", "--accent": "#D4AF6A",
  // accent-2/danger lightened 2026-08-15 (WCAG pass) — #C1615A cleared only
  // 4.34:1 as --danger text against --bg (needs 4.5:1); #C2655E clears it
  // while keeping the same rust hue.
  "--accent-2": "#C2655E", "--line": "rgba(241,234,217,0.16)", "--danger": "#C2655E",
  "--on-accent": "#1C1712",
  // Added 2026-08-15 (WCAG pass): unlike --on-accent, --accent-2's fill
  // (chat avatars, stepper dots, active row buttons) needs a DARK label —
  // this rust is mid-light, so white text on it only clears 3.95:1; the
  // near-black --nav-bg value clears 4.86:1.
  "--on-accent-2": "#120E0A",
  "--nav-bg": "#120E0A", "--nav-text": "#F1EAD9",
  "--bar-bg": "#241D16", "--bar-ink": "#F1EAD9", "--bar-line": "rgba(241,234,217,0.16)",
  "--bar-hover-line": "rgba(241,234,217,0.28)", "--bar-panel-shadow": "rgba(0,0,0,0.5)",
  "--bar-role-bg": "#3A2A22", "--bar-role-ink": "#D4AF6A",
  "--bar-active-bg": "#3A2A22", "--bar-active-ink": "#D4AF6A", "--bar-active-line": "#4A362B",
  "--bar-hover-bg": "#2C2419", "--bar-unread-bg": "#3A2A22", "--bar-unread-hover-bg": "#45301F",
  "--page-texture": "repeating-linear-gradient(to bottom, transparent 0 34px, rgba(212,175,106,0.07) 34px 35px)",
  "--callout-bg": "#2C2419", "--callout-line": "#D4AF6A",
};

const STUDENT_LIGHT = {
  ...STUDENT_SHARED,
  "--bg": "#FAF6EC", "--surface": "#FFFEFA", "--surface-2": "#EEF3FA",
  "--ink": "#1F2E4D",
  // ink-soft darkened 2026-08-15 (WCAG pass) — #767C89 cleared only
  // 3.88:1/4.15:1 as secondary body text against --bg/--surface (needs 4.5:1).
  "--ink-soft": "#6A707B",
  // accent/danger darkened — #D93A3A cleared only 4.21:1 as danger/link
  // text against --bg (needs 4.5:1); #D52929 clears it and keeps the
  // white-on-accent button pairing comfortably above 3:1.
  "--accent": "#D52929",
  // accent-2 darkened — #3B6FD9 cleared only 4.14:1 as --bar-role-ink /
  // --bar-active-ink text against --bar-role-bg (needs 4.5:1).
  "--accent-2": "#2E66D7", "--line": "#B9D0EE", "--danger": "#D52929",
  "--on-accent": "#FFFFFF",
  // Added 2026-08-15 (WCAG pass): --accent-2 fill (chat avatars, stepper
  // dots, active row buttons) — white clears 5.25:1 here, same as --on-accent.
  "--on-accent-2": "#FFFFFF",
  "--nav-bg": "#1B1B1D", "--nav-text": "#FAF6EC",
  "--bar-bg": "#FFFEFA", "--bar-ink": "#1F2E4D", "--bar-line": "#B9D0EE",
  "--bar-hover-line": "#9DBCE0", "--bar-panel-shadow": "rgba(31,46,77,0.16)",
  "--bar-role-bg": "#EAF1FC", "--bar-role-ink": "#2E66D7",
  "--bar-active-bg": "#EAF1FC", "--bar-active-ink": "#2E66D7", "--bar-active-line": "#D3E3FA",
  "--bar-hover-bg": "#FAF6EC", "--bar-unread-bg": "#FDEBEB", "--bar-unread-hover-bg": "#FBDCDC",
  "--page-texture": "repeating-linear-gradient(to bottom, transparent 0 27px, rgba(59,111,217,0.16) 27px 28px)",
  // callout-line darkened significantly — #E8D877 on #FFF3A3 was 1.28:1,
  // an effectively invisible border (needs 3:1 as a UI/non-text element);
  // #9C8A1A (a mustard olive) clears 3:1 while staying in the same warm-
  // yellow family as the sticky-note callout background.
  "--callout-bg": "#FFF3A3", "--callout-line": "#9C8A1A",
};

const STUDENT_DARK = {
  ...STUDENT_SHARED,
  "--bg": "#16241D", "--surface": "#1C2C23", "--surface-2": "#23362A",
  "--ink": "#F5F3EC", "--ink-soft": "#9FB0A5",
  // accent/danger lightened 2026-08-15 (WCAG pass) — #E06A5E cleared only
  // 4.46:1 as accent/danger text against --surface (needs 4.5:1).
  "--accent": "#E16E62",
  "--accent-2": "#6FB3D9", "--line": "rgba(245,243,236,0.16)", "--danger": "#E16E62",
  "--on-accent": "#16241D",
  // Added 2026-08-15 (WCAG pass): the worst case found in the audit —
  // --accent-2 here is a light sky-blue (correct as small text against the
  // dark bg), but the same token filling chat avatars/stepper dots/active
  // row buttons with hardcoded white text was only 2.30:1, effectively
  // unreadable. No single color can serve both roles; --nav-bg clears
  // 7.67:1 as a dark label on this light fill.
  "--on-accent-2": "#101B15",
  "--nav-bg": "#101B15", "--nav-text": "#F5F3EC",
  "--bar-bg": "#1C2C23", "--bar-ink": "#F5F3EC", "--bar-line": "rgba(245,243,236,0.16)",
  "--bar-hover-line": "rgba(245,243,236,0.28)", "--bar-panel-shadow": "rgba(0,0,0,0.5)",
  "--bar-role-bg": "#23384A", "--bar-role-ink": "#6FB3D9",
  "--bar-active-bg": "#23384A", "--bar-active-ink": "#6FB3D9", "--bar-active-line": "#2E4A61",
  "--bar-hover-bg": "#23362A", "--bar-unread-bg": "#3A2426", "--bar-unread-hover-bg": "#472C2E",
  "--page-texture": "repeating-linear-gradient(to bottom, transparent 0 27px, rgba(245,243,236,0.06) 27px 28px)",
  "--callout-bg": "#23362A", "--callout-line": "#6FB3D9",
};

/* =========================================================================
   WORKSPACE SETUP WIZARD — supporting data
   Branding presets a new Workspace Owner can pick during onboarding
   (Workspace Context lifecycle: Draft → Configuring → Published → Active).
   ========================================================================= */

/* Builds a full CONTENT-shaped object for a brand-new Workspace on day one:
   one owner, zero learners, zero revenue — an honest empty state rather
   than pre-seeded demo data, since that is what WorkspacePublished
   actually looks like before any Membership or Enrollment exists. */

/* =========================================================================
   CONTENT — every bounded context's data, per Academy.
   ========================================================================= */

/* =========================================================================
   GENERATED VISUAL IDENTITY — logo mark + curriculum cover art.
   Deterministic (seeded by name), on-brand (uses this Workspace's own
   tokens), and network-free — the safer default for a prototype vs.
   hotlinking stock photography. Both accept a real image URL and will
   render that instead the moment one exists (see `logoUrl` / `imageUrl`),
   so swapping in real brand assets later is a one-line change.
   ========================================================================= */

function BrandMark({ c, size = 34 }) {
  if (c.logoUrl) return <img src={c.logoUrl} alt={`${c.name} logo`} className="lw-brandmark" style={{ width: size, height: size, borderRadius: "var(--radius-sm)", objectFit: "cover" }} />;

  const style = c.logoStyle || "geometric";
  const s = size;
  const inner = {
    stamp: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="10" fill="var(--accent)" />
        <circle cx="20" cy="20" r="12" fill="none" stroke="#fff" strokeWidth="1.4" strokeDasharray="2.6 2.6" opacity="0.9" />
        <path d="M13 17 L20 23 L27 17" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="13" y="14" width="14" height="10" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.8" />
      </svg>
    ),
    ledger: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="6" fill="var(--accent)" />
        <rect x="10" y="12" width="20" height="3" rx="1.5" fill="#fff" opacity="0.95" />
        <rect x="10" y="18" width="14" height="3" rx="1.5" fill="#fff" opacity="0.7" />
        <rect x="10" y="24" width="17" height="3" rx="1.5" fill="#fff" opacity="0.5" />
        <path d="M27 23 L30 26 L34 20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    leaf: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="14" fill="var(--accent)" />
        <path d="M12 27 C12 15 22 10 30 11 C29 20 24 27 12 27 Z" fill="#fff" opacity="0.95" />
        <path d="M13 26 C18 21 22 17 29 12" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    circuit: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="6" fill="#0D0F12" />
        <circle cx="14" cy="14" r="2.4" fill="var(--accent)" />
        <circle cx="27" cy="14" r="2.4" fill="var(--accent-2)" />
        <circle cx="14" cy="27" r="2.4" fill="var(--accent-2)" />
        <circle cx="27" cy="27" r="2.4" fill="var(--accent)" />
        <path d="M14 14 L27 14 M14 14 L14 27 M27 14 L27 27 M14 27 L27 27 M14 14 L27 27" stroke="#3A3F47" strokeWidth="1.1" />
      </svg>
    ),
    bracket: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="3" fill="var(--accent)" />
        <path d="M16 11 L10 20 L16 29" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 11 L30 20 L24 29" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    geometric: (
      <svg viewBox="0 0 40 40" width={s} height={s}>
        <rect width="40" height="40" rx="10" fill="var(--accent)" />
        <text x="20" y="26" fontSize="18" fontWeight="700" fill="#fff" textAnchor="middle" fontFamily="var(--font-display)">{c.mark}</text>
      </svg>
    ),
  };
  return <div className="lw-brandmark">{inner[style] || inner.geometric}</div>;
}

/* Deterministic abstract cover art for a course/product, standing in for
   curriculum photography until real images are uploaded. Seeded by title
   so the same course always renders the same cover. */
/* =========================================================================
   ACCOUNT BAR — the real signed-in Identity, above the prototype harness.

   Shows the Workspace actually entered and the roles held *there*, which is
   the honest counterpart to the demo harness below it: the harness switches
   between fictional academies, this bar reports the real session.
   ========================================================================= */

/**
 * A member's own in-app inbox (Notification.cs). Lesson Editing &
 * Publication UX, Scenario 4 — the one kind that exists so far tells a
 * learner their lesson's questions were improved in place, without a new
 * version. Polled on an interval rather than pushed — there is no realtime
 * transport in this app, and a notice a few seconds late costs nothing here.
 */
function NotificationBell() {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    if (!slug) return;
    api.getMyNotifications(session.token, slug)
      .then((d) => { setItems(d.notifications); setUnread(d.unreadCount); })
      .catch(() => {});
  }, [session?.token, slug]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  function handleItemClick(n) {
    if (n.readAt) return;
    api.markNotificationRead(session.token, slug, n.id).then(load).catch(() => {});
  }

  if (!slug) return null;

  return (
    <div className="lw-notifbell">
      <button
        className="lw-notifbell__trigger" onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? t("notifbell.ariaUnread", { count: unread }) : t("notifbell.ariaDefault")}
      >
        <Bell size={15} />
        {unread > 0 && <span className="lw-notifbell__badge">{unread}</span>}
      </button>
      {open && (
        <>
          <div className="lw-notifbell__scrim" onClick={() => setOpen(false)} />
          <div className="lw-notifbell__panel">
            <div className="lw-notifbell__head">{t("notifbell.title")}</div>
            {items.length === 0 ? (
              <p className="lw-notifbell__empty">{t("notifbell.empty")}</p>
            ) : (
              <ul className="lw-notifbell__list">
                {items.map((n) => (
                  <li key={n.id} className={n.readAt ? "" : "is-unread"} onClick={() => handleItemClick(n)}>
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <span className="lw-notifbell__time">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AccountBar({ role, screen, onNavigate, aiLabel, onOpenProfile }) {
  const { me, side, workspace, workspaces, eligibleWorkspaces, leaveWorkspace, signOut } = useAuth();
  const { t } = useLanguage();
  if (!workspace) return null;

  const otherKey = side === "teach" ? "learn" : "teach";
  const config = SIDES[side];
  const other = SIDES[otherKey];

  /* Offer the other door only where this person genuinely holds roles for it,
     in some Active Workspace. Showing it otherwise would send them to a side
     with nothing on it. */
  const canSwitchSide = workspaces.some(
    (w) => w.membershipStatus === "Active" && rolesMatchSide(w.roles, other.key)
  );

  return (
    <div className="lw-accountbar" style={{ "--side-accent": config.login.accent }}>
      <span className="lw-accountbar__side">{t(`sides.${side}.label`)}</span>
      {role === "owner" && (
        <>
          <span className="lw-accountbar__ws">
            <Building2 size={13} /> {workspace.name}
          </span>
          <span className="lw-accountbar__roles">
            {workspace.roles.map((r) => (
              <span className="lw-accountbar__role" key={r}>{r.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
            ))}
          </span>
        </>
      )}
      {/* The workspace's own name/branding already reads immediately below,
          in AcademyHeader's banner — repeating it here would just be the
          same claim twice. Primary navigation lives here instead. */}
      {role === "learner" && <LearnerTopNav screen={screen} onNavigate={onNavigate} aiLabel={aiLabel} />}
      <span className="lw-accountbar__spacer" />
      <LanguageToggle />
      <ThemeToggle />
      <NotificationBell />
      <button className="lw-accountbar__who" onClick={onOpenProfile}>{me?.fullName}</button>
      {canSwitchSide && (
        <button onClick={() => { window.history.pushState({}, "", other.path); window.dispatchEvent(new PopStateEvent("popstate")); }}>
          <ArrowLeftRight size={12} /> {t(`sides.${otherKey}.label`)}
        </button>
      )}
      {eligibleWorkspaces.length > 1 && (
        <button onClick={leaveWorkspace}>{t("accountbar.switchWorkspace")}</button>
      )}
      <button onClick={signOut}>{t("accountbar.signOut")}</button>
    </div>
  );
}

/* Dashboard and My Learnings as direct links; everything else (Assessments,
   Certificates, Schedule, Messages, Community, AI) behind "More" — keeps the
   top bar uncluttered while still giving every section a reachable home,
   now that the left sidebar is reserved for in-lesson Course content. */
function LearnerTopNav({ screen, onNavigate, aiLabel }) {
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = LEARNER_NAV.filter((it) => PRIMARY_LEARNER_NAV.includes(it.id));
  const more = LEARNER_NAV.filter((it) => !PRIMARY_LEARNER_NAV.includes(it.id));
  const moreActive = more.some((it) => it.id === screen);

  return (
    <span className="lw-accountbar__navlinks">
      {primary.map((it) => (
        <button
          key={it.id}
          className={`lw-accountbar__navlink ${screen === it.id ? "is-active" : ""}`}
          onClick={() => onNavigate(it.id)}
        >
          {it.id === "courses" ? t("learnerNav.myLearnings") : t(it.labelKey)}
        </button>
      ))}
      <span className="lw-accountbar__more">
        <button
          className={`lw-accountbar__navlink ${moreActive ? "is-active" : ""}`}
          onClick={() => setMoreOpen((v) => !v)}
        >
          {t("learnerNav.more")} <ChevronDown size={12} />
        </button>
        {moreOpen && (
          <>
            <div className="lw-notifbell__scrim" onClick={() => setMoreOpen(false)} />
            <div className="lw-accountbar__morepanel">
              {more.map((it) => (
                <button
                  key={it.id}
                  className={`lw-accountbar__moreitem ${screen === it.id ? "is-active" : ""}`}
                  onClick={() => { onNavigate(it.id); setMoreOpen(false); }}
                >
                  <it.icon size={14} /> {it.labelKey === "__AI__" ? aiLabel : t(it.labelKey)}
                </button>
              ))}
            </div>
          </>
        )}
      </span>
    </span>
  );
}

/* =========================================================================
   PROTOTYPE CONTROL STRIP — demo harness, never seen by a real learner.
   ========================================================================= */

/* =========================================================================
   ACADEMY HEADER — full-width, bright identity bar for the Learner
   section only. Sits above the Nav/Content shell rather than being
   confined to the sidebar corner, so the academy's name and mark read
   immediately on entry (Workspace Resolution activating branding first).
   ========================================================================= */

function AcademyHeader({ c }) {
  return (
    <div className="lw-academyheader">
      <div className="lw-academyheader__mark"><BrandMark c={c} size={40} /></div>
      <div className="lw-academyheader__text">
        <div className="lw-academyheader__name">{c.name}</div>
        <div className="lw-academyheader__tagline">{c.tagline}</div>
      </div>
    </div>
  );
}

/* The "Viewing as" toggle that used to live here is gone: which surface you
   see is now decided by the door you signed in through and the roles the API
   returns for the selected Workspace, so a free-floating switch would be able
   to claim a view the session does not support. Switching sides is offered in
   AccountBar instead, and only when your roles actually allow it. */
/* =========================================================================
   NAV
   ========================================================================= */

/* Lives in the top bar now (AccountBar/LearnerTopNav), not a left sidebar —
   Dashboard and My Learnings (PRIMARY_LEARNER_NAV) render as direct links,
   the rest behind "More". No "Continue Lesson" entry: it never reliably
   resumed a specific lesson (jumping here always cleared productId/
   lessonId first) and is redundant now that My Learnings and the in-lesson
   sidebar both reach any lesson directly. */
const LEARNER_NAV = [
  { id: "dashboard", labelKey: "learnerNav.dashboard", icon: LayoutDashboard },
  { id: "courses", labelKey: "learnerNav.courses", icon: BookOpen },
  { id: "assessments", labelKey: "learnerNav.assessments", icon: ClipboardCheck, capability: "assessments" },
  { id: "certificates", labelKey: "learnerNav.certificates", icon: Award, capability: "certificates" },
  { id: "schedule", labelKey: "learnerNav.schedule", icon: Calendar, capability: "schedule" },
  { id: "messages", labelKey: "learnerNav.messages", icon: MessageSquare, capability: "messages" },
  { id: "community", labelKey: "learnerNav.community", icon: MessageCircle, capability: "community" },
  { id: "ai", labelKey: "__AI__", icon: Bot, capability: "aiTutor" },
];
const PRIMARY_LEARNER_NAV = ["dashboard", "courses"];

/* Maps a Learner nav id to the Workspace capability that gates it — the
   single source of truth used by both LearnerTopNav (to hide items) and App
   (to redirect away from a screen an Owner just turned off). */

const OWNER_NAV = [
  { dividerKey: "nav.grow" },
  { id: "overview", labelKey: "nav.overview", icon: BarChart3 },
  { id: "products", labelKey: "nav.learningProducts", icon: BookOpen },
  { id: "studio", labelKey: "nav.contentStudio", icon: Wand2 },
  { dividerKey: "nav.operate" },
  { id: "members", labelKey: "nav.members", icon: Users },
  { id: "scheduling", labelKey: "nav.scheduling", icon: Calendar },
  { id: "commerce", labelKey: "nav.commerce", icon: CreditCard },
  { id: "communication", labelKey: "nav.communication", icon: Megaphone },
  { dividerKey: "nav.prove" },
  { id: "assessment", labelKey: "nav.assessmentCertificates", icon: Award },
  { dividerKey: "nav.configure" },
  // The real Workspace lifecycle, above the prototype's settings panel
  { id: "setup", labelKey: "nav.workspaceSetup", icon: Rocket },
  // This Workspace's own subscription to the platform — distinct from the
  // still-unbuilt "commerce" item above, which is what this tutor charges
  // *their* students, not what they pay the platform.
  { id: "billing", labelKey: "nav.billing", icon: Receipt },
  { id: "settings", labelKey: "nav.workspaceSettings", icon: Settings },
];

/* Owner/tutor side only now — the Learner side's primary nav lives in the
   top bar (LearnerTopNav) and its left-sidebar slot is reserved for the
   in-lesson Course content menu (LessonSidebar) while viewing a lesson,
   and empty everywhere else. */
function Nav({ c, screen, setScreen, onOpenProfile, personName, personRole }) {
  const { t } = useLanguage();
  return (
    <div className="lw-nav">
      <div className="lw-nav__brand">
        <BrandMark c={c} size={34} />
        <div>
          <div className="lw-nav__name">{c.name}</div>
          <div className="lw-nav__tagline">{c.tagline}</div>
        </div>
      </div>
      <div className="lw-nav__items">
        {OWNER_NAV.map((it, i) =>
          it.dividerKey ? (
            <div className="lw-nav__divider" key={`d${i}`}>{t(it.dividerKey)}</div>
          ) : (
            <button
              key={it.id}
              className={`lw-nav__item ${screen === it.id ? "is-active" : ""}`}
              onClick={() => setScreen(it.id)}
            >
              <it.icon size={16} />
              {t(it.labelKey)}
            </button>
          )
        )}
      </div>
      <button className="lw-nav__profile" onClick={onOpenProfile}>
        <UserCircle size={16} /> {t("nav.myProfile")}
      </button>
      <div className="lw-nav__person">
        <div className="lw-nav__avatar">{(personName || "?").trim()[0]}</div>
        <div>
          <div className="lw-nav__personname">{personName}</div>
          <div className="lw-nav__personrole">{personRole}</div>
        </div>
      </div>
    </div>
  );
}

/* The left-sidebar slot, while a Learner is viewing a lesson: the "Course
   content" units/lessons accordion, occupying the exact column Nav does for
   the owner side — everywhere else on the Learner side this slot is simply
   absent (see App's .lw-shell render), not this component collapsed empty.
   Self-contained (fetches its own curriculum via useAuth, same pattern as
   NotificationBell) since it now renders as LearnerLessonScreen's sibling,
   not its child. */
function LessonSidebar({ productId, lessonId, onOpenLesson, refreshToken }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [curriculum, setCurriculum] = useState(null);
  const [openUnits, setOpenUnits] = useState(() => new Set());

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    api.getLearnerCurriculum(session.token, slug, productId)
      .then((d) => { if (!cancelled) setCurriculum(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session.token, slug, productId, refreshToken]);

  // Default-open the unit that holds the current lesson, without closing any
  // unit the learner opened themselves.
  useEffect(() => {
    if (!curriculum) return;
    const unit = curriculum.units.find((u) => u.lessons.some((l) => l.id === lessonId));
    if (unit) setOpenUnits((prev) => (prev.has(unit.position) ? prev : new Set(prev).add(unit.position)));
  }, [curriculum, lessonId]);

  function toggleUnit(position) {
    setOpenUnits((prev) => {
      const next = new Set(prev);
      if (next.has(position)) next.delete(position); else next.add(position);
      return next;
    });
  }

  if (!curriculum) return <div className="lw-lessonnav" />;

  return (
    <div className="lw-lessonnav">
      <div className="lw-lessonnav__head">{t("lessonSidebar.courseContent")}</div>
      {curriculum.requiresSequentialCompletion && (
        <div className="lw-lessonnav__seqhint">
          <Lock size={11} /> {t("lessonSidebar.seqHint")}
        </div>
      )}
      <div className="lw-lessonnav__units">
        {curriculum.units.map((u, i) => {
          const open = openUnits.has(u.position);
          const doneCount = u.lessons.filter((l) => l.progressStatus === "Completed").length;
          const mins = u.lessons.reduce((sum, l) => sum + (l.estimatedMinutes ?? 0), 0);
          return (
            <div className="lw-lessonnav__unit" key={u.position}>
              <button type="button" className="lw-lessonnav__unithead" onClick={() => toggleUnit(u.position)}>
                <ChevronDown size={14} className={`lw-lessonnav__chevron ${open ? "is-open" : ""}`} />
                <span className="lw-lessonnav__unittitle">{i + 1}. {u.title}</span>
                <span className="lw-lessonnav__unitmeta">{doneCount}/{u.lessons.length}{mins > 0 ? ` · ${mins}${t("lessonSidebar.min")}` : ""}</span>
              </button>
              {open && (
                <div className="lw-lessonnav__lessons">
                  {u.lessons.map((l) => {
                    const active = l.id === lessonId;
                    const lessonDone = l.progressStatus === "Completed";
                    return (
                      <button
                        type="button" key={l.id}
                        className={`lw-lessonnav__lessonrow ${active ? "is-active" : ""} ${l.locked ? "is-locked" : ""}`}
                        disabled={l.locked}
                        title={l.locked ? t("lessonSidebar.lockedTitle") : undefined}
                        onClick={() => !active && !l.locked && onOpenLesson?.(l.id)}
                      >
                        {lessonDone
                          ? <CheckCircle2 size={14} className="is-done" />
                          : l.locked ? <Lock size={14} /> : <PlayCircle size={14} />}
                        <span className="lw-lessonnav__lessontitle">{l.title}</span>
                        {l.estimatedMinutes != null && <span className="lw-lessonnav__lessonmins">{l.estimatedMinutes}{t("lessonSidebar.min")}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
   LEARNER SCREENS
   ========================================================================= */

/* =========================================================================
   OWNER / WORKSPACE-OWNER SCREENS
   ========================================================================= */

/* =========================================================================
   PSEUDO-AI HELPERS for the Product Builder.
   These simulate what the AI Content Assistant / AI Business Assistant
   would return (per AI Context §4.5 and the Product Content Strategy
   docs) — templated rather than a live model call, since this is a
   prototype, but the SHAPE of every suggestion matches what the docs
   describe the real AI Context returning.
   ========================================================================= */

/* =========================================================================
   PRODUCT BUILDER — Units → Lessons → Interactive Videos,
   with AI assistance surfaced at every step.
   ========================================================================= */

/* =========================================================================
   VIDEO SOURCE PICKER — shared by Content Studio and the Product Builder.
   Matches AI Context §13.3 "Supported Content Sources": Video Upload
   (MP4 / recorded session) or Video URL — a direct file link, or a
   YouTube link (rendered via VideoPlayer's IFrame Player embed, full
   interactive-checkpoint support). Vimeo/other embed providers aren't
   implemented yet; a non-YouTube URL is still treated as a direct file link.
   ========================================================================= */

/* =========================================================================
   IMAGE PICKER — lets a Workspace Owner set a real logo or curriculum
   cover. "Upload file" reads the file client-side via FileReader into a
   data URL (works with no backend); "Paste URL" takes any image link.
   Either overrides the generated brand art from BrandMark / CourseCover.
   ========================================================================= */

/* =========================================================================
   WORKSPACE SETUP WIZARD (Value Stream 1: "Launch Learning Business")
   Business Basics → Branding → AI Persona → Publish trace.
   Runs OUTSIDE any academy's branding since no Workspace Session exists
   yet — this mirrors WE-004: Workspace Resolution happens before a
   branded experience can be shown at all.
   ========================================================================= */

/* =========================================================================
   ROOT APP
   ========================================================================= */

export default function App() {
  useFonts();
  const { t } = useLanguage();
  const { mode } = useTheme();

  /* Which surface renders is decided by the door you came through, not by a
     toggle — and you only reach this component at all once the API has
     confirmed you hold a role for that side in the selected Workspace. */
  const { side, me, workspace, session } = useAuth();
  const role = side === "teach" ? "owner" : "learner";

  const [learnerScreen, setLearnerScreen] = useState("dashboard");
  const [ownerScreen, setOwnerScreen] = useState("overview");
  const [profileOpen, setProfileOpen] = useState(false);
  // Which product Content Studio has open. Lives here, not inside the
  // screen, so a tutor can jump straight to a product's curriculum from its
  // row in Learning Products instead of picking it again from scratch.
  const [studioProductId, setStudioProductId] = useState(null);
  // Same idea for the Learner side: which course My Learnings has open, and
  // which lesson is currently open.
  const [learnerProductId, setLearnerProductId] = useState(null);
  const [learnerLessonId, setLearnerLessonId] = useState(null);
  // Bumped whenever the open lesson's completion status changes, so
  // LessonSidebar (a sibling, not a child, of LearnerLessonScreen) knows to
  // re-fetch and reflect it — see LearnerLessonScreen's onProgress prop.
  const [lessonProgressTick, setLessonProgressTick] = useState(0);

  /* The workspace description lives on the setup endpoint rather than in
     /api/me, so the shell fetches it once for the tagline. Absent is a normal
     state — a workspace need not describe itself — and the chrome simply
     omits the line rather than substituting anything. */
  const [description, setDescription] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getSetup(session.token, workspace.slug)
      .then((s) => { if (!cancelled) setDescription(s.description ?? ""); })
      .catch(() => { if (!cancelled) setDescription(""); });
    return () => { cancelled = true; };
  }, [session.token, workspace.slug]);

  /* The chrome, built from the real workspace and the real person signed in.
     This used to come from CONTENT — two fictional academies with invented
     names, taglines, mentors and colour schemes. A tutor saw "Lumen Language
     Academy · Learn to speak, not just study" above their own workspace. */
  const c = {
    name: workspace.name,
    tagline: description || "",
    mark: (workspace.name.trim()[0] || "W").toUpperCase(),
    logoStyle: "geometric",
    logoUrl: null,
  };

  /* Branding is not implemented (Technical Debt Backlog TD-006), so every
     workspace renders in the platform default. Inventing a palette per
     workspace would be another fiction, just a prettier one. Which of the
     four default palettes is role (Tutor/Student) × Light/Dark mode, mode
     owned by ThemeContext, role owned by which door (side) was entered. */
  const theme = role === "owner"
    ? (mode === "dark" ? TUTOR_DARK : TUTOR_LIGHT)
    : (mode === "dark" ? STUDENT_DARK : STUDENT_LIGHT);

  /* The person is whoever is actually signed in, and their label is the roles
     they actually hold here — not a fixture "Mentor" or "Instructor". */
  const personName = me?.fullName ?? "";
  const personRole = (workspace.roles ?? [])
    .map((r) => r.replace(/([a-z])([A-Z])/g, "$1 $2"))
    .join(", ") || "Member";

  useEffect(() => {
    setLearnerScreen("dashboard"); setOwnerScreen("overview"); setStudioProductId(null);
    setLearnerProductId(null); setLearnerLessonId(null);
  }, [role]);

  const activeNavScreen = role === "learner" ? learnerScreen : (ownerScreen === "studio" ? "studio" : ownerScreen);

  /* A sidebar link always goes to that section's top-level view, never a
     stale drill-down someone left it in — studioProductId/learnerProductId/
     learnerLessonId live here (not inside the screens) so a one-off "jump
     straight to X" action from elsewhere (e.g. Products' "Build curriculum"
     button) can preset them, but the nav itself must not inherit that. */
  function goToOwnerScreen(id) { setStudioProductId(null); setOwnerScreen(id); }
  function goToLearnerScreen(id) { setLearnerProductId(null); setLearnerLessonId(null); setLearnerScreen(id); }

  return (
    <div className={`lw-root lw-root--${role}`} style={theme}>
      <style>{CSS}</style>
      <AccountBar role={role} screen={learnerScreen} onNavigate={goToLearnerScreen} aiLabel={c.aiName || t("learnerNav.ai")}
        onOpenProfile={() => setProfileOpen(true)} />
      {/* The academy switcher and workspace wizard are gone: they moved between
          two fictional academies, which cannot coexist with a real signed-in
          workspace. */}
      {role === "learner" && <AcademyHeader c={c} />}
      <div className="lw-shell">
        {role === "owner" && (
          <Nav c={c} screen={activeNavScreen}
            personName={personName} personRole={personRole}
            setScreen={goToOwnerScreen}
            onOpenProfile={() => setProfileOpen(true)} />
        )}
        {/* Nothing occupies this slot for a Learner outside a lesson — primary
            navigation lives in the top bar (AccountBar/LearnerTopNav) now. */}
        {role === "learner" && learnerScreen === "lesson" && learnerLessonId && (
          <LessonSidebar
            productId={learnerProductId} lessonId={learnerLessonId}
            onOpenLesson={setLearnerLessonId} refreshToken={lessonProgressTick}
          />
        )}
        <div className="lw-content">
          {/* Learner screens. Only the home is real; the rest describe a
              curriculum that does not exist yet. */}
          {role === "learner" && learnerScreen === "dashboard" && (
            <LearnerHomeScreen
              onContinueLesson={(productId, lessonId) => {
                setLearnerProductId(productId);
                setLearnerLessonId(lessonId);
                setLearnerScreen("lesson");
              }}
            />
          )}
          {role === "learner" && learnerScreen === "courses" && (
            <LearnerCoursesScreen
              productId={learnerProductId}
              onSelectProduct={setLearnerProductId}
              onOpenLesson={(id) => { setLearnerLessonId(id); setLearnerScreen("lesson"); }}
            />
          )}
          {role === "learner" && learnerScreen === "lesson" && (
            learnerLessonId
              ? <LearnerLessonScreen
                  lessonId={learnerLessonId}
                  onBack={() => setLearnerScreen("courses")}
                  onProgress={() => setLessonProgressTick((t) => t + 1)}
                  onOpenAssistant={() => setLearnerScreen("ai")}
                  onOpenQuiz={() => setLearnerScreen("quiz")}
                  onOpenContent={() => setLearnerScreen("content")}
                  onOpenHomework={() => setLearnerScreen("homework")}
                  onOpenResources={() => setLearnerScreen("resources")}
                />
              : <NotBuiltYet area={t("notBuilt.lessonArea")} onNavigate={setLearnerScreen}
                  blurb={t("notBuilt.lessonBlurb")}
                  next={{ text: t("notBuilt.goToMyLearnings"), to: "courses" }} />
          )}
          {role === "learner" && learnerScreen === "quiz" && (
            <QuizScreen
              lessonId={learnerLessonId}
              onGoToLessons={() => goToLearnerScreen("courses")}
              onBackToLesson={learnerLessonId ? () => setLearnerScreen("lesson") : null}
            />
          )}
          {role === "learner" && learnerScreen === "content" && (
            <LessonContentScreen
              lessonId={learnerLessonId}
              onGoToLessons={() => goToLearnerScreen("courses")}
              onBackToLesson={learnerLessonId ? () => setLearnerScreen("lesson") : null}
            />
          )}
          {role === "learner" && learnerScreen === "homework" && (
            <HomeworkScreen
              lessonId={learnerLessonId}
              onGoToLessons={() => goToLearnerScreen("courses")}
              onBackToLesson={learnerLessonId ? () => setLearnerScreen("lesson") : null}
            />
          )}
          {role === "learner" && learnerScreen === "resources" && (
            <ResourcesScreen
              lessonId={learnerLessonId}
              onGoToLessons={() => goToLearnerScreen("courses")}
              onBackToLesson={learnerLessonId ? () => setLearnerScreen("lesson") : null}
            />
          )}
          {role === "learner" && learnerScreen === "assessments" && (
            <LearnerAssessmentsScreen
              onOpenLesson={(id) => { setLearnerLessonId(id); setLearnerScreen("lesson"); }}
            />
          )}
          {role === "learner" && learnerScreen === "certificates" && (
            <NotBuiltYet area={t("notBuilt.certificatesArea")} onNavigate={setLearnerScreen}
              blurb={t("notBuilt.certificatesBlurb")} />
          )}
          {role === "learner" && learnerScreen === "schedule" && (
            <NotBuiltYet area={t("notBuilt.scheduleArea")} onNavigate={setLearnerScreen}
              blurb={t("notBuilt.scheduleBlurbLearner")} />
          )}
          {role === "learner" && learnerScreen === "messages" && (
            <NotBuiltYet area={t("notBuilt.messagesArea")} onNavigate={setLearnerScreen}
              blurb={t("notBuilt.messagesBlurb")} />
          )}
          {role === "learner" && learnerScreen === "community" && (
            <NotBuiltYet area={t("notBuilt.communityArea")} onNavigate={setLearnerScreen}
              blurb={t("notBuilt.communityBlurb")} />
          )}
          {role === "learner" && learnerScreen === "ai" && (
            <AiAssistantScreen
              lessonId={learnerLessonId}
              onGoToLessons={() => goToLearnerScreen("courses")}
              onBackToLesson={learnerLessonId ? () => setLearnerScreen("lesson") : null}
              onOpenQuiz={() => setLearnerScreen("quiz")}
            />
          )}

          {/* Owner screens. Only overview, members and setup are real; the rest
              have no domain behind them yet and say so, rather than rendering
              fixture data as though it were this tutor's own academy. */}
          {role === "owner" && ownerScreen === "overview" && <WorkspaceHomeScreen onNavigate={setOwnerScreen} />}
          {role === "owner" && ownerScreen === "members" && <MembersScreen />}
          {role === "owner" && ownerScreen === "setup" && <WorkspaceSetupScreen />}
          {role === "owner" && ownerScreen === "billing" && <SubscriptionScreen />}

          {role === "owner" && ownerScreen === "products" && (
            <ProductsScreen onOpenStudio={(id) => { setStudioProductId(id); setOwnerScreen("studio"); }} />
          )}
          {role === "owner" && ownerScreen === "studio" && (
            <ContentStudioScreen productId={studioProductId} onSelectProduct={setStudioProductId} />
          )}
          {role === "owner" && ownerScreen === "scheduling" && (
            <NotBuiltYet area={t("notBuilt.scheduleArea")} onNavigate={setOwnerScreen}
              blurb={t("notBuilt.schedulingBlurbOwner")} />
          )}
          {role === "owner" && ownerScreen === "commerce" && (
            <NotBuiltYet area={t("notBuilt.commerceArea")} onNavigate={setOwnerScreen}
              blurb={t("notBuilt.commerceBlurb")} />
          )}
          {role === "owner" && ownerScreen === "communication" && (
            <NotBuiltYet area={t("notBuilt.messagesArea")} onNavigate={setOwnerScreen}
              blurb={t("notBuilt.communicationBlurbOwner")}
              next={{ text: t("notBuilt.inviteSomeone"), to: "members" }} />
          )}
          {role === "owner" && ownerScreen === "assessment" && (
            <AssessmentsOverviewScreen />
          )}
          {role === "owner" && ownerScreen === "settings" && (
            <NotBuiltYet area={t("notBuilt.settingsArea")} onNavigate={setOwnerScreen}
              blurb={t("notBuilt.settingsBlurb")}
              next={{ text: t("notBuilt.openWorkspaceSetup"), to: "setup" }} />
          )}
        </div>
      </div>
      {profileOpen && <ProfessionalProfile onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

/* =========================================================================
   CSS
   ========================================================================= */

const CSS = `
  .lw-root { font-family: var(--font-body); color: var(--ink); background: var(--bg); min-height: 100vh; display: flex; flex-direction: column; }
  .lw-root * { box-sizing: border-box; }

  .lw-accountbar { background: var(--bar-bg); color: var(--bar-ink); border-bottom: 1px solid var(--bar-line); font-family: var(--font-body); font-size: 12px; display: flex; align-items: center; gap: 10px; padding: 8px 18px; flex-wrap: wrap; }
  .lw-accountbar__side { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; background: var(--side-accent); color: #fff; border-radius: 20px; padding: 3px 9px; }
  .lw-accountbar__ws { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; }
  .lw-accountbar__roles { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .lw-accountbar__role { font-family: var(--font-mono); font-size: 10px; background: var(--bar-role-bg); color: var(--bar-role-ink); border-radius: 20px; padding: 2px 8px; }
  .lw-accountbar__spacer { flex: 1; }
  .lw-accountbar button { display: inline-flex; align-items: center; gap: 5px; background: transparent; border: 1px solid var(--bar-line); color: var(--ink-soft); border-radius: 7px; padding: 4px 10px; font-family: var(--font-body); font-size: 11.5px; cursor: pointer; }
  .lw-accountbar button:hover { color: var(--bar-ink); border-color: var(--bar-hover-line); }
  .lw-accountbar .lw-accountbar__who {
    background: transparent; border: 1px solid transparent; color: var(--ink-soft); padding: 4px 6px;
  }
  .lw-accountbar .lw-accountbar__who:hover { color: var(--bar-ink); border-color: var(--bar-line); }

  .lw-accountbar__navlinks { display: inline-flex; align-items: center; gap: 4px; }
  .lw-accountbar .lw-accountbar__navlink { border-color: transparent; }
  .lw-accountbar .lw-accountbar__navlink.is-active { color: var(--bar-active-ink); border-color: var(--bar-active-line); background: var(--bar-active-bg); }
  .lw-accountbar__more { position: relative; }
  .lw-accountbar__morepanel {
    position: absolute; top: calc(100% + 8px); inset-inline-start: 0; z-index: 41;
    width: 200px; overflow: hidden;
    background: var(--bar-bg); color: var(--bar-ink); border: 1px solid var(--bar-line); border-radius: 10px;
    box-shadow: 0 10px 30px var(--bar-panel-shadow);
    display: flex; flex-direction: column; padding: 6px;
  }
  .lw-accountbar .lw-accountbar__moreitem {
    display: flex; align-items: center; gap: 8px; width: 100%; text-align: start;
    background: transparent; border: none; color: var(--bar-ink); border-radius: 7px;
    padding: 8px 9px; font-family: var(--font-body); font-size: 12px; cursor: pointer;
  }
  .lw-accountbar__moreitem svg { color: var(--ink-soft); flex-shrink: 0; }
  .lw-accountbar .lw-accountbar__moreitem:hover { background: var(--bar-hover-bg); border-color: transparent; }
  .lw-accountbar .lw-accountbar__moreitem.is-active { background: var(--bar-active-bg); color: var(--bar-active-ink); border-color: transparent; }

  .lw-notifbell { position: relative; }
  .lw-accountbar .lw-notifbell__trigger {
    position: relative; padding: 5px; border-radius: 50%; border: 1px solid transparent;
  }
  .lw-accountbar .lw-notifbell__trigger:hover { border-color: var(--bar-line); }
  .lw-notifbell__badge {
    position: absolute; top: -3px; inset-inline-end: -3px;
    min-width: 15px; height: 15px; padding: 0 3px; border-radius: 50%;
    background: var(--danger); color: #fff;
    font-family: var(--font-mono); font-size: 9px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; line-height: 1;
  }
  .lw-notifbell__scrim { position: fixed; inset: 0; z-index: 40; }
  .lw-notifbell__panel {
    position: absolute; top: calc(100% + 8px); inset-inline-end: 0; z-index: 41;
    width: 320px; max-height: 380px; overflow-y: auto;
    background: var(--bar-bg); color: var(--bar-ink); border: 1px solid var(--bar-line); border-radius: 10px;
    box-shadow: 0 10px 30px var(--bar-panel-shadow);
  }
  .lw-notifbell__head {
    font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--ink-soft); padding: 12px 14px 8px;
  }
  .lw-notifbell__empty { font-size: 0.83rem; color: var(--ink-soft); padding: 6px 14px 16px; }
  .lw-notifbell__list { list-style: none; margin: 0; padding: 0 6px 6px; display: flex; flex-direction: column; gap: 2px; }
  .lw-notifbell__list li { padding: 9px 8px; border-radius: 8px; cursor: pointer; }
  .lw-notifbell__list li:hover { background: var(--bar-hover-bg); }
  .lw-notifbell__list li.is-unread { background: var(--bar-unread-bg); }
  .lw-notifbell__list li.is-unread:hover { background: var(--bar-unread-hover-bg); }
  .lw-notifbell__list strong { display: block; font-size: 0.85rem; }
  .lw-notifbell__list p { font-size: 0.8rem; color: var(--ink-soft); margin: 3px 0 5px; line-height: 1.45; }
  .lw-notifbell__time { font-family: var(--font-mono); font-size: 9.5px; color: var(--ink-soft); }

  .lw-controlstrip { background: #0D0F12; color: #C9CDD3; font-family: var(--font-mono); font-size: 11px; display: flex; align-items: center; gap: 20px; padding: 8px 18px; flex-wrap: wrap; border-bottom: 1px solid #000; }
  .lw-controlstrip__label { opacity: 0.65; letter-spacing: 0.04em; }
  .lw-controlstrip__group { display: flex; align-items: center; gap: 6px; }
  .lw-controlstrip__group span { opacity: 0.6; margin-inline-end: 2px; }
  .lw-controlstrip button { background: transparent; border: 1px solid #383D45; color: #C9CDD3; border-radius: 20px; padding: 3px 10px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; transition: all .15s; }
  .lw-controlstrip button.active { background: #C9CDD3; color: #0D0F12; border-color: #C9CDD3; }
  .lw-controlstrip__new { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: 1px dashed #4A5058 !important; color: #8FE3EA !important; border-radius: 20px; padding: 3px 10px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; }
  .lw-controlstrip__reset { margin-inline-start: auto; display: flex; align-items: center; gap: 5px; background: transparent; border: none; color: #8A8F97; cursor: pointer; font-family: var(--font-mono); font-size: 11px; }

  .lw-academyheader { display: flex; align-items: center; gap: 16px; padding: 20px 32px; width: 100%; background: linear-gradient(120deg, var(--accent), var(--accent-2)); box-shadow: inset 0 -1px 0 rgba(0,0,0,0.08); position: relative; }
  .lw-academyheader__mark { background: rgba(255,255,255,0.18); padding: 6px; border-radius: var(--radius-sm); display: flex; flex-shrink: 0; }
  .lw-academyheader__name { font-family: var(--font-display); font-weight: 700; font-size: 1.5rem; line-height: 1.15; color: #fff; }
  .lw-academyheader__tagline { font-size: 0.85rem; color: rgba(255,255,255,0.88); margin-top: 2px; }
  @media (max-width: 640px) { .lw-academyheader { padding: 16px 20px; } .lw-academyheader__name { font-size: 1.2rem; } }

  /* Composition-notebook touch: a perforated/torn edge where the coloured
     cover band meets the page, standing in for a spiral binding since the
     Student side has no persistent left sidebar to hang one off. */
  .lw-root--learner .lw-academyheader::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 10px;
    background-image: radial-gradient(circle at 10px 0, var(--bg) 4px, transparent 4.2px);
    background-size: 20px 10px; background-repeat: repeat-x; pointer-events: none;
  }

  .lw-shell { display: flex; flex: 1; min-height: 0; }
  .lw-content { flex: 1; overflow-y: auto; padding: 40px 48px 64px; position: relative; background-image: var(--page-texture, none); }
  /* Composition-notebook margin rule — a persistent line down the reading
     column, same idea as the red vertical rule on real notebook paper. */
  .lw-root--learner .lw-content::before {
    content: ""; position: absolute; top: 0; bottom: 0; inset-inline-start: 34px; width: 1.5px;
    background: var(--danger); opacity: 0.45; pointer-events: none;
  }
  .lw-page { max-width: 880px; margin: 0 auto; animation: lwFade .3s ease; }
  @keyframes lwFade { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
  @media (prefers-reduced-motion: reduce) { .lw-page { animation: none; } }

  /* UIC-004: a page or panel's own title (its eyebrow + h1, or a panel's h2)
     is centered — every such heading in this shared shell reads as one. Body
     copy underneath (.lw-sub, section dividers like h2.lw-sectiontitle) stays
     left-aligned; centering is for the header itself, not the page. */
  h1 { font-family: var(--font-display); font-weight: 600; font-size: 2rem; margin: 2px 0 6px; line-height: 1.15; text-align: center; }
  h2.lw-sectiontitle { font-family: var(--font-display); font-size: 1.2rem; margin: 36px 0 14px; font-weight: 600; }
  .lw-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; text-align: center; }
  .lw-sub { color: var(--ink-soft); font-size: 0.94rem; max-width: 62ch; margin-bottom: 22px; }

  .lw-nav { width: 250px; flex-shrink: 0; background: var(--nav-bg); color: var(--nav-text); display: flex; flex-direction: column; padding: 22px 16px; position: relative; }
  /* Leather-ledger touch: a stitched edge along the sidebar's inner border,
     standing in for a bound spine. Tutor side only — the Student side gets
     the perforated-page treatment on .lw-academyheader instead. */
  .lw-root--owner .lw-nav::after {
    content: ""; position: absolute; top: 14px; bottom: 14px; inset-inline-end: 8px; width: 1px;
    background-image: repeating-linear-gradient(to bottom, var(--accent-2) 0 5px, transparent 5px 10px);
    opacity: 0.5; pointer-events: none;
  }
  .lw-nav__brand { display: flex; gap: 10px; align-items: center; margin-bottom: 28px; }
  .lw-brandmark { flex-shrink: 0; border-radius: var(--radius-sm); overflow: hidden; display: flex; line-height: 0; }
  .lw-cover { width: 100%; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; }
  .lw-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lw-cover svg { display: block; }
  /* Bumped from 0.92rem and given a touch of letter-spacing (2026-08-15) —
     the Tutor's Caveat script and the Student's Kalam both get cramped on a
     workspace name at chrome-label size, and this label can't control how
     long that name is. Kept at .lw-nav (sidebar) scale, not shrunk further
     for any workspace with a long name. */
  .lw-nav__name { font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; line-height: 1.25; letter-spacing: 0.1px; }
  .lw-nav__tagline { font-size: 10.5px; opacity: 0.6; margin-top: 2px; }
  .lw-nav__items { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
  .lw-nav__divider { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.45; padding: 12px 12px 4px; }
  .lw-nav__item { display: flex; align-items: center; gap: 9px; background: transparent; border: none; color: var(--nav-text); opacity: 0.72; padding: 8px 12px; border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 0.84rem; cursor: pointer; text-align: start; transition: all .15s; }
  .lw-nav__item:hover { opacity: 1; background: rgba(255,255,255,0.06); }
  .lw-nav__item.is-active { opacity: 1; background: var(--accent); color: var(--on-accent, #fff); }
  .lw-nav__profile { display: flex; align-items: center; gap: 8px; background: transparent; border: 1px dashed rgba(255,255,255,0.25); color: var(--nav-text); opacity: 0.75; padding: 8px 10px; border-radius: var(--radius-sm); font-size: 0.75rem; cursor: pointer; margin: 6px 0; }
  .lw-nav__profile:hover { opacity: 1; }
  .lw-nav__person { display: flex; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.14); }
  /* color explicit (2026-08-15, WCAG pass) — otherwise inherits --nav-text
     from .lw-nav, which fails badly against --accent-2 in TUTOR_DARK/
     STUDENT_DARK (3.29:1 / 2.07:1). */
  .lw-nav__avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-2); color: var(--on-accent-2, #fff); display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 600; flex-shrink: 0; }
  .lw-nav__personname { font-size: 0.8rem; font-weight: 600; }
  .lw-nav__personrole { font-size: 0.7rem; opacity: 0.6; }

  /* The Learner side's left-sidebar slot, in-lesson only — fills the same
     .lw-shell column Nav does for the owner side, but light (a distinct
     "you're inside a lesson now" surface) rather than the dark app chrome. */
  .lw-lessonnav {
    width: 300px; flex-shrink: 0; overflow-y: auto;
    background: var(--surface); border-inline-end: 1px solid var(--line);
  }
  /* Bumped from 0.95rem, same reasoning as .lw-nav__name — a lesson title is
     also arbitrary-length user content, and the notebook script fonts need
     more room than a sans label would at this size (2026-08-15). */
  .lw-lessonnav__head {
    font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; letter-spacing: 0.1px;
    padding: 18px 16px 14px; border-bottom: 1px solid var(--line);
  }
  .lw-lessonnav__seqhint {
    display: flex; align-items: center; gap: 5px;
    font-size: 10px; color: var(--ink-soft); padding: 8px 16px;
    border-bottom: 1px solid var(--line);
  }
  .lw-lessonnav__unit { border-bottom: 1px solid var(--line); }
  .lw-lessonnav__unithead {
    width: 100%; display: flex; align-items: center; gap: 8px; text-align: start;
    background: transparent; border: none; cursor: pointer; padding: 12px 16px;
    font-family: var(--font-body); color: var(--ink);
  }
  .lw-lessonnav__unithead:hover { background: var(--surface-2); }
  .lw-lessonnav__chevron { flex-shrink: 0; color: var(--ink-soft); transition: transform 0.15s ease; }
  .lw-lessonnav__chevron.is-open { transform: rotate(180deg); }
  .lw-lessonnav__unittitle { flex: 1; font-weight: 600; font-size: 0.85rem; }
  .lw-lessonnav__unitmeta { font-family: var(--font-mono); font-size: 10px; color: var(--ink-soft); white-space: nowrap; }
  .lw-lessonnav__lessons { display: flex; flex-direction: column; background: var(--bg); }
  .lw-lessonnav__lessonrow {
    display: flex; align-items: center; gap: 8px; width: 100%; text-align: start;
    background: transparent; border: none; border-top: 1px solid var(--line); cursor: pointer;
    padding-block: 10px; padding-inline: 34px 16px; font-family: var(--font-body); color: var(--ink);
  }
  .lw-lessonnav__lessonrow:hover { background: var(--surface-2); }
  .lw-lessonnav__lessonrow.is-active {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
    border-inline-start: 3px solid var(--accent); padding-inline-start: 31px; cursor: default;
  }
  .lw-lessonnav__lessonrow svg { flex-shrink: 0; color: var(--ink-soft); }
  .lw-lessonnav__lessonrow svg.is-done { color: var(--accent-2); }
  .lw-lessonnav__lessonrow.is-locked { cursor: not-allowed; opacity: 0.55; }
  .lw-lessonnav__lessonrow.is-locked:hover { background: transparent; }
  .lw-lessonnav__lessontitle { flex: 1; font-size: 0.82rem; }
  .lw-lessonnav__lessonmins { font-family: var(--font-mono); font-size: 10px; color: var(--ink-soft); }

  .lw-btn { font-family: var(--font-body); font-weight: 600; font-size: 0.85rem; border-radius: var(--radius-sm); padding: 10px 16px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: transform .12s, box-shadow .12s; }
  .lw-btn:hover { transform: translateY(-1px); }
  .lw-btn--accent { background: var(--accent); border-color: var(--accent); color: var(--on-accent, #fff); }
  .lw-btn--ghost { background: transparent; }
  .lw-btn--sm { padding: 6px 12px; font-size: 0.78rem; }
  .lw-btn--lg { padding: 14px 24px; font-size: 0.95rem; margin-top: 24px; }

  .lw-greeting { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 30px; flex-wrap: wrap; }
  .lw-greeting p { color: var(--ink-soft); font-size: 0.9rem; max-width: 48ch; }

  .lw-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .lw-grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  @media (max-width: 900px) { .lw-grid3, .lw-grid2 { grid-template-columns: 1fr; } }

  /* .lw-card itself is not currently rendered by any screen — every screen
     defines its own scoped card class instead (.lw-learn__card,
     .lw-studio__card, .lw-lh__card, .lw-bill__entcard, and others). The
     notebook theme's dog-eared corner is added to those real classes
     directly, per screen — see e.g. LearnerHomeScreen.jsx, SubscriptionScreen.jsx.
     This base rule is left as found, in case something adopts it later. */
  .lw-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; position: relative; }
  .lw-card__eyebrow { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); margin-bottom: 10px; }
  .lw-card__title { font-family: var(--font-display); font-weight: 600; font-size: 1.1rem; margin-bottom: 4px; }
  .lw-card__meta { font-size: 0.8rem; color: var(--ink-soft); }
  .lw-stat { font-family: var(--font-display); font-size: 1.7rem; font-weight: 600; }
  .lw-coursecard { cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .lw-coursecard .lw-cover { margin: -20px -20px 0; width: calc(100% + 40px) !important; border-radius: var(--radius) var(--radius) 0 0; }
  .lw-coursecard:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.07); }

  [data-academy="lumen"] .lw-stampcard::after {
    content: "IN\\A PROGRESS"; white-space: pre; text-align: center; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.04em;
    position: absolute; top: 14px; inset-inline-end: 14px; width: 44px; height: 44px; border-radius: 50%;
    border: 1.5px dashed var(--accent); color: var(--accent); display: flex; align-items: center; justify-content: center; transform: rotate(8deg);
  }

  .lw-meter { display: flex; gap: 4px; margin: 8px 0; }
  .lw-meter span { width: 8px; height: 22px; background: var(--surface-2); border-radius: 2px; }
  .lw-meter span.filled { background: var(--accent-2); }
  .lw-progressbar { height: 6px; background: var(--surface-2); border-radius: 4px; margin: 10px 0 6px; overflow: hidden; }
  .lw-progressbar span { display: block; height: 100%; background: var(--accent-2); border-radius: 4px; }

  .lw-list { display: flex; flex-direction: column; gap: 8px; }
  .lw-listrow { display: flex; align-items: center; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 13px 16px; }
  .lw-listrow--new { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
  .lw-listrow--dim { opacity: 0.55; }
  .lw-tag--warn { background: #F0C040; color: #4A3A00; }
  .lw-tag--off { background: var(--line); color: var(--ink-soft); }
  .lw-eventlog { display: flex; flex-direction: column; gap: 5px; }
  .lw-eventlog__item { display: flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent-2); background: var(--surface-2); padding: 7px 12px; border-radius: var(--radius-sm); animation: lwFade .25s ease; }

  .lw-table__row--click { cursor: pointer; transition: background .12s; }
  .lw-table__row--click:hover { background: var(--surface-2); }

  .lw-aicard {
    display: flex; gap: 10px; align-items: flex-start;
    background: var(--callout-bg, color-mix(in srgb, var(--accent) 8%, var(--surface-2)));
    border: 1px solid var(--callout-line, color-mix(in srgb, var(--accent) 30%, var(--line)));
    border-radius: var(--radius-sm); padding: 12px 14px; margin: 14px 0; font-size: 0.85rem; color: var(--ink-soft);
  }
  .lw-aicard svg { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
  /* Sticky-note tilt — Student side only. The Tutor's ledger notes stay flat
     and formal; a tilted note reads as playful, which fits the composition
     notebook and not the leather ledger. */
  .lw-root--learner .lw-aicard { transform: rotate(-0.6deg); }
  .lw-aicard__body { flex: 1; }
  .lw-aicard__actions { display: flex; gap: 6px; flex-shrink: 0; }

  .lw-unitlist { display: flex; flex-direction: column; gap: 14px; }
  .lw-unitcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
  .lw-unitcard__head { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 600; font-size: 1rem; margin-bottom: 10px; }
  .lw-unitcard__remove { margin-inline-start: auto; background: transparent; border: none; color: var(--ink-soft); cursor: pointer; }

  .lw-inlineai { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 0.75rem; cursor: pointer; margin-inline-start: 8px; font-weight: 600; }
  .lw-imagepicker { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .lw-imagepicker .lw-inlineai { margin-inline-start: 0; }
  .lw-inlineai:disabled { opacity: 0.4; cursor: default; }
  .lw-inlineinput { padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: var(--font-body); background: var(--surface); font-size: 0.85rem; }
  .lw-rationale { display: flex; align-items: center; gap: 5px; font-size: 0.74rem; color: var(--accent-2); margin-top: 3px; font-style: italic; }
  .lw-rowactions__single { background: transparent; border: none; color: var(--ink-soft); cursor: pointer; padding: 4px; }
  .lw-listrow__icon { width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--accent); font-size: 0.8rem; font-weight: 600; }
  .lw-listrow__body { flex: 1; }
  .lw-listrow__title { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; }
  .lw-listrow__meta { font-size: 0.78rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-tag { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; background: var(--surface-2); padding: 2px 7px; border-radius: 20px; color: var(--ink-soft); }
  .lw-tag--new { background: var(--accent); color: var(--on-accent, #fff); }
  .lw-timestamp { font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft); background: var(--surface-2); }
  .lw-scorepill { font-family: var(--font-mono); font-weight: 600; font-size: 0.85rem; background: var(--surface-2); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--accent-2); }

  .lw-player { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; margin-bottom: 20px; }
  .lw-player__frame { background: linear-gradient(135deg, var(--ink), var(--accent-2)); color: var(--on-accent-2, #fff); height: 210px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; font-size: 0.85rem; opacity: 0.95; }
  .lw-videoplayer__youtube iframe { position: absolute; inset: 0; width: 100% !important; height: 100% !important; border: 0; }
  .lw-timeline { display: flex; gap: 18px; padding: 14px 18px; flex-wrap: wrap; border-top: 1px solid var(--line); }
  .lw-timeline__event { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--ink-soft); }
  .lw-timeline__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
  .lw-timeline__time { font-family: var(--font-mono); color: var(--ink); }

  .lw-questioncard__prompt { font-family: var(--font-display); font-size: 1.1rem; font-weight: 500; margin: 6px 0 16px; }
  .lw-options { display: flex; flex-direction: column; gap: 8px; }
  .lw-option { display: flex; justify-content: space-between; align-items: center; text-align: start; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg); cursor: pointer; font-family: var(--font-body); font-size: 0.9rem; transition: all .12s; }
  .lw-option:hover:not(:disabled) { border-color: var(--accent); }
  .lw-option.is-correct { border-color: var(--accent-2); background: color-mix(in srgb, var(--accent-2) 10%, var(--bg)); color: var(--accent-2); font-weight: 600; }
  .lw-option.is-wrong { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, var(--bg)); color: var(--danger); }
  .lw-feedback { display: flex; gap: 8px; align-items: flex-start; margin-top: 16px; padding: 12px 14px; background: var(--surface-2); border-radius: var(--radius-sm); font-size: 0.85rem; }

  .lw-chat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .lw-bubble { max-width: 70%; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.88rem; display: flex; gap: 8px; align-items: flex-start; }
  .lw-bubble--ai { background: var(--surface-2); align-self: flex-start; }
  .lw-bubble--user { background: var(--accent); color: var(--on-accent, #fff); align-self: flex-end; }
  .lw-bubble__avatar { width: 20px; height: 20px; border-radius: 50%; background: var(--accent-2); color: var(--on-accent-2, #fff); font-size: 0.7rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .lw-chatinput, .lw-composer { display: flex; gap: 8px; margin-top: 8px; }
  .lw-chatinput input, .lw-composer input { flex: 1; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: var(--font-body); background: var(--bg); }
  .lw-composer { margin-bottom: 16px; }

  .lw-dropzone { border: 2px dashed var(--line); border-radius: var(--radius); padding: 44px; text-align: center; color: var(--ink-soft); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 10px; transition: border-color .15s; background: var(--surface); }
  .lw-dropzone:hover { border-color: var(--accent); }
  .lw-dropzone__title { font-weight: 600; color: var(--ink); font-family: var(--font-body); }
  .lw-dropzone__meta { font-size: 0.78rem; }
  .lw-dropzone--compact { padding: 20px; margin-bottom: 4px; }
  .lw-videosource { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
  .lw-tag--source { background: color-mix(in srgb, var(--accent) 15%, var(--surface-2)); color: var(--accent); margin-inline-start: 6px; }

  .lw-principle { display: flex; gap: 10px; align-items: flex-start; background: var(--surface-2); border-radius: var(--radius-sm); padding: 13px 16px; font-size: 0.85rem; color: var(--ink-soft); margin-top: 20px; }
  .lw-principle strong { color: var(--ink); }

  .lw-analyzing { display: flex; gap: 20px; align-items: center; }
  .lw-analyzing__steps { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; }
  .lw-analyzing__steps li { display: flex; align-items: center; gap: 8px; color: var(--ink-soft); }
  .lw-analyzing__steps li.done { color: var(--accent-2); }
  .lw-analyzing__steps li.active { color: var(--accent); font-weight: 600; }

  .lw-spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--surface-2); border-top-color: var(--accent); animation: lwSpin .8s linear infinite; flex-shrink: 0; }
  @keyframes lwSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-spinner { animation-duration: 2.4s; } }

  .lw-stepper { display: flex; gap: 6px; margin-bottom: 22px; flex-wrap: wrap; }
  .lw-stepper__item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--ink-soft); padding: 5px 10px; border-radius: 20px; background: var(--surface-2); }
  .lw-stepper__item span { width: 16px; height: 16px; border-radius: 50%; background: var(--line); color: var(--ink-soft); font-size: 10px; display: flex; align-items: center; justify-content: center; }
  .lw-stepper__item.done { color: var(--accent-2); }
  .lw-stepper__item.done span { background: var(--accent-2); color: var(--on-accent-2, #fff); }
  .lw-stepper__item.active { color: var(--accent); font-weight: 600; background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); }
  .lw-stepper__item.active span { background: var(--accent); color: var(--on-accent, #fff); }

  .lw-titleinput { font-family: var(--font-display); font-weight: 600; font-size: 2rem; border: none; border-bottom: 2px dashed var(--line); background: transparent; width: 100%; padding: 4px 0; color: var(--ink); }
  .lw-titleinput:focus { outline: none; border-color: var(--accent); }
  .lw-objectives { margin: 4px 0 0; padding-inline-start: 20px; font-size: 0.9rem; color: var(--ink-soft); display: flex; flex-direction: column; gap: 6px; }
  .lw-questionrow.accepted { border-color: var(--accent-2); }
  .lw-questionrow.removed { opacity: 0.5; }
  .lw-rowactions { display: flex; gap: 4px; }
  .lw-rowactions button { width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
  .lw-rowactions button:hover { color: var(--ink); }
  .lw-rowactions button.active { background: var(--accent-2); border-color: var(--accent-2); color: var(--on-accent-2, #fff); }
  .lw-rowactions button.active.danger { background: var(--danger); border-color: var(--danger); }
  .lw-empty { color: var(--ink-soft); font-size: 0.88rem; padding: 24px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius); }

  .lw-table { border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
  .lw-table__row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding: 12px 16px; font-size: 0.86rem; background: var(--surface); border-bottom: 1px solid var(--line); }
  .lw-table__row:last-child { border-bottom: none; }
  .lw-table__row--head { background: var(--surface-2); font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); }

  .lw-badgegrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  .lw-badge { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px 14px; text-align: center; color: var(--ink-soft); display: flex; flex-direction: column; align-items: center; gap: 6px; opacity: 0.6; }
  .lw-badge.is-earned { opacity: 1; color: var(--ink); border-color: var(--accent-2); }
  .lw-badge.is-earned svg { color: var(--accent-2); }
  .lw-badge__name { font-weight: 600; font-size: 0.85rem; }
  .lw-badge__meta { font-size: 0.72rem; }

  .lw-settingsrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); }
  .lw-settingsrow:first-of-type { border-top: none; }
  .lw-settingsrow label { font-size: 0.82rem; color: var(--ink-soft); flex-shrink: 0; }
  .lw-settingsrow input { text-align: end; border: none; background: transparent; font-family: var(--font-body); font-size: 0.85rem; color: var(--ink); width: 60%; }
  .lw-settingsrow input:focus { outline: none; }
  .lw-swatchrow { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
  .lw-swatch { display: flex; gap: 8px; align-items: center; font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-soft); }
  .lw-swatch span { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--line); flex-shrink: 0; }

  .lw-widgetrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
  .lw-widgetrow:first-of-type { border-top: none; }
  .lw-widgetrow__label { font-size: 0.88rem; font-weight: 600; }
  .lw-widgetrow__consequence { font-size: 0.76rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-toggle { width: 40px; height: 22px; border-radius: 20px; background: var(--line); border: none; cursor: pointer; position: relative; flex-shrink: 0; transition: background .15s; }
  .lw-toggle span { position: absolute; top: 2px; inset-inline-start: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: inset-inline-start .15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  .lw-toggle.is-on { background: var(--accent-2); }
  .lw-toggle.is-on span { inset-inline-start: 20px; }

  .lw-overlay { position: fixed; inset: 0; background: rgba(10,12,15,0.55); display: flex; align-items: flex-start; justify-content: center; padding: 40px 20px; z-index: 50; overflow-y: auto; animation: lwFade .2s ease; }
  .lw-overlay__panel { background: #FAFAFA; color: #222; border-radius: 16px; max-width: 640px; width: 100%; padding: 32px 36px 40px; position: relative; font-family: 'IBM Plex Sans', sans-serif; }
  .lw-overlay__panel--wizard { max-width: 620px; }

  .lw-wizardsteps { display: flex; gap: 6px; margin: 18px 0 24px; flex-wrap: wrap; }
  .lw-wizardsteps__item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: #999; padding: 5px 10px; border-radius: 20px; background: #EFEFEC; }
  .lw-wizardsteps__item span { width: 16px; height: 16px; border-radius: 50%; background: #DDD; color: #999; font-size: 10px; display: flex; align-items: center; justify-content: center; }
  .lw-wizardsteps__item.done { color: #1E8E63; }
  .lw-wizardsteps__item.done span { background: #1E8E63; color: #fff; }
  .lw-wizardsteps__item.active { color: #2454C7; font-weight: 600; background: #E6ECFB; }
  .lw-wizardsteps__item.active span { background: #2454C7; color: #fff; }

  .lw-wizardbody { display: flex; flex-direction: column; gap: 14px; }
  .lw-wfield { display: flex; flex-direction: column; gap: 6px; }
  .lw-wfield label { font-size: 0.8rem; font-weight: 600; color: #444; display: flex; align-items: center; gap: 6px; }
  .lw-wfield input { padding: 10px 13px; border-radius: 8px; border: 1px solid #DDD; font-family: 'IBM Plex Sans', sans-serif; font-size: 0.9rem; background: #fff; }
  .lw-wfield input:focus { outline: 2px solid #2454C7; outline-offset: 1px; }

  .lw-segctrl { display: flex; gap: 6px; flex-wrap: wrap; }
  .lw-segctrl button { padding: 7px 14px; border-radius: 20px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 0.82rem; cursor: pointer; }
  .lw-segctrl button.active { background: var(--accent); border-color: var(--accent); color: var(--on-accent, #fff); }

  .lw-presetgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .lw-presetcard { border: 2px solid #E3E3E3; border-radius: 12px; padding: 14px; cursor: pointer; background: #fff; transition: border-color .12s; }
  .lw-presetcard.is-selected { border-color: #2454C7; }
  .lw-presetcard__swatches { display: flex; gap: 4px; margin-bottom: 10px; }
  .lw-presetcard__swatches span { width: 20px; height: 20px; border-radius: 5px; border: 1px solid rgba(0,0,0,0.08); }
  .lw-presetcard__label { font-weight: 600; font-size: 0.86rem; margin-bottom: 3px; }
  .lw-presetcard__desc { font-size: 0.74rem; color: #888; line-height: 1.35; }

  .lw-wizardnav { display: flex; justify-content: space-between; margin-top: 8px; }
  .lw-wizardsummary { display: flex; flex-direction: column; gap: 8px; background: #fff; border: 1px solid #E3E3E3; border-radius: 10px; padding: 14px 16px; font-size: 0.85rem; }
  .lw-wizardsummary div { display: flex; justify-content: space-between; gap: 12px; }
  .lw-wizardsummary span { color: #999; }
  .lw-eventtrace { display: flex; flex-direction: column; gap: 7px; margin: 16px 0; font-family: 'IBM Plex Mono', monospace; font-size: 0.82rem; }
  .lw-eventtrace__item { display: flex; align-items: center; gap: 8px; color: #AAA; transition: color .2s; }
  .lw-eventtrace__item.done { color: #1E8E63; }
  .lw-overlay__panel .lw-listrow, .lw-overlay__panel .lw-badge { background: #fff; border-color: #E3E3E3; }
  .lw-overlay__panel .lw-badge.is-earned { border-color: #1E8E63; }
  .lw-overlay__panel h1 { color: #1A1A1A; }
  .lw-overlay__close { position: absolute; top: 20px; inset-inline-end: 20px; background: transparent; border: none; cursor: pointer; color: #888; }
  .lw-idcard { display: flex; gap: 14px; align-items: center; background: #fff; border: 1px solid #E3E3E3; border-radius: 12px; padding: 16px; margin-bottom: 6px; }
  .lw-idcard__avatar { width: 44px; height: 44px; border-radius: 50%; background: #2454C7; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
  .lw-idcard__name { font-weight: 600; }
  .lw-idcard__meta { font-size: 0.8rem; color: #777; }

  button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  ${LANGUAGE_TOGGLE_CSS}
  ${THEME_TOGGLE_CSS}
`;

/* The person behind the membership, across the platform rather than inside one
   workspace. Identity Aggregate Design gives this a Professional Profile,
   Reputation and Professional History; none of that is built, so this shows the
   Identity that genuinely exists and says the rest is missing rather than
   inventing a portfolio. */
function ProfessionalProfile({ onClose }) {
  const { me, workspaces } = useAuth();
  const { t } = useLanguage();
  const active = workspaces.filter((w) => w.membershipStatus === "Active");

  return (
    <div className="lw-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lw-modal__panel" onClick={(e) => e.stopPropagation()}>
        <button className="lw-modal__close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="lw-eyebrow">{t("profile.yourAccount")}</div>
        <h2>{me?.fullName}</h2>
        <p className="lw-modal__sub">{me?.email}</p>

        <h3 className="lw-modal__h3">{t("profile.workspacesTitle")}</h3>
        <div className="lw-modal__list">
          {active.length === 0 && <p className="lw-modal__muted">{t("profile.none")}</p>}
          {active.map((w) => (
            <div className="lw-modal__row" key={w.workspaceId}>
              <strong>{w.name}</strong>
              <span>{w.roles.map((r) => r.replace(/([a-z])([A-Z])/g, "$1 $2")).join(", ")}</span>
            </div>
          ))}
        </div>

        <p className="lw-modal__muted">{t("profile.footer")}</p>
      </div>
    </div>
  );
}
