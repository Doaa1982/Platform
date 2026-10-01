import { useState, useEffect, useCallback } from "react";
import { useMediaQuery } from "usehooks-ts";
import {
  ArrowLeftRight, Award, BarChart3, BookOpen, Bell, Bot, Building2, CheckCircle2, ChevronDown, ClipboardCheck, GraduationCap, LayoutDashboard, ListChecks, Lock, LogOut, Menu, Pencil, PlayCircle, Receipt, Rocket, Settings, Sparkles, Users, Wand2, Zap
} from "lucide-react";
import { useAuth } from "./auth/authContext";
import { SIDES, rolesMatchSide } from "./auth/sides";
import { useFonts } from "./hooks/useFonts";
import { useLanguage } from "./i18n/useLanguage";
import LanguageToggle from "./i18n/LanguageToggle";
import { useTheme } from "./theme/useTheme";
import ThemeToggle from "./theme/ThemeToggle";
import TrialGiftModal from "./components/TrialGiftModal";
import { useDismissedTip } from "./hooks/useDismissedTip";
import MembersScreen from "./screens/MembersScreen";
import CourseEnrollmentScreen from "./screens/CourseEnrollmentScreen";
import WorkspaceSetupScreen from "./screens/WorkspaceSetupScreen";
import WorkspaceHomeScreen from "./screens/WorkspaceHomeScreen";
import NotBuiltYet from "./screens/NotBuiltYet";
import ProductsScreen from "./screens/ProductsScreen";
import SubscriptionScreen, { PlansScreen, AiCreditsScreen } from "./screens/SubscriptionScreen";
import ContentStudioScreen, { LessonEditorScreen } from "./screens/ContentStudioScreen";
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
import AssignmentsOverviewScreen from "./screens/AssignmentsOverviewScreen";
import LearnerAssignmentsScreen from "./screens/LearnerAssignmentsScreen";
import AssignmentSubmissionScreen from "./screens/AssignmentSubmissionScreen";
import * as api from "./api/client";
import { paletteFor } from "./theme/palettes";
import { formatDateActive, roleLabel } from "./i18n/format";
import { APP_CSS } from "./styles/appCss";
import { ACCOUNTBAR_COMPACT_PX, NAV_BREAKPOINT_PX } from "./styles/breakpoints";
import { useAssetUrl } from "./hooks/useAssetUrl";

/* Single breakpoint the app shell collapses at — shared between the JS
   media-query check (drawer open/close logic) and the CSS block below, so
   the two can never drift apart. Below this width the owner sidebar becomes
   an off-canvas drawer instead of a static column. */
const NAV_BREAKPOINT_QUERY = `(max-width: ${NAV_BREAKPOINT_PX}px)`;

/* AccountBar packs a lot in one row (nav links or workspace name, language
   toggle, theme toggle, bell, account name, sign out) — plain CSS wrapping
   left it splitting into two visually disjointed rows well before a phone's
   actual width runs out. This is the point it switches to compact labels
   (icons/initials instead of full text) to stay one row instead. */
const ACCOUNTBAR_COMPACT_QUERY = `(max-width: ${ACCOUNTBAR_COMPACT_PX}px)`;

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
                    <span className="lw-notifbell__time">{formatDateActive(n.createdAt)}</span>
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

function AccountBar({ role, screen, onNavigate, aiLabel, onToggleNav }) {
  const { me, side, workspace, workspaces, eligibleWorkspaces, leaveWorkspace, signOut } = useAuth();
  const { t } = useLanguage();
  // Below this, full labels (workspace roles, account name, "Sign out" text)
  // give way to icons/initials so the bar stays one row instead of visibly
  // splitting into two — see ACCOUNTBAR_COMPACT_PX's own comment.
  const compact = useMediaQuery(ACCOUNTBAR_COMPACT_QUERY);
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
      {/* Opens the off-canvas sidebar drawer — CSS hides this above
          NAV_BREAKPOINT_PX, where the sidebar is a static column instead. */}
      {onToggleNav && (
        <button className="lw-accountbar__hamburger" onClick={onToggleNav} aria-label={t("nav.toggleMenu")}>
          <Menu size={18} />
        </button>
      )}
      {/* TEACHING/LEARNING side pill hidden for now. */}
      {role === "owner" && (
        <>
          <span className="lw-accountbar__ws">
            <Building2 size={13} /> {workspace.name}
          </span>
          {/* Repeated on the person's own row in the sidebar (now behind the
              hamburger at this width) — secondary enough to drop first. */}
          {!compact && (
            <span className="lw-accountbar__roles">
              {workspace.roles.map((r) => (
                <span className="lw-accountbar__role" key={r}>{roleLabel(t, r)}</span>
              ))}
            </span>
          )}
        </>
      )}
      {/* The workspace's own name/branding already reads immediately below,
          in AcademyHeader's banner — repeating it here would just be the
          same claim twice. Primary navigation lives here instead. */}
      {role === "learner" && <LearnerTopNav screen={screen} onNavigate={onNavigate} aiLabel={aiLabel} compact={compact} />}
      <span className="lw-accountbar__spacer" />
      <LanguageToggle compact={compact} />
      <ThemeToggle />
      <NotificationBell />
      <AccountMenu
        me={me}
        canSwitchSide={canSwitchSide}
        switchSideLabel={t(`sides.${otherKey}.label`)}
        onSwitchSide={() => { window.history.pushState({}, "", other.path); window.dispatchEvent(new PopStateEvent("popstate")); }}
        canSwitchWorkspace={eligibleWorkspaces.length > 1}
        onSwitchWorkspace={leaveWorkspace}
        onSignOut={signOut}
      />
    </div>
  );
}

/* A single, familiar avatar-trigger dropdown (same scrim+panel affordance as
   NotificationBell and the "More" nav menu) replacing what used to be up to
   four separate, disconnected controls (name pill, switch-side, switch-
   workspace, sign out) crowding the bar. Avatar+name read clearly at any
   width, so this needs none of AccountBar's own compact-mode branching. */
function AccountMenu({ me, canSwitchSide, switchSideLabel, onSwitchSide, canSwitchWorkspace, onSwitchWorkspace, onSignOut }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const name = (me?.fullName || "?").trim();
  const initial = name[0]?.toUpperCase() || "?";
  const hasExtras = canSwitchSide || canSwitchWorkspace;

  return (
    <span className="lw-accountmenu">
      <button
        className="lw-accountmenu__trigger" onClick={() => setOpen((v) => !v)}
        aria-label={t("accountbar.myAccount")} aria-haspopup="true" aria-expanded={open}
      >
        <span className="lw-accountmenu__avatar">{initial}</span>
        <span className="lw-accountmenu__name">{name}</span>
        <ChevronDown size={12} className="lw-accountmenu__chev" />
      </button>
      {open && (
        <>
          <div className="lw-notifbell__scrim" onClick={() => setOpen(false)} />
          <div className="lw-accountmenu__panel">
            <div className="lw-accountmenu__id">
              <span className="lw-accountmenu__avatar lw-accountmenu__avatar--lg">{initial}</span>
              <span className="lw-accountmenu__idtext">
                <span className="lw-accountmenu__idname">{name}</span>
                {me?.email && <span className="lw-accountmenu__idemail">{me.email}</span>}
              </span>
            </div>
            {hasExtras && <div className="lw-accountmenu__divider" />}
            {canSwitchSide && (
              <button className="lw-accountmenu__item" onClick={() => { onSwitchSide(); setOpen(false); }}>
                <ArrowLeftRight size={14} /> {switchSideLabel}
              </button>
            )}
            {canSwitchWorkspace && (
              <button className="lw-accountmenu__item" onClick={() => { onSwitchWorkspace(); setOpen(false); }}>
                <Building2 size={14} /> {t("accountbar.switchWorkspace")}
              </button>
            )}
            <div className="lw-accountmenu__divider" />
            <button className="lw-accountmenu__item lw-accountmenu__item--danger" onClick={onSignOut}>
              <LogOut size={14} /> {t("accountbar.signOut")}
            </button>
          </div>
        </>
      )}
    </span>
  );
}

/* Dashboard and My Learnings as direct links; everything else (Assessments,
   Certificates, Schedule, Messages, Community, AI) behind "More" — keeps the
   top bar uncluttered while still giving every section a reachable home,
   now that the left sidebar is reserved for in-lesson Course content. */
function LearnerTopNav({ screen, onNavigate, aiLabel, compact }) {
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = LEARNER_NAV.filter((it) => PRIMARY_LEARNER_NAV.includes(it.id));
  const more = LEARNER_NAV.filter((it) => !PRIMARY_LEARNER_NAV.includes(it.id));
  const moreActive = more.some((it) => it.id === screen);

  return (
    <span className="lw-accountbar__navlinks">
      {primary.map((it) => {
        const label = it.id === "courses" ? t("learnerNav.myLearnings") : t(it.labelKey);
        return (
          <button
            key={it.id}
            className={`lw-accountbar__navlink ${screen === it.id ? "is-active" : ""}`}
            data-nav-id={it.id}
            onClick={() => onNavigate(it.id)}
            aria-label={label}
          >
            {compact ? <it.icon size={16} /> : label}
          </button>
        );
      })}
      <span className="lw-accountbar__more">
        <button
          data-nav-more=""
          className={`lw-accountbar__navlink ${moreActive ? "is-active" : ""}`}
          onClick={() => setMoreOpen((v) => !v)}
        >
          {compact ? <ChevronDown size={14} /> : <>{t("learnerNav.more")} <ChevronDown size={12} /></>}
        </button>
        {moreOpen && (
          <>
            <div className="lw-notifbell__scrim" onClick={() => setMoreOpen(false)} />
            <div className="lw-accountbar__morepanel">
              {more.map((it) => (
                <button
                  key={it.id}
                  className={`lw-accountbar__moreitem ${screen === it.id ? "is-active" : ""}`}
                  data-nav-id={it.id}
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
      <div className="lw-academyheader__inner">
        <div className="lw-academyheader__mark"><BrandMark c={c} size={42} /></div>
        <div className="lw-academyheader__text">
          <div className="lw-academyheader__name">{c.name}</div>
          {c.tagline && <div className="lw-academyheader__tagline">{c.tagline}</div>}
        </div>
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
  { id: "assignments", labelKey: "learnerNav.assignments", icon: ListChecks },
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
  { id: "editLesson", labelKey: "nav.editLesson", icon: Pencil },
  { dividerKey: "nav.operate" },
  { id: "members", labelKey: "nav.members", icon: Users },
  { id: "enrollment", labelKey: "nav.enrollment", icon: GraduationCap },
  // Scheduling / Commerce / Communication hidden for now.
  // { id: "scheduling", labelKey: "nav.scheduling", icon: Calendar },
  // { id: "commerce", labelKey: "nav.commerce", icon: CreditCard },
  // { id: "communication", labelKey: "nav.communication", icon: Megaphone },
  { dividerKey: "nav.prove" },
  { id: "assessment", labelKey: "nav.assessmentCertificates", icon: Award },
  { id: "assignments", labelKey: "nav.assignments", icon: ListChecks },
  { dividerKey: "nav.configure" },
  // The real Workspace lifecycle, above the prototype's settings panel
  { id: "setup", labelKey: "nav.workspaceSetup", icon: Rocket },
  // This Workspace's own subscription to the platform — distinct from the
  // still-unbuilt "commerce" item above, which is what this tutor charges
  // *their* students, not what they pay the platform.
  { id: "billing", labelKey: "nav.billing", icon: Receipt },
  // Buying add-ons or upgrading plan — kept as its own nav destination
  // rather than a button off Billing, so it stays reachable regardless of
  // the subscription's status (e.g. a Pending first checkout).
  { id: "plans", labelKey: "nav.plans", icon: Sparkles },
  // A one-time consumable top-up, not a recurring plan/pack change — its
  // own nav item rather than a button tucked inside Add-ons, same reasoning
  // as Plans getting its own item instead of living inside Billing.
  { id: "aiCredits", labelKey: "nav.aiCredits", icon: Zap },
  { id: "settings", labelKey: "nav.workspaceSettings", icon: Settings },
];

/* Owner/tutor side only now — the Learner side's primary nav lives in the
   top bar (LearnerTopNav) and its left-sidebar slot is reserved for the
   in-lesson Course content menu (LessonSidebar) while viewing a lesson,
   and empty everywhere else. */
function Nav({ c, screen, setScreen, personName, personRole, open }) {
  const { t } = useLanguage();
  return (
    <div className={`lw-nav ${open ? "is-open" : ""}`}>
      <div className="lw-nav__brand">
        <BrandMark c={c} size={34} />
        <div>
          <div className="lw-nav__name" dir="auto">{c.name}</div>
          <div className="lw-nav__tagline" dir="auto">{c.tagline}</div>
        </div>
      </div>
      <div className="lw-nav__items">
        {OWNER_NAV.map((it, i) =>
          it.dividerKey ? (
            <div className="lw-nav__divider" key={`d${i}`}>{t(it.dividerKey)}</div>
          ) : (
            <button
              key={it.id}
              data-nav-id={it.id}
              className={`lw-nav__item ${screen === it.id ? "is-active" : ""}`}
              onClick={() => setScreen(it.id)}
            >
              <it.icon size={16} />
              {t(it.labelKey)}
            </button>
          )
        )}
      </div>
      {/* Hidden for now — not ready to surface yet. */}
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

  const allLessons = curriculum.units.flatMap((u) => u.lessons || []);
  const totalLessons = allLessons.length;
  const totalDone = allLessons.filter((l) => l.progressStatus === "Completed").length;
  const progressPercent = totalLessons > 0 ? Math.round((totalDone / totalLessons) * 100) : 0;

  return (
    <div className="lw-lessonnav">
      <div className="lw-lessonnav__header-block">
        <div className="lw-lessonnav__head">{t("lessonSidebar.courseContent")}</div>
        {totalLessons > 0 && (
          <div className="lw-lessonnav__progress">
            <div className="lw-lessonnav__progress-text">
              <span>{totalDone}/{totalLessons} {t("learnerCourses.completed")}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="lw-lessonnav__progressbar">
              <div className="lw-lessonnav__progressfill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
      </div>

      {curriculum.requiresSequentialCompletion && (
        <div className="lw-lessonnav__seqhint">
          <Lock size={12} />
          <span>{t("lessonSidebar.seqHint")}</span>
        </div>
      )}

      <div className="lw-lessonnav__units">
        {curriculum.units.map((u, i) => {
          const open = openUnits.has(u.position);
          const doneCount = u.lessons.filter((l) => l.progressStatus === "Completed").length;
          const mins = u.lessons.reduce((sum, l) => sum + (l.estimatedMinutes ?? 0), 0);
          const unitAllDone = u.lessons.length > 0 && doneCount === u.lessons.length;

          return (
            <div className="lw-lessonnav__unit" key={u.position}>
              <button type="button" className={`lw-lessonnav__unithead ${open ? "is-open" : ""}`} onClick={() => toggleUnit(u.position)}>
                <ChevronDown size={14} className={`lw-lessonnav__chevron ${open ? "is-open" : ""}`} />
                <span className="lw-lessonnav__unittitle">
                  <span className="lw-lessonnav__unitnum">{i + 1}.</span> {u.title}
                </span>
                <span className="lw-lessonnav__unitmeta">
                  {unitAllDone ? (
                    <span className="lw-lessonnav__unitdonebadge">
                      <CheckCircle2 size={11} /> {doneCount}/{u.lessons.length}
                    </span>
                  ) : (
                    `${doneCount}/${u.lessons.length}`
                  )}
                  {mins > 0 ? ` · ${mins}${t("lessonSidebar.min")}` : ""}
                </span>
              </button>
              {open && (
                <div className="lw-lessonnav__lessons">
                  {u.lessons.map((l) => {
                    const active = l.id === lessonId;
                    const lessonDone = l.progressStatus === "Completed";
                    return (
                      <button
                        type="button" key={l.id}
                        className={`lw-lessonnav__lessonrow ${active ? "is-active" : ""} ${lessonDone ? "is-done" : ""} ${l.locked ? "is-locked" : ""}`}
                        disabled={l.locked}
                        title={l.locked ? t("lessonSidebar.lockedTitle") : undefined}
                        onClick={() => !active && !l.locked && onOpenLesson?.(l.id)}
                      >
                        <span className="lw-lessonnav__iconwrap">
                          {lessonDone ? (
                            <CheckCircle2 size={15} className="is-done" />
                          ) : l.locked ? (
                            <Lock size={14} className="is-locked" />
                          ) : active ? (
                            <PlayCircle size={15} className="is-active" />
                          ) : (
                            <PlayCircle size={15} className="is-ready" />
                          )}
                        </span>
                        <span className="lw-lessonnav__lessontitle">{l.title}</span>
                        {l.estimatedMinutes != null && (
                          <span className="lw-lessonnav__lessonmins">{l.estimatedMinutes}{t("lessonSidebar.min")}</span>
                        )}
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
  // The owner sidebar as an off-canvas drawer below NAV_BREAKPOINT_PX.
  // navOpen alone doesn't decide anything visible — it's always gated by
  // isNarrow at the point of use, so a stale `true` left over from a resize
  // can never make the drawer (or its backdrop) appear at desktop width.
  const isNarrow = useMediaQuery(NAV_BREAKPOINT_QUERY);
  const [navOpen, setNavOpen] = useState(false);
  const navDrawerOpen = navOpen && isNarrow;
  useEffect(() => {
    document.body.style.overflow = navDrawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [navDrawerOpen]);
  // Which tab Members should land on next time it mounts — set by
  // navigation actions elsewhere (e.g. the dashboard's "Invite" quick
  // action) that mean "go straight to Create Invitation", not just "Members".
  const [membersInitialTab, setMembersInitialTab] = useState(null);
  // Bumped on every navigation to Members so it remounts fresh even when
  // already on that screen (e.g. Invite -> Members again) — setOwnerScreen
  // to the same value doesn't remount on its own, and initialTab is only
  // honored on mount.
  const [membersKey, setMembersKey] = useState(0);
  // Which product Content Studio has open. Lives here, not inside the
  // screen, so a tutor can jump straight to a product's curriculum from its
  // row in Learning Products instead of picking it again from scratch.
  const [studioProductId, setStudioProductId] = useState(null);
  // Same idea for the Learner side: which course My Learnings has open, and
  // which lesson is currently open.
  const [learnerProductId, setLearnerProductId] = useState(null);
  const [learnerLessonId, setLearnerLessonId] = useState(null);
  const [learnerAssignment, setLearnerAssignment] = useState(null); // { lessonId, activityId }
  // Bumped whenever the open lesson's completion status changes, so
  // LessonSidebar (a sibling, not a child, of LearnerLessonScreen) knows to
  // re-fetch and reflect it — see LearnerLessonScreen's onProgress prop.
  const [lessonProgressTick, setLessonProgressTick] = useState(0);

  /* The workspace description and branding live on the setup endpoint rather
     than in /api/me, so the shell fetches it once for the tagline/logo. Absent
     is a normal state — a workspace need not describe or brand itself — and
     the chrome simply omits the line/falls back to the monogram rather than
     substituting anything. */
  const [description, setDescription] = useState(null);
  const [logoAssetId, setLogoAssetId] = useState(null);
  // Short-lived, asset-scoped URL for the workspace logo — never the session token in an <img> URL.
  const logoAccess = useAssetUrl(session.token, workspace.slug, logoAssetId);

  useEffect(() => {
    let cancelled = false;
    api.getSetup(session.token, workspace.slug)
      .then((s) => {
        if (cancelled) return;
        setDescription(s.description ?? "");
        setLogoAssetId(s.logoAssetId ?? null);
      })
      .catch(() => { if (!cancelled) { setDescription(""); setLogoAssetId(null); } });
    return () => { cancelled = true; };
  }, [session.token, workspace.slug]);

  /* Welcome-gift trial credits (Documents/AICreditsCommercialContractAndImplementationPlan.md
     §A7): a one-time 200-credit grant every workspace gets on its first
     subscription, invisible until now — folded into one flat "remaining"
     number. Announced once via TrialGiftModal, gated the same shown-once
     way TutorTip already is (useDismissedTip) rather than a new backend
     "first login" flag: the trial balance is already self-limiting (30 days,
     or an earlier free→paid conversion, §A4), so there's nothing left to
     show past that point even if this were somehow never dismissed. Skips
     the fetch entirely once dismissed — no need to ask the API again. Owner
     side only: AI credits are a tutor/workspace billing concept. */
  const [dismissedTrialGift, dismissTrialGift] = useDismissedTip(`trialGift:${workspace.slug}`);
  const [trialCreditsRemaining, setTrialCreditsRemaining] = useState(0);
  useEffect(() => {
    if (role !== "owner" || dismissedTrialGift) return;
    let cancelled = false;
    api.getSubscription(session.token, workspace.slug)
      .then((s) => { if (!cancelled) setTrialCreditsRemaining(s?.aiCreditsTrialRemaining ?? 0); })
      .catch(() => { if (!cancelled) setTrialCreditsRemaining(0); });
    return () => { cancelled = true; };
  }, [role, dismissedTrialGift, session.token, workspace.slug]);

  /* The chrome, built from the real workspace and the real person signed in.
     This used to come from CONTENT — two fictional academies with invented
     names, taglines, mentors and colour schemes. A tutor saw "Lumen Language
     Academy · Learn to speak, not just study" above their own workspace. */
  const c = {
    name: workspace.name,
    tagline: description || "",
    mark: (workspace.name.trim()[0] || "W").toUpperCase(),
    logoStyle: "geometric",
    logoUrl: logoAccess.url,
  };

  /* Branding is not implemented (Technical Debt Backlog TD-006), so every
     workspace renders in the platform default. Inventing a palette per
     workspace would be another fiction, just a prettier one. Which of the
     four default palettes is role (Tutor/Student) × Light/Dark mode, mode
     owned by ThemeContext, role owned by which door (side) was entered. */
  const theme = paletteFor(role, mode);

  /* The person is whoever is actually signed in, and their label is the roles
     they actually hold here — not a fixture "Mentor" or "Instructor". */
  const personName = me?.fullName ?? "";
  const personRole = (workspace.roles ?? [])
    .map((r) => roleLabel(t, r))
    .join(t("picker.roleSeparator")) || t("roles.member");

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
  function goToOwnerScreen(id, opts) {
    setStudioProductId(null);
    setOwnerScreen(id);
    // Reset whenever navigating without an explicit tab too, so a plain
    // sidebar click to Members doesn't inherit a stale "go to Create" from
    // an earlier Invite action.
    setMembersInitialTab(opts?.membersTab ?? null);
    if (id === "members") setMembersKey((k) => k + 1);
    setNavOpen(false);
  }
  function goToLearnerScreen(id) { setLearnerProductId(null); setLearnerLessonId(null); setLearnerScreen(id); }

  return (
    <div className={`lw-root lw-root--${role}`} style={theme}>
      <style>{APP_CSS}</style>
      {!dismissedTrialGift && trialCreditsRemaining > 0 && (
        <TrialGiftModal trialRemaining={trialCreditsRemaining} onDismiss={dismissTrialGift} />
      )}
      <AccountBar role={role} screen={learnerScreen} onNavigate={goToLearnerScreen} aiLabel={c.aiName || t("learnerNav.ai")}
        onToggleNav={role === "owner" ? () => setNavOpen((v) => !v) : null} />
      {/* The academy switcher and workspace wizard are gone: they moved between
          two fictional academies, which cannot coexist with a real signed-in
          workspace. */}
      {role === "learner" && <AcademyHeader c={c} />}
      <div className="lw-shell">
        {role === "owner" && navDrawerOpen && (
          <div className="lw-navbackdrop" onClick={() => setNavOpen(false)} />
        )}
        {role === "owner" && (
          <Nav c={c} screen={activeNavScreen}
            personName={personName} personRole={personRole}
            setScreen={goToOwnerScreen}
            open={navDrawerOpen} />
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
                  onOpenAssignments={() => setLearnerScreen("assignments")}
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
          {role === "learner" && learnerScreen === "assignments" && (
            <LearnerAssignmentsScreen
              onOpenAssignment={(lessonId, activityId) => { setLearnerAssignment({ lessonId, activityId }); setLearnerScreen("assignmentSubmission"); }}
            />
          )}
          {role === "learner" && learnerScreen === "assignmentSubmission" && learnerAssignment && (
            <AssignmentSubmissionScreen
              lessonId={learnerAssignment.lessonId} activityId={learnerAssignment.activityId}
              onBack={() => setLearnerScreen("assignments")}
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
          {role === "owner" && ownerScreen === "overview" && <WorkspaceHomeScreen onNavigate={goToOwnerScreen} />}
          {role === "owner" && ownerScreen === "members" && <MembersScreen key={membersKey} initialTab={membersInitialTab} />}
          {role === "owner" && ownerScreen === "enrollment" && <CourseEnrollmentScreen />}
          {role === "owner" && ownerScreen === "setup" && <WorkspaceSetupScreen />}
          {role === "owner" && ownerScreen === "billing" && <SubscriptionScreen />}
          {role === "owner" && ownerScreen === "plans" && <PlansScreen />}
          {role === "owner" && ownerScreen === "aiCredits" && <AiCreditsScreen />}

          {role === "owner" && ownerScreen === "products" && (
            <ProductsScreen onOpenStudio={(id) => { setStudioProductId(id); setOwnerScreen("studio"); }} />
          )}
          {role === "owner" && ownerScreen === "studio" && (
            <ContentStudioScreen productId={studioProductId} onSelectProduct={setStudioProductId} />
          )}
          {role === "owner" && ownerScreen === "editLesson" && <LessonEditorScreen />}
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
          {role === "owner" && ownerScreen === "assignments" && (
            <AssignmentsOverviewScreen />
          )}
          {role === "owner" && ownerScreen === "settings" && (
            <NotBuiltYet area={t("notBuilt.settingsArea")} onNavigate={setOwnerScreen}
              blurb={t("notBuilt.settingsBlurb")}
              next={{ text: t("notBuilt.openWorkspaceSetup"), to: "setup" }} />
          )}
        </div>
      </div>
    </div>
  );
}



