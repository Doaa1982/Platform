import { useEffect, useState } from "react";
import {
  LoaderCircle, ArrowRight, Check, Circle,
  Users, UserPlus, Inbox, Rocket, Globe, Lock,
  BookOpen, Wand2, Award, Receipt, CalendarDays, Clock, Copy,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   WORKSPACE HOME — what an owner sees on arrival.

   Replaces the prototype's Overview, which reported revenue, enrolments and
   learner counts drawn from fixture data. For a workspace minutes old that was
   not an empty state, it was a false statement about someone's business — and
   the first thing they'd have seen after accepting their invitation.

   Everything here is measured, not imagined. Where a domain does not exist yet
   (products, enrolments, revenue) this says so rather than showing a zero that
   implies the feature is working and the number is real.

   The first-run case is the default rather than a special mode: a workspace
   arrives Created and unconfigured, so "not set up yet" is simply what is true
   at that moment, and the page stops leading with it once it stops applying.
   ========================================================================= */

export default function WorkspaceHomeScreen({ onNavigate }) {
  const { session, workspace, me } = useAuth();
  const { t, lang } = useLanguage();
  const slug = workspace?.slug;

  const [setup, setSetup] = useState(null);
  const [members, setMembers] = useState(null);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getSetup(session.token, slug),
      api.getMembers(session.token, slug),
      // Only owners and admins can read this; anyone else simply has no queue
      api.getJoinRequests(session.token, slug).catch(() => []),
    ])
      .then(([s, m, j]) => {
        if (cancelled) return;
        setSetup(s); setMembers(m); setRequests(j); setError(null);
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  if (error) {
    return <div className="lw-page"><Message type="error">{error}</Message></div>;
  }
  if (!setup || !members) {
    return (
      <div className="lw-page">
        <div className="lw-home__loading"><LoaderCircle size={18} className="lw-home__spin" /> {t("home.loading")}</div>
      </div>
    );
  }

  const isLive = setup.status === "Active";
  const activeMembers = members.members.filter((m) => m.status === "Active");
  const learners = activeMembers.filter((m) => m.roles.includes("Learner"));
  const teachers = activeMembers.filter((m) =>
    m.roles.some((r) => ["Teacher", "AssistantTeacher", "Owner", "Administrator"].includes(r)));
  const pendingInvites = members.invitations.filter((i) => i.isOpen);
  const pendingRequests = requests.filter((r) => r.status === "Submitted");

  // Nobody but the owner yet, and not published — this is genuinely day one
  const isFirstRun = !isLive && activeMembers.length <= 1 && pendingInvites.length === 0;

  const firstName = (me?.fullName ?? "").trim().split(" ")[0];
  const initial = (me?.fullName ?? "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-home__greet">
        <div className="lw-home__greetavatar">{initial}</div>
        <div className="lw-home__greettext">
          <div className="lw-eyebrow">{setup.name}</div>
          <h1>{isFirstRun ? (firstName ? t("home.welcomeNamed", { name: firstName }) : t("home.welcome")) : t("home.overview")}</h1>
          <p className="lw-sub">
            {isFirstRun ? t("home.firstRunSub") : t("home.standsToday", { name: setup.name })}
          </p>
        </div>
        <LiveClock lang={lang} />
      </div>

      <QuickActions isLive={isLive} onNavigate={onNavigate} t={t} />

      {/* ── The one thing that matters until it's done ────────────────── */}
      {!isLive && (
        <div className="lw-home__setup">
          <div className="lw-home__setuptext">
            <strong>
              {setup.status === "Created" ? t("home.notSetUpTitle")
                : setup.status === "Published" ? t("home.almostThereTitle")
                : t("home.setupInProgressTitle")}
            </strong>
            <p>
              {t("home.currentlyPrefix")} <em>{setup.status}</em>. {t("home.currentlySuffix")}
            </p>
          </div>
          <button className="lw-btn lw-btn--accent" onClick={() => onNavigate("setup")}>
            {t("home.continueSetup")} <ArrowRight size={15} />
          </button>
        </div>
      )}

      {isLive && <LiveBanner setup={setup} t={t} />}

      {/* ── Measured facts only ──────────────────────────────────────── */}
      <div className="lw-home__stats">
        <Stat icon={Users} color={CARD_COLORS.teaching} label={t("home.statTeaching")} value={teachers.length}
              note={teachers.length === 1 ? t("home.statTeachingNoteSolo") : t("home.statTeachingNote")} />
        <Stat icon={Users} color={CARD_COLORS.learners} label={t("home.statLearners")} value={learners.length}
              note={learners.length === 0 ? t("home.statLearnersNoteNone") : t("home.statLearnersNote")} />
        <Stat icon={UserPlus} color={CARD_COLORS.invites} label={t("home.statInvites")} value={pendingInvites.length}
              note={pendingInvites.length === 0 ? t("home.statInvitesNoteNone") : t("home.statInvitesNote")} />
        <Stat icon={Inbox} color={CARD_COLORS.requests} label={t("home.statRequests")} value={pendingRequests.length}
              note={pendingRequests.length > 0 ? t("home.statRequestsWaiting") : setup.acceptsJoinRequests ? t("home.statRequestsNone") : t("home.statRequestsNotAccepting")}
              urgent={pendingRequests.length > 0} />
      </div>

      {/* ── Every real destination this workspace has today, one tap away ─ */}
      <h2 className="lw-sectiontitle">{t("home.sectionsTitle")}</h2>
      <div className="lw-home__grid">
        {SECTION_TILES.map((s) => (
          <button key={s.id} type="button" className="lw-home__tile" style={{ "--tile-color": s.color }} onClick={() => onNavigate(s.id)}>
            <span className="lw-home__tileicon"><s.icon size={19} /></span>
            <span className="lw-home__tilelabel">{t(s.labelKey)}</span>
          </button>
        ))}
      </div>

      <RecentActivity requests={pendingRequests} invitations={pendingInvites} onNavigate={onNavigate} t={t} />

      {/* ── What to do next, in the order it makes sense ─────────────────
          Only while there's a "next" left to do — once the workspace is
          live this would just be three permanently-checked lines, the same
          "nothing left to say" case that already hides the setup banner
          above. */}
      {!isLive && (
        <>
          <h2 className="lw-sectiontitle">{t("home.gettingStarted")}</h2>
          <ol className="lw-home__steps">
            <Step done label={t("home.stepAcceptInvite")} />
            <Step done={isLive}
                  label={t("home.stepPublish")}
                  action={!isLive ? { text: t("home.setUp"), to: "setup" } : null}
                  onNavigate={onNavigate} />
            <Step done={activeMembers.length > 1 || pendingInvites.length > 0}
                  label={t("home.stepInvite")}
                  action={{ text: t("home.invite"), to: "members", opts: { membersTab: "create" } }}
                  onNavigate={onNavigate} />
          </ol>
        </>
      )}

      {!isLive && (
        <p className="lw-home__addr">
          {setup.status === "Published"
            ? <><Globe size={13} /> {t("home.reachableAt")} <code>/{setup.slug}</code></>
            : <><Lock size={13} /> {t("home.notReachable")}</>}
        </p>
      )}
    </div>
  );
}

/* bg is derived (color-mix against --surface-2, see Stat) so these tints
   stay a light accent wash in Light mode and a muted dark-surface wash in
   Dark mode, instead of a hardcoded pastel fighting the page. */
const CARD_COLORS = {
  teaching: { icon: "#3E6FE0" },
  learners: { icon: "#1FA971" },
  invites: { icon: "#E0912E" },
  requests: { icon: "#E0537B" },
};

function Stat({ icon: Icon, color, label, value, note, urgent }) {
  const style = {
    "--card-bg": `color-mix(in srgb, ${color.icon} 16%, var(--surface-2))`,
    "--card-icon": color.icon,
  };
  return (
    <div className={`lw-home__stat ${urgent ? "is-urgent" : ""}`} style={style}>
      <div className="lw-home__staticon"><Icon size={17} /></div>
      <div className="lw-home__statlabel">{label}</div>
      <div className="lw-home__statvalue">{value}</div>
      <div className="lw-home__statnote">{note}</div>
    </div>
  );
}

// Ticks on its own so a per-second re-render stays local to the clock
// instead of re-rendering the whole home screen (and its data fetch state).
function LiveClock({ lang }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  // Force Latin digits in Arabic too — the rest of this UI doesn't localise
  // numerals, so Eastern Arabic digits here would be the odd one out.
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const dateStr = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const timeStr = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="lw-home__clock">
      <span className="lw-home__clockdate"><CalendarDays size={12} /> {dateStr}</span>
      <span className="lw-home__clocktime"><Clock size={12} /> {timeStr}</span>
    </div>
  );
}

// Folds the plain "Reachable at /slug" line into the live banner itself,
// as a clickable link plus a one-tap copy of the full URL — the address is
// most useful exactly where a tutor is told they're open for enrolment.
function LiveBanner({ setup, t }) {
  const [copied, setCopied] = useState(false);
  const path = `/${setup.slug}`;

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}${path}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="lw-home__live">
      <span className="lw-home__livetext"><Rocket size={16} /> {t("home.liveBanner", { name: setup.name })}</span>
      <span className="lw-home__livelink">
        <a href={path} target="_blank" rel="noopener noreferrer">
          <Globe size={13} /> <code>{path}</code>
        </a>
        <button type="button" className="lw-home__livecopy" onClick={copyLink} aria-label={t("home.copyLink")}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t("home.copied") : t("home.copyLink")}
        </button>
      </span>
    </div>
  );
}

function QuickActions({ isLive, onNavigate, t }) {
  const actions = [
    { icon: UserPlus, label: t("home.invite"), color: CARD_COLORS.invites.icon, to: "members", opts: { membersTab: "create" } },
    { icon: BookOpen, label: t("home.quickAddProduct"), color: CARD_COLORS.teaching.icon, to: "products" },
    isLive
      ? { icon: Receipt, label: t("home.managePlan"), color: CARD_COLORS.learners.icon, to: "billing" }
      : { icon: Rocket, label: t("home.setUp"), color: CARD_COLORS.learners.icon, to: "setup" },
  ];
  return (
    <div className="lw-home__quickactions">
      {actions.map((a) => (
        <button key={a.label} type="button" className="lw-home__quickaction" style={{ "--qa-color": a.color }} onClick={() => onNavigate(a.to, a.opts)}>
          <span className="lw-home__quickactionicon"><a.icon size={20} /></span>
          {a.label}
        </button>
      ))}
    </div>
  );
}

// Only destinations that actually exist behind OWNER_NAV today (App.jsx) —
// scheduling/commerce/communication/settings still render NotBuiltYet there,
// so they're left off this grid rather than teased here as live sections.
const SECTION_TILES = [
  { id: "members", labelKey: "nav.members", icon: Users, color: "#3E6FE0" },
  { id: "products", labelKey: "nav.learningProducts", icon: BookOpen, color: "#E0912E" },
  { id: "studio", labelKey: "nav.contentStudio", icon: Wand2, color: "#8A5FD6" },
  { id: "assessment", labelKey: "nav.assessmentCertificates", icon: Award, color: "#1FA971" },
  { id: "billing", labelKey: "nav.billing", icon: Receipt, color: "#E0537B" },
  { id: "setup", labelKey: "nav.workspaceSetup", icon: Rocket, color: "#2D5BD1" },
];

function humanise(t, role) {
  return t(`roles.${role}`) !== `roles.${role}` ? t(`roles.${role}`) : role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// Real, already-fetched data (the same join requests and open invitations
// MembersScreen shows) — not a fabricated activity log.
function RecentActivity({ requests, invitations, onNavigate, t }) {
  const items = [
    ...requests.map((r) => ({
      key: `req-${r.id}`, icon: Inbox, color: CARD_COLORS.requests.icon,
      text: t("members.askedToJoinAs", { email: r.email, role: humanise(t, r.requestedRole) }),
    })),
    ...invitations.map((i) => ({
      key: `inv-${i.id}`, icon: UserPlus, color: CARD_COLORS.invites.icon,
      text: `${i.email} · ${t("members.invitedAs", { role: humanise(t, i.intendedRole), date: new Date(i.expiresAt).toLocaleDateString() })}`,
    })),
  ].slice(0, 5);

  return (
    <div className="lw-home__activity">
      <div className="lw-home__activityhead">
        <h2 className="lw-sectiontitle">{t("home.recentActivityTitle")}</h2>
        {items.length > 0 && (
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => onNavigate("members")}>
            {t("home.viewAll")} <ArrowRight size={13} />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="lw-home__activityempty">{t("home.noRecentActivity")}</p>
      ) : (
        <ul className="lw-home__activitylist">
          {items.map((it) => (
            <li key={it.key}>
              <span className="lw-home__activityicon" style={{ "--activity-color": it.color }}><it.icon size={14} /></span>
              <span className="lw-home__activitytext">{it.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Step({ done, label, action, onNavigate }) {
  return (
    <li className={done ? "is-done" : ""}>
      <span className="lw-home__tick">{done ? <Check size={11} /> : <Circle size={7} />}</span>
      <span className="lw-home__steplabel">{label}</span>
      {!done && action && (
        <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => onNavigate(action.to, action.opts)}>
          {action.text}
        </button>
      )}
    </li>
  );
}

const CSS = `
  .lw-home__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }

  .lw-home__greet {
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 18px;
  }
  .lw-home__greetavatar {
    width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff;
    font-family: var(--font-display); font-size: 1.15rem; font-weight: 700;
  }
  .lw-home__greettext { flex: 1 1 260px; }
  .lw-home__greettext h1 { margin: 2px 0 0; }
  .lw-home__greettext .lw-sub { margin-top: 4px; }
  .lw-home__clock {
    display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
    font-size: 0.8rem; color: var(--ink-soft); white-space: nowrap;
  }
  .lw-home__clockdate, .lw-home__clocktime { display: flex; align-items: center; gap: 6px; }
  .lw-home__clocktime { font-family: var(--font-mono); }

  .lw-home__quickactions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
  .lw-home__quickaction {
    display: flex; align-items: center; gap: 10px;
    background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 12px 16px; font-size: 0.85rem; font-weight: 600; color: var(--ink);
    cursor: pointer; flex: 1 1 180px;
  }
  .lw-home__quickaction:hover { border-color: var(--qa-color, var(--line)); }
  .lw-home__quickactionicon {
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--qa-color) 18%, var(--surface));
    color: var(--qa-color);
  }

  .lw-home__grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px; margin-bottom: 26px;
  }
  .lw-home__tile {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
    padding: 18px 10px; cursor: pointer; text-align: center;
  }
  .lw-home__tile:hover { border-color: var(--tile-color); }
  .lw-home__tileicon {
    width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--tile-color) 16%, var(--surface-2));
    color: var(--tile-color);
  }
  .lw-home__tilelabel { font-size: 0.8rem; font-weight: 600; line-height: 1.3; }

  .lw-home__activity { margin-bottom: 26px; }
  .lw-home__activityhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .lw-home__activityhead .lw-sectiontitle { margin: 0; }
  .lw-home__activityempty { font-size: 0.85rem; color: var(--ink-soft); margin: 6px 0 0; }
  .lw-home__activitylist { list-style: none; padding: 0; margin: 6px 0 0; }
  .lw-home__activitylist li {
    display: flex; align-items: center; gap: 11px;
    padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 0.85rem;
  }
  .lw-home__activitylist li:last-child { border-bottom: none; }
  .lw-home__activityicon {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--activity-color) 18%, var(--surface-2));
    color: var(--activity-color);
  }
  .lw-home__activitytext { color: var(--ink-soft); }

  .lw-home__setup {
    display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;
    background: color-mix(in srgb, var(--accent) 9%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: var(--radius-sm); padding: 16px 18px; margin-bottom: 20px;
  }
  .lw-home__setuptext strong { font-size: 0.95rem; }
  .lw-home__setuptext p { font-size: 0.84rem; color: var(--ink-soft); margin: 4px 0 0; }
  .lw-home__setuptext em { font-style: normal; font-family: var(--font-mono); font-size: 0.8rem; }

  .lw-home__live {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    background: color-mix(in srgb, var(--accent-2) 12%, transparent);
    border-radius: var(--radius-sm); padding: 13px 16px; margin-bottom: 20px;
  }
  .lw-home__livetext {
    display: flex; align-items: center; gap: 9px;
    color: var(--accent-2); font-weight: 600; font-size: 0.9rem;
  }
  .lw-home__livelink { display: flex; align-items: center; gap: 8px; }
  .lw-home__livelink a {
    display: flex; align-items: center; gap: 6px;
    background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent-2) 35%, transparent);
    border-radius: 999px; padding: 5px 12px; font-size: 0.8rem; color: var(--ink);
  }
  .lw-home__livelink a:hover { border-color: var(--accent-2); }
  .lw-home__livelink code { font-family: var(--font-mono); }
  .lw-home__livecopy {
    display: flex; align-items: center; gap: 6px;
    background: transparent; border: none; color: var(--accent-2);
    font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 5px 4px;
  }

  .lw-home__stats {
    display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 8px;
  }
  .lw-home__stat {
    background: var(--card-bg, var(--surface-2)); border: 1px solid transparent;
    border-radius: 16px; padding: 16px 18px; width: 160px; flex: 1 1 160px; max-width: 220px;
    display: flex; flex-direction: column; align-items: flex-start;
  }
  .lw-home__stat.is-urgent { border-color: var(--card-icon); }
  .lw-home__staticon {
    width: 34px; height: 34px; border-radius: 9px; margin-bottom: 10px;
    display: flex; align-items: center; justify-content: center;
    background: var(--card-icon, var(--ink-soft)); color: #fff;
  }
  .lw-home__statlabel {
    font-family: var(--font-display); font-size: 0.98rem; font-weight: 700;
    line-height: 1.25; margin-bottom: 6px;
  }
  .lw-home__statvalue { font-size: 1.3rem; font-weight: 700; color: var(--card-icon, var(--ink-soft)); margin-bottom: 2px; }
  .lw-home__statnote { font-size: 0.76rem; color: var(--ink-soft); }

  .lw-home__steps { list-style: none; padding: 0; margin: 0; }
  .lw-home__steps li {
    display: flex; align-items: center; gap: 11px;
    padding: 11px 0; border-bottom: 1px solid var(--line);
  }
  .lw-home__steps li:last-child { border-bottom: none; }
  .lw-home__tick {
    width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface); border: 1px solid var(--line); color: var(--ink-soft);
  }
  .lw-home__steps li.is-done .lw-home__tick { background: var(--accent-2); border-color: var(--accent-2); color: #fff; }
  .lw-home__steplabel { flex: 1; font-size: 0.9rem; }
  .lw-home__steps li.is-done .lw-home__steplabel { color: var(--ink-soft); text-decoration: line-through; }

  .lw-home__addr {
    display: flex; align-items: center; gap: 7px;
    font-size: 0.8rem; color: var(--ink-soft); margin-top: 16px;
  }
  .lw-home__addr code { font-family: var(--font-mono); }

  .lw-home__spin { animation: lwHomeSpin 0.9s linear infinite; }
  @keyframes lwHomeSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-home__spin { animation: none; } }
`;
