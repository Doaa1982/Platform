import { useState, useEffect } from "react";
import {
  ArrowLeftRight, Award, BarChart3, BookOpen, Bot, Building2, Calendar, ClipboardCheck, CreditCard, LayoutDashboard, Megaphone, MessageCircle, MessageSquare, PlayCircle, Rocket, Settings, UserCircle, Users, Wand2, X
} from "lucide-react";
import { useAuth } from "./auth/authContext";
import { SIDES, rolesMatchSide } from "./auth/sides";
import { useFonts } from "./hooks/useFonts";
import MembersScreen from "./screens/MembersScreen";
import WorkspaceSetupScreen from "./screens/WorkspaceSetupScreen";
import WorkspaceHomeScreen from "./screens/WorkspaceHomeScreen";
import NotBuiltYet from "./screens/NotBuiltYet";
import ProductsScreen from "./screens/ProductsScreen";
import ContentStudioScreen from "./screens/ContentStudioScreen";
import LearnerHomeScreen from "./screens/LearnerHomeScreen";
import * as api from "./api/client";

/* =========================================================================
   TOKEN SYSTEMS — one per Academy (Learning Workspace).
   Every business capability below renders through the SAME components,
   driven entirely by these tokens + the CONTENT data. That is the concrete
   proof of "Branded Experience" / "Workspace-Native AI" as architected.
   ========================================================================= */

/* The platform default palette. Per-workspace branding is not implemented
   (Technical Debt Backlog TD-006); this replaces the two fixture academy
   themes, which dressed every workspace as somebody else's brand. */
const DEFAULT_THEME = {
  "--bg": "#F7F5F1", "--surface": "#FFFFFF", "--surface-2": "#EFEDE8",
  "--ink": "#1B2430", "--ink-soft": "#6A7383", "--accent": "#2D5BD1",
  "--accent-2": "#1E7F63", "--line": "#E1DED7", "--danger": "#B3382B",
  "--radius": "14px", "--radius-sm": "10px",
  "--nav-bg": "#1B2430", "--nav-text": "#F2F5FA",
  "--font-display": "'Fraunces', Georgia, serif",
  "--font-body": "'Karla', system-ui, sans-serif",
  "--font-mono": "'IBM Plex Mono', monospace",
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

function AccountBar() {
  const { me, side, workspace, workspaces, eligibleWorkspaces, leaveWorkspace, signOut } = useAuth();
  if (!workspace) return null;

  const config = SIDES[side];
  const other = SIDES[side === "teach" ? "learn" : "teach"];

  /* Offer the other door only where this person genuinely holds roles for it,
     in some Active Workspace. Showing it otherwise would send them to a side
     with nothing on it. */
  const canSwitchSide = workspaces.some(
    (w) => w.membershipStatus === "Active" && rolesMatchSide(w.roles, other.key)
  );

  return (
    <div className="lw-accountbar" style={{ "--side-accent": config.login.accent }}>
      <span className="lw-accountbar__side">{config.label}</span>
      <span className="lw-accountbar__ws">
        <Building2 size={13} /> {workspace.name}
      </span>
      <span className="lw-accountbar__roles">
        {workspace.roles.map((r) => (
          <span className="lw-accountbar__role" key={r}>{r.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
        ))}
      </span>
      <span className="lw-accountbar__spacer" />
      <span className="lw-accountbar__who">{me?.fullName}</span>
      {canSwitchSide && (
        <button onClick={() => { window.history.pushState({}, "", other.path); window.dispatchEvent(new PopStateEvent("popstate")); }}>
          <ArrowLeftRight size={12} /> {other.label}
        </button>
      )}
      {eligibleWorkspaces.length > 1 && (
        <button onClick={leaveWorkspace}>Switch workspace</button>
      )}
      <button onClick={signOut}>Sign out</button>
    </div>
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

const LEARNER_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "lesson", label: "Continue Lesson", icon: PlayCircle },
  { id: "assessments", label: "Assessments", icon: ClipboardCheck, capability: "assessments" },
  { id: "certificates", label: "Certificates", icon: Award, capability: "certificates" },
  { id: "schedule", label: "Schedule", icon: Calendar, capability: "schedule" },
  { id: "messages", label: "Messages", icon: MessageSquare, capability: "messages" },
  { id: "community", label: "Community", icon: MessageCircle, capability: "community" },
  { id: "ai", label: "__AI__", icon: Bot, capability: "aiTutor" },
];

/* Maps a Learner nav id to the Workspace capability that gates it — the
   single source of truth used by both Nav (to hide items) and App (to
   redirect away from a screen an Owner just turned off). */

const OWNER_NAV = [
  { divider: "Grow" },
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "products", label: "Learning Products", icon: BookOpen },
  { id: "studio", label: "Content Studio", icon: Wand2 },
  { divider: "Operate" },
  { id: "members", label: "Members", icon: Users },
  { id: "scheduling", label: "Scheduling", icon: Calendar },
  { id: "commerce", label: "Commerce", icon: CreditCard },
  { id: "communication", label: "Communication", icon: Megaphone },
  { divider: "Prove" },
  { id: "assessment", label: "Assessment & Certificates", icon: Award },
  { divider: "Configure" },
  // The real Workspace lifecycle, above the prototype's settings panel
  { id: "setup", label: "Workspace Setup", icon: Rocket },
  { id: "settings", label: "Workspace Settings", icon: Settings },
];

function Nav({ c, role, screen, setScreen, onOpenProfile, personName, personRole }) {
  // Capability gating came from fixture flags. Capabilities are not implemented
  // (TD-006), so every item is shown and each says for itself what is not built.
  const items = role === "learner" ? LEARNER_NAV : OWNER_NAV;
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
        {items.map((it, i) =>
          it.divider ? (
            <div className="lw-nav__divider" key={`d${i}`}>{it.divider}</div>
          ) : (
            <button
              key={it.id}
              className={`lw-nav__item ${screen === it.id ? "is-active" : ""}`}
              onClick={() => setScreen(it.id)}
            >
              <it.icon size={16} />
              {it.label === "__AI__" ? c.aiName : it.label}
            </button>
          )
        )}
      </div>
      <button className="lw-nav__profile" onClick={onOpenProfile}>
        <UserCircle size={16} /> My professional profile
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
   (MP4 / recorded session) or Video URL (YouTube / Vimeo / other).
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
     workspace would be another fiction, just a prettier one. */
  const theme = DEFAULT_THEME;

  /* The person is whoever is actually signed in, and their label is the roles
     they actually hold here — not a fixture "Mentor" or "Instructor". */
  const personName = me?.fullName ?? "";
  const personRole = (workspace.roles ?? [])
    .map((r) => r.replace(/([a-z])([A-Z])/g, "$1 $2"))
    .join(", ") || "Member";

  useEffect(() => { setLearnerScreen("dashboard"); setOwnerScreen("overview"); setStudioProductId(null); }, [role]);

  const activeNavScreen = role === "learner" ? learnerScreen : (ownerScreen === "studio" ? "studio" : ownerScreen);

  return (
    <div className="lw-root" style={theme}>
      <style>{CSS}</style>
      <AccountBar />
      {/* The academy switcher and workspace wizard are gone: they moved between
          two fictional academies, which cannot coexist with a real signed-in
          workspace. */}
      {role === "learner" && <AcademyHeader c={c} />}
      <div className="lw-shell">
        <Nav c={c} role={role} screen={activeNavScreen}
          personName={personName} personRole={personRole}
          setScreen={role === "learner" ? setLearnerScreen : setOwnerScreen}
          onOpenProfile={() => setProfileOpen(true)} />
        <div className="lw-content">
          {/* Learner screens. Only the home is real; the rest describe a
              curriculum that does not exist yet. */}
          {role === "learner" && learnerScreen === "dashboard" && <LearnerHomeScreen />}
          {role === "learner" && learnerScreen === "courses" && (
            <NotBuiltYet area="Learning Product Context" onNavigate={setLearnerScreen}
              blurb="Courses aren’t built yet, so there is nothing published for you to open." />
          )}
          {role === "learner" && learnerScreen === "lesson" && (
            <NotBuiltYet area="Lesson Delivery" onNavigate={setLearnerScreen}
              blurb="Lessons aren’t built yet. When your tutor publishes one, it will appear here." />
          )}
          {role === "learner" && learnerScreen === "assessments" && (
            <NotBuiltYet area="Assessment Context" onNavigate={setLearnerScreen}
              blurb="Assessments aren’t built yet, so no work of yours has been marked." />
          )}
          {role === "learner" && learnerScreen === "certificates" && (
            <NotBuiltYet area="Certification Context" onNavigate={setLearnerScreen}
              blurb="Certificates aren’t built yet. Nothing has been awarded, so nothing is shown." />
          )}
          {role === "learner" && learnerScreen === "schedule" && (
            <NotBuiltYet area="Scheduling Context" onNavigate={setLearnerScreen}
              blurb="Scheduling isn’t built yet, so there are no sessions in your calendar." />
          )}
          {role === "learner" && learnerScreen === "messages" && (
            <NotBuiltYet area="Communication Context" onNavigate={setLearnerScreen}
              blurb="Messaging isn’t built yet. Contact your tutor the way you normally would." />
          )}
          {role === "learner" && learnerScreen === "community" && (
            <NotBuiltYet area="Community Context" onNavigate={setLearnerScreen}
              blurb="Community discussion isn’t built yet." />
          )}
          {role === "learner" && learnerScreen === "ai" && (
            <NotBuiltYet area="AI Context" onNavigate={setLearnerScreen}
              blurb="The workspace AI assistant isn’t built yet." />
          )}

          {/* Owner screens. Only overview, members and setup are real; the rest
              have no domain behind them yet and say so, rather than rendering
              fixture data as though it were this tutor's own academy. */}
          {role === "owner" && ownerScreen === "overview" && <WorkspaceHomeScreen onNavigate={setOwnerScreen} />}
          {role === "owner" && ownerScreen === "members" && <MembersScreen />}
          {role === "owner" && ownerScreen === "setup" && <WorkspaceSetupScreen />}

          {role === "owner" && ownerScreen === "products" && (
            <ProductsScreen onOpenStudio={(id) => { setStudioProductId(id); setOwnerScreen("studio"); }} />
          )}
          {role === "owner" && ownerScreen === "studio" && (
            <ContentStudioScreen productId={studioProductId} onSelectProduct={setStudioProductId} />
          )}
          {role === "owner" && ownerScreen === "scheduling" && (
            <NotBuiltYet area="Scheduling Context" onNavigate={setOwnerScreen}
              blurb="Sessions and scheduling aren't built yet. Once they are, what you schedule here will be what your learners see." />
          )}
          {role === "owner" && ownerScreen === "commerce" && (
            <NotBuiltYet area="Commerce Context" onNavigate={setOwnerScreen}
              blurb="Pricing, orders and payouts aren't built yet. Your own subscription to the platform is separate and already handled." />
          )}
          {role === "owner" && ownerScreen === "communication" && (
            <NotBuiltYet area="Communication Context" onNavigate={setOwnerScreen}
              blurb="Announcements and messaging aren't built yet. For now, invitations are the only thing the platform sends on your behalf."
              next={{ text: "Invite someone", to: "members" }} />
          )}
          {role === "owner" && ownerScreen === "assessment" && (
            <NotBuiltYet area="Assessment & Certification" onNavigate={setOwnerScreen}
              blurb="Assessments and certificates aren't built yet. They depend on Learning Products, which come first." />
          )}
          {role === "owner" && ownerScreen === "settings" && (
            <NotBuiltYet area="Workspace Configuration" onNavigate={setOwnerScreen}
              blurb="Branding, capabilities and regional settings aren't built yet. Your workspace's name, address and lifecycle live under Workspace Setup."
              next={{ text: "Open Workspace Setup", to: "setup" }} />
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

  .lw-accountbar { background: #FFFFFF; color: #1B2430; border-bottom: 1px solid #E1DED7; font-family: var(--font-body); font-size: 12px; display: flex; align-items: center; gap: 10px; padding: 8px 18px; flex-wrap: wrap; }
  .lw-accountbar__side { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; background: var(--side-accent); color: #fff; border-radius: 20px; padding: 3px 9px; }
  .lw-accountbar__ws { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; }
  .lw-accountbar__roles { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .lw-accountbar__role { font-family: var(--font-mono); font-size: 10px; background: #EDF1FB; color: #2449AC; border-radius: 20px; padding: 2px 8px; }
  .lw-accountbar__spacer { flex: 1; }
  .lw-accountbar__who { color: #6A7383; }
  .lw-accountbar button { display: inline-flex; align-items: center; gap: 5px; background: transparent; border: 1px solid #E1DED7; color: #6A7383; border-radius: 7px; padding: 4px 10px; font-family: var(--font-body); font-size: 11.5px; cursor: pointer; }
  .lw-accountbar button:hover { color: #1B2430; border-color: #C9C5BC; }

  .lw-controlstrip { background: #0D0F12; color: #C9CDD3; font-family: var(--font-mono); font-size: 11px; display: flex; align-items: center; gap: 20px; padding: 8px 18px; flex-wrap: wrap; border-bottom: 1px solid #000; }
  .lw-controlstrip__label { opacity: 0.65; letter-spacing: 0.04em; }
  .lw-controlstrip__group { display: flex; align-items: center; gap: 6px; }
  .lw-controlstrip__group span { opacity: 0.6; margin-right: 2px; }
  .lw-controlstrip button { background: transparent; border: 1px solid #383D45; color: #C9CDD3; border-radius: 20px; padding: 3px 10px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; transition: all .15s; }
  .lw-controlstrip button.active { background: #C9CDD3; color: #0D0F12; border-color: #C9CDD3; }
  .lw-controlstrip__new { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: 1px dashed #4A5058 !important; color: #8FE3EA !important; border-radius: 20px; padding: 3px 10px; font-family: var(--font-mono); font-size: 11px; cursor: pointer; }
  .lw-controlstrip__reset { margin-left: auto; display: flex; align-items: center; gap: 5px; background: transparent; border: none; color: #8A8F97; cursor: pointer; font-family: var(--font-mono); font-size: 11px; }

  .lw-academyheader { display: flex; align-items: center; gap: 16px; padding: 20px 32px; width: 100%; background: linear-gradient(120deg, var(--accent), var(--accent-2)); box-shadow: inset 0 -1px 0 rgba(0,0,0,0.08); }
  .lw-academyheader__mark { background: rgba(255,255,255,0.18); padding: 6px; border-radius: var(--radius-sm); display: flex; flex-shrink: 0; }
  .lw-academyheader__name { font-family: var(--font-display); font-weight: 700; font-size: 1.5rem; line-height: 1.15; color: #fff; }
  .lw-academyheader__tagline { font-size: 0.85rem; color: rgba(255,255,255,0.88); margin-top: 2px; }
  @media (max-width: 640px) { .lw-academyheader { padding: 16px 20px; } .lw-academyheader__name { font-size: 1.2rem; } }

  .lw-shell { display: flex; flex: 1; min-height: 0; }
  .lw-content { flex: 1; overflow-y: auto; padding: 40px 48px 64px; }
  .lw-page { max-width: 880px; animation: lwFade .3s ease; }
  @keyframes lwFade { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
  @media (prefers-reduced-motion: reduce) { .lw-page { animation: none; } }

  h1 { font-family: var(--font-display); font-weight: 600; font-size: 2rem; margin: 2px 0 6px; line-height: 1.15; }
  h2.lw-sectiontitle { font-family: var(--font-display); font-size: 1.2rem; margin: 36px 0 14px; font-weight: 600; }
  .lw-eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  .lw-sub { color: var(--ink-soft); font-size: 0.94rem; max-width: 62ch; margin-bottom: 22px; }

  .lw-nav { width: 250px; flex-shrink: 0; background: var(--nav-bg); color: var(--nav-text); display: flex; flex-direction: column; padding: 22px 16px; }
  .lw-nav__brand { display: flex; gap: 10px; align-items: center; margin-bottom: 28px; }
  .lw-brandmark { flex-shrink: 0; border-radius: var(--radius-sm); overflow: hidden; display: flex; line-height: 0; }
  .lw-cover { width: 100%; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; }
  .lw-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lw-cover svg { display: block; }
  .lw-nav__name { font-family: var(--font-display); font-weight: 600; font-size: 0.92rem; line-height: 1.2; }
  .lw-nav__tagline { font-size: 10.5px; opacity: 0.6; margin-top: 2px; }
  .lw-nav__items { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
  .lw-nav__divider { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.45; padding: 12px 12px 4px; }
  .lw-nav__item { display: flex; align-items: center; gap: 9px; background: transparent; border: none; color: var(--nav-text); opacity: 0.72; padding: 8px 12px; border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 0.84rem; cursor: pointer; text-align: left; transition: all .15s; }
  .lw-nav__item:hover { opacity: 1; background: rgba(255,255,255,0.06); }
  .lw-nav__item.is-active { opacity: 1; background: var(--accent); color: #fff; }
  .lw-nav__profile { display: flex; align-items: center; gap: 8px; background: transparent; border: 1px dashed rgba(255,255,255,0.25); color: var(--nav-text); opacity: 0.75; padding: 8px 10px; border-radius: var(--radius-sm); font-size: 0.75rem; cursor: pointer; margin: 6px 0; }
  .lw-nav__profile:hover { opacity: 1; }
  .lw-nav__person { display: flex; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.14); }
  .lw-nav__avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-2); display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 600; flex-shrink: 0; }
  .lw-nav__personname { font-size: 0.8rem; font-weight: 600; }
  .lw-nav__personrole { font-size: 0.7rem; opacity: 0.6; }

  .lw-btn { font-family: var(--font-body); font-weight: 600; font-size: 0.85rem; border-radius: var(--radius-sm); padding: 10px 16px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: transform .12s, box-shadow .12s; }
  .lw-btn:hover { transform: translateY(-1px); }
  .lw-btn--accent { background: var(--accent); border-color: var(--accent); color: #fff; }
  .lw-btn--ghost { background: transparent; }
  .lw-btn--sm { padding: 6px 12px; font-size: 0.78rem; }
  .lw-btn--lg { padding: 14px 24px; font-size: 0.95rem; margin-top: 24px; }

  .lw-greeting { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 30px; flex-wrap: wrap; }
  .lw-greeting p { color: var(--ink-soft); font-size: 0.9rem; max-width: 48ch; }

  .lw-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .lw-grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  @media (max-width: 900px) { .lw-grid3, .lw-grid2 { grid-template-columns: 1fr; } }

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
    position: absolute; top: 14px; right: 14px; width: 44px; height: 44px; border-radius: 50%;
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

  .lw-aicard { display: flex; gap: 10px; align-items: flex-start; background: color-mix(in srgb, var(--accent) 8%, var(--surface-2)); border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line)); border-radius: var(--radius-sm); padding: 12px 14px; margin: 14px 0; font-size: 0.85rem; color: var(--ink-soft); }
  .lw-aicard svg { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
  .lw-aicard__body { flex: 1; }
  .lw-aicard__actions { display: flex; gap: 6px; flex-shrink: 0; }

  .lw-unitlist { display: flex; flex-direction: column; gap: 14px; }
  .lw-unitcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
  .lw-unitcard__head { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 600; font-size: 1rem; margin-bottom: 10px; }
  .lw-unitcard__remove { margin-left: auto; background: transparent; border: none; color: var(--ink-soft); cursor: pointer; }

  .lw-inlineai { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 0.75rem; cursor: pointer; margin-left: 8px; font-weight: 600; }
  .lw-imagepicker { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .lw-imagepicker .lw-inlineai { margin-left: 0; }
  .lw-inlineai:disabled { opacity: 0.4; cursor: default; }
  .lw-inlineinput { padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: var(--font-body); background: var(--surface); font-size: 0.85rem; }
  .lw-rationale { display: flex; align-items: center; gap: 5px; font-size: 0.74rem; color: var(--accent-2); margin-top: 3px; font-style: italic; }
  .lw-rowactions__single { background: transparent; border: none; color: var(--ink-soft); cursor: pointer; padding: 4px; }
  .lw-listrow__icon { width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--accent); font-size: 0.8rem; font-weight: 600; }
  .lw-listrow__body { flex: 1; }
  .lw-listrow__title { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; }
  .lw-listrow__meta { font-size: 0.78rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-tag { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; background: var(--surface-2); padding: 2px 7px; border-radius: 20px; color: var(--ink-soft); }
  .lw-tag--new { background: var(--accent); color: #fff; }
  .lw-timestamp { font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft); background: var(--surface-2); }
  .lw-scorepill { font-family: var(--font-mono); font-weight: 600; font-size: 0.85rem; background: var(--surface-2); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--accent-2); }

  .lw-player { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; margin-bottom: 20px; }
  .lw-player__frame { background: linear-gradient(135deg, var(--ink), var(--accent-2)); color: #fff; height: 210px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; font-size: 0.85rem; opacity: 0.95; }
  .lw-timeline { display: flex; gap: 18px; padding: 14px 18px; flex-wrap: wrap; border-top: 1px solid var(--line); }
  .lw-timeline__event { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--ink-soft); }
  .lw-timeline__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
  .lw-timeline__time { font-family: var(--font-mono); color: var(--ink); }

  .lw-questioncard__prompt { font-family: var(--font-display); font-size: 1.1rem; font-weight: 500; margin: 6px 0 16px; }
  .lw-options { display: flex; flex-direction: column; gap: 8px; }
  .lw-option { display: flex; justify-content: space-between; align-items: center; text-align: left; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg); cursor: pointer; font-family: var(--font-body); font-size: 0.9rem; transition: all .12s; }
  .lw-option:hover:not(:disabled) { border-color: var(--accent); }
  .lw-option.is-correct { border-color: var(--accent-2); background: color-mix(in srgb, var(--accent-2) 10%, var(--bg)); color: var(--accent-2); font-weight: 600; }
  .lw-option.is-wrong { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, var(--bg)); color: var(--danger); }
  .lw-feedback { display: flex; gap: 8px; align-items: flex-start; margin-top: 16px; padding: 12px 14px; background: var(--surface-2); border-radius: var(--radius-sm); font-size: 0.85rem; }

  .lw-chat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .lw-bubble { max-width: 70%; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.88rem; display: flex; gap: 8px; align-items: flex-start; }
  .lw-bubble--ai { background: var(--surface-2); align-self: flex-start; }
  .lw-bubble--user { background: var(--accent); color: #fff; align-self: flex-end; }
  .lw-bubble__avatar { width: 20px; height: 20px; border-radius: 50%; background: var(--accent-2); color: #fff; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .lw-chatinput, .lw-composer { display: flex; gap: 8px; margin-top: 8px; }
  .lw-chatinput input, .lw-composer input { flex: 1; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--line); font-family: var(--font-body); background: var(--bg); }
  .lw-composer { margin-bottom: 16px; }

  .lw-dropzone { border: 2px dashed var(--line); border-radius: var(--radius); padding: 44px; text-align: center; color: var(--ink-soft); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 10px; transition: border-color .15s; background: var(--surface); }
  .lw-dropzone:hover { border-color: var(--accent); }
  .lw-dropzone__title { font-weight: 600; color: var(--ink); font-family: var(--font-body); }
  .lw-dropzone__meta { font-size: 0.78rem; }
  .lw-dropzone--compact { padding: 20px; margin-bottom: 4px; }
  .lw-videosource { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
  .lw-tag--source { background: color-mix(in srgb, var(--accent) 15%, var(--surface-2)); color: var(--accent); margin-left: 6px; }

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
  .lw-stepper__item.done span { background: var(--accent-2); color: #fff; }
  .lw-stepper__item.active { color: var(--accent); font-weight: 600; background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); }
  .lw-stepper__item.active span { background: var(--accent); color: #fff; }

  .lw-titleinput { font-family: var(--font-display); font-weight: 600; font-size: 2rem; border: none; border-bottom: 2px dashed var(--line); background: transparent; width: 100%; padding: 4px 0; color: var(--ink); }
  .lw-titleinput:focus { outline: none; border-color: var(--accent); }
  .lw-objectives { margin: 4px 0 0; padding-left: 20px; font-size: 0.9rem; color: var(--ink-soft); display: flex; flex-direction: column; gap: 6px; }
  .lw-questionrow.accepted { border-color: var(--accent-2); }
  .lw-questionrow.removed { opacity: 0.5; }
  .lw-rowactions { display: flex; gap: 4px; }
  .lw-rowactions button { width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
  .lw-rowactions button:hover { color: var(--ink); }
  .lw-rowactions button.active { background: var(--accent-2); border-color: var(--accent-2); color: #fff; }
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
  .lw-settingsrow input { text-align: right; border: none; background: transparent; font-family: var(--font-body); font-size: 0.85rem; color: var(--ink); width: 60%; }
  .lw-settingsrow input:focus { outline: none; }
  .lw-swatchrow { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
  .lw-swatch { display: flex; gap: 8px; align-items: center; font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-soft); }
  .lw-swatch span { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--line); flex-shrink: 0; }

  .lw-widgetrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
  .lw-widgetrow:first-of-type { border-top: none; }
  .lw-widgetrow__label { font-size: 0.88rem; font-weight: 600; }
  .lw-widgetrow__consequence { font-size: 0.76rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-toggle { width: 40px; height: 22px; border-radius: 20px; background: var(--line); border: none; cursor: pointer; position: relative; flex-shrink: 0; transition: background .15s; }
  .lw-toggle span { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  .lw-toggle.is-on { background: var(--accent-2); }
  .lw-toggle.is-on span { transform: translateX(18px); }

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
  .lw-segctrl button { padding: 7px 14px; border-radius: 20px; border: 1px solid #DDD; background: #fff; color: #444; font-size: 0.82rem; cursor: pointer; }
  .lw-segctrl button.active { background: #2454C7; border-color: #2454C7; color: #fff; }

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
  .lw-overlay__close { position: absolute; top: 20px; right: 20px; background: transparent; border: none; cursor: pointer; color: #888; }
  .lw-idcard { display: flex; gap: 14px; align-items: center; background: #fff; border: 1px solid #E3E3E3; border-radius: 12px; padding: 16px; margin-bottom: 6px; }
  .lw-idcard__avatar { width: 44px; height: 44px; border-radius: 50%; background: #2454C7; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
  .lw-idcard__name { font-weight: 600; }
  .lw-idcard__meta { font-size: 0.8rem; color: #777; }

  button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

/* The person behind the membership, across the platform rather than inside one
   workspace. Identity Aggregate Design gives this a Professional Profile,
   Reputation and Professional History; none of that is built, so this shows the
   Identity that genuinely exists and says the rest is missing rather than
   inventing a portfolio. */
function ProfessionalProfile({ onClose }) {
  const { me, workspaces } = useAuth();
  const active = workspaces.filter((w) => w.membershipStatus === "Active");

  return (
    <div className="lw-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lw-modal__panel" onClick={(e) => e.stopPropagation()}>
        <button className="lw-modal__close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="lw-eyebrow">Your account</div>
        <h2>{me?.fullName}</h2>
        <p className="lw-modal__sub">{me?.email}</p>

        <h3 className="lw-modal__h3">Workspaces you belong to</h3>
        <div className="lw-modal__list">
          {active.length === 0 && <p className="lw-modal__muted">None yet.</p>}
          {active.map((w) => (
            <div className="lw-modal__row" key={w.workspaceId}>
              <strong>{w.name}</strong>
              <span>{w.roles.map((r) => r.replace(/([a-z])([A-Z])/g, "$1 $2")).join(", ")}</span>
            </div>
          ))}
        </div>

        <p className="lw-modal__muted">
          Your identity is yours and follows you across every workspace. A public
          professional profile, reputation and teaching history are described in
          the design but not built yet, so nothing here is inferred or invented.
        </p>
      </div>
    </div>
  );
}
