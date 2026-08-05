import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, BookOpen, Users } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";

/* =========================================================================
   LEARNER HOME — what a learner sees in a workspace they belong to.

   Replaces the prototype's learner dashboard, which showed courses, streaks
   and progress bars from fixture data. Presented to a real learner those were
   claims about study they had never done, in courses that do not exist.

   What is genuinely true today: they are a member of this workspace, with
   these roles. Learning Products, lessons, progress and certificates are not
   built, so this says so rather than inventing an academy around them.
   ========================================================================= */

export default function LearnerHomeScreen() {
  const { session, workspace, me } = useAuth();
  const slug = workspace?.slug;

  const [setup, setSetup] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Any active member may read this; it carries no management detail
    api.getSetup(session.token, slug)
      .then((s) => { if (!cancelled) setSetup(s); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  const firstName = (me?.fullName ?? "").trim().split(" ")[0];

  if (error) {
    return <div className="lw-page"><div className="lw-lh__alert"><AlertCircle size={16} /> {error}</div></div>;
  }
  if (!setup) {
    return (
      <div className="lw-page">
        <div className="lw-lh__loading"><LoaderCircle size={18} className="lw-lh__spin" /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{setup.name}</div>
      <h1>Welcome{firstName ? `, ${firstName}` : ""}.</h1>
      <p className="lw-sub">
        You're a member of {setup.name}. There's nothing to study yet — your tutor
        hasn't published anything, because courses and lessons aren't part of the
        platform yet.
      </p>

      <div className="lw-lh__cards">
        <div className="lw-lh__card">
          <div className="lw-lh__cardlabel"><Users size={13} /> Your membership</div>
          <div className="lw-lh__cardvalue">
            {workspace.roles.map((r) => r.replace(/([a-z])([A-Z])/g, "$1 $2")).join(", ")}
          </div>
          <div className="lw-lh__cardnote">in {setup.name}</div>
        </div>

        <div className="lw-lh__card">
          <div className="lw-lh__cardlabel"><BookOpen size={13} /> Courses</div>
          <div className="lw-lh__cardvalue">—</div>
          <div className="lw-lh__cardnote">not built yet</div>
        </div>
      </div>

      <div className="lw-lh__notyet">
        <strong>What's coming</strong>
        <p>
          Courses, lessons, assessments, certificates and scheduling are all still
          to be built. When they arrive, what your tutor publishes here is what
          you'll see — and until then you won't be shown progress you haven't made.
        </p>
      </div>
    </div>
  );
}

const CSS = `
  .lw-lh__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-lh__alert {
    display: flex; align-items: center; gap: 9px;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger); border-radius: var(--radius-sm); padding: 10px 13px; font-size: 0.87rem;
  }
  .lw-lh__cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; max-width: 520px; }
  .lw-lh__card {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 14px 15px;
  }
  .lw-lh__cardlabel {
    display: flex; align-items: center; gap: 5px;
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.05em;
    text-transform: uppercase; color: var(--ink-soft);
  }
  .lw-lh__cardvalue { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; margin: 7px 0 2px; }
  .lw-lh__cardnote { font-size: 0.76rem; color: var(--ink-soft); }
  .lw-lh__notyet {
    background: var(--surface-2); border-radius: var(--radius-sm);
    padding: 15px 17px; margin-top: 24px; max-width: 66ch;
  }
  .lw-lh__notyet strong {
    display: block; font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 7px;
  }
  .lw-lh__notyet p { font-size: 0.85rem; color: var(--ink-soft); margin: 0; line-height: 1.6; }
  .lw-lh__spin { animation: lwLhSpin 0.9s linear infinite; }
  @keyframes lwLhSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-lh__spin { animation: none; } }
`;
