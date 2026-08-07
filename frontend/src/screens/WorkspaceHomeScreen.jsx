import { useEffect, useState } from "react";
import {
  LoaderCircle, AlertCircle, ArrowRight, Check, Circle,
  Users, UserPlus, Inbox, Rocket, Globe, Lock,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";

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
    return <div className="lw-page"><div className="lw-home__alert"><AlertCircle size={16} /> {error}</div></div>;
  }
  if (!setup || !members) {
    return (
      <div className="lw-page">
        <div className="lw-home__loading"><LoaderCircle size={18} className="lw-home__spin" /> Loading…</div>
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

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{setup.name}</div>
      <h1>{isFirstRun ? `Welcome${firstName ? `, ${firstName}` : ""}.` : "Overview"}</h1>
      <p className="lw-sub">
        {isFirstRun
          ? "Your workspace exists and it's yours. Nothing has been published yet — here's what's left before learners can join you."
          : `Where ${setup.name} stands today.`}
      </p>

      {/* ── The one thing that matters until it's done ────────────────── */}
      {!isLive && (
        <div className="lw-home__setup">
          <div className="lw-home__setuptext">
            <strong>
              {setup.status === "Created" ? "Your workspace isn't set up yet"
                : setup.status === "Published" ? "Almost there — open when you're ready"
                : "Setup in progress"}
            </strong>
            <p>
              It's currently <em>{setup.status}</em>. Learners can't reach it until
              it's published and open.
            </p>
          </div>
          <button className="lw-btn lw-btn--accent" onClick={() => onNavigate("setup")}>
            Continue setup <ArrowRight size={15} />
          </button>
        </div>
      )}

      {isLive && (
        <div className="lw-home__live">
          <Rocket size={16} /> {setup.name} is open. Learners can enrol.
        </div>
      )}

      {/* ── Measured facts only ──────────────────────────────────────── */}
      <div className="lw-home__stats">
        <Stat icon={Users} color={CARD_COLORS.teaching} label="Teaching" value={teachers.length}
              note={teachers.length === 1 ? "just you so far" : "including you"} />
        <Stat icon={Users} color={CARD_COLORS.learners} label="Learners" value={learners.length}
              note={learners.length === 0 ? "none yet" : "active members"} />
        <Stat icon={UserPlus} color={CARD_COLORS.invites} label="Invitations out" value={pendingInvites.length}
              note={pendingInvites.length === 0 ? "none pending" : "awaiting acceptance"} />
        <Stat icon={Inbox} color={CARD_COLORS.requests} label="Requests to join" value={pendingRequests.length}
              note={pendingRequests.length > 0 ? "waiting on you" : setup.acceptsJoinRequests ? "none yet" : "not accepting"}
              urgent={pendingRequests.length > 0} />
      </div>

      {/* ── What to do next, in the order it makes sense ─────────────── */}
      <h2 className="lw-sectiontitle">Getting started</h2>
      <ol className="lw-home__steps">
        <Step done label="Accept your invitation and take ownership" />
        <Step done={isLive}
              label="Publish and open your workspace"
              action={!isLive ? { text: "Set up", to: "setup" } : null}
              onNavigate={onNavigate} />
        <Step done={activeMembers.length > 1 || pendingInvites.length > 0}
              label="Invite your first people"
              action={{ text: "Invite", to: "members" }}
              onNavigate={onNavigate} />
      </ol>

      {/* ── Honest about what does not exist ─────────────────────────── */}
      <div className="lw-home__notyet">
        <strong>Not built yet</strong>
        <p>
          Courses, lessons, enrolments, scheduling and payments aren't part of the
          platform yet. When they arrive they'll appear here with real numbers —
          you won't see invented ones in the meantime.
        </p>
      </div>

      <p className="lw-home__addr">
        {isLive || setup.status === "Published"
          ? <><Globe size={13} /> Reachable at <code>/{setup.slug}</code></>
          : <><Lock size={13} /> Not publicly reachable yet</>}
      </p>
    </div>
  );
}

const CARD_COLORS = {
  teaching: { bg: "#E9F0FE", icon: "#3E6FE0" },
  learners: { bg: "#E4F7EE", icon: "#1FA971" },
  invites: { bg: "#FFF1DF", icon: "#E0912E" },
  requests: { bg: "#FDEAF0", icon: "#E0537B" },
};

function Stat({ icon: Icon, color, label, value, note, urgent }) {
  return (
    <div className={`lw-home__stat ${urgent ? "is-urgent" : ""}`} style={{ "--card-bg": color.bg, "--card-icon": color.icon }}>
      <div className="lw-home__staticon"><Icon size={17} /></div>
      <div className="lw-home__statlabel">{label}</div>
      <div className="lw-home__statvalue">{value}</div>
      <div className="lw-home__statnote">{note}</div>
    </div>
  );
}

function Step({ done, label, action, onNavigate }) {
  return (
    <li className={done ? "is-done" : ""}>
      <span className="lw-home__tick">{done ? <Check size={11} /> : <Circle size={7} />}</span>
      <span className="lw-home__steplabel">{label}</span>
      {!done && action && (
        <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => onNavigate(action.to)}>
          {action.text}
        </button>
      )}
    </li>
  );
}

const CSS = `
  .lw-home__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-home__alert {
    display: flex; align-items: center; gap: 9px;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger); border-radius: var(--radius-sm); padding: 10px 13px; font-size: 0.87rem;
  }

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
    display: flex; align-items: center; gap: 9px;
    background: color-mix(in srgb, var(--accent-2) 12%, transparent);
    color: var(--accent-2); font-weight: 600; font-size: 0.9rem;
    border-radius: var(--radius-sm); padding: 13px 16px; margin-bottom: 20px;
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

  .lw-home__notyet {
    background: var(--surface-2); border-radius: var(--radius-sm);
    padding: 15px 17px; margin-top: 26px;
  }
  .lw-home__notyet strong {
    display: block; font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 7px;
  }
  .lw-home__notyet p { font-size: 0.85rem; color: var(--ink-soft); margin: 0; line-height: 1.6; max-width: 66ch; }

  .lw-home__addr {
    display: flex; align-items: center; gap: 7px;
    font-size: 0.8rem; color: var(--ink-soft); margin-top: 16px;
  }
  .lw-home__addr code { font-family: var(--font-mono); }

  .lw-home__spin { animation: lwHomeSpin 0.9s linear infinite; }
  @keyframes lwHomeSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-home__spin { animation: none; } }
`;
