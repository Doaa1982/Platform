import { useEffect, useState } from "react";
import {
  LoaderCircle, AlertCircle, BookOpen, CheckCircle2, ClipboardCheck, Award, Trophy, Clock, ArrowRight,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";

/* =========================================================================
   LEARNER HOME — what a learner sees in a workspace they belong to.

   Replaces the prototype's learner dashboard, which showed courses, streaks
   and progress bars from fixture data. Presented to a real learner those were
   claims about study they had never done, in courses that do not exist.

   Learning Products, curriculum, lesson progress and graded assessments are
   real now (Learning Workspace Delivery Context) — the stat cards below read
   LearningDeliveryService.GetStatsAsync, not fixtures. Certificates still
   have no backing aggregate anywhere in the domain, so that card stays a
   static "not built" placeholder rather than a fabricated number.
   ========================================================================= */

/** "0 min" / "45 min" / "2h" / "2h 15m" — minutes alone past the first hour reads worse than the split. */
function formatMinutes(total) {
  if (!total) return "0 min";
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** A stat card reads as "what is this measuring" first, the number second — title carries the weight, the value is a colored accent underneath it, not the headline. */
function StatCard({ icon: Icon, color, title, value, note, muted }) {
  return (
    <div className={`lw-lh__card ${muted ? "is-muted" : ""}`} style={muted ? undefined : { "--card-bg": color.bg, "--card-icon": color.icon }}>
      <div className="lw-lh__cardicon"><Icon size={17} /></div>
      <div className="lw-lh__cardtitle">{title}</div>
      <div className="lw-lh__cardvalue">{value}</div>
      {note && <div className="lw-lh__cardnote">{note}</div>}
    </div>
  );
}

const CARD_COLORS = {
  courses: { bg: "#FFF1DF", icon: "#E0912E" },
  completedCourses: { bg: "#E4F7EE", icon: "#1FA971" },
  lessons: { bg: "#E9F0FE", icon: "#3E6FE0" },
  time: { bg: "#F3EBFC", icon: "#8B5CF6" },
  assessments: { bg: "#FDEAF0", icon: "#E0537B" },
  certificates: { bg: "#FEF6DD", icon: "#C9971C" },
};

export default function LearnerHomeScreen({ onContinueLesson }) {
  const { session, workspace, me } = useAuth();
  const slug = workspace?.slug;

  const [setup, setSetup] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Any active member may read this; it carries no management detail
    Promise.all([
      api.getSetup(session.token, slug),
      api.getLearnerStats(session.token, slug),
    ])
      .then(([s, st]) => { if (!cancelled) { setSetup(s); setStats(st); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  const firstName = (me?.fullName ?? "").trim().split(" ")[0];

  if (error) {
    return <div className="lw-page"><div className="lw-lh__alert"><AlertCircle size={16} /> {error}</div></div>;
  }
  if (!setup || !stats) {
    return (
      <div className="lw-page">
        <div className="lw-lh__loading"><LoaderCircle size={18} className="lw-lh__spin" /> Loading…</div>
      </div>
    );
  }

  const enrolled = stats.enrolledProductsCount > 0;

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{setup.name}</div>
      <h1>Welcome{firstName ? `, ${firstName}` : ""}.</h1>
     

      {stats.continueLearning && (
        <button className="lw-lh__continue" onClick={() => onContinueLesson?.(stats.continueLearning.productId, stats.continueLearning.lessonId)}>
          <div className="lw-lh__continuetext">
            <div className="lw-lh__continuelabel">Continue learning</div>
            <div className="lw-lh__continuetitle">{stats.continueLearning.lessonTitle}</div>
            <div className="lw-lh__continuesub">{stats.continueLearning.productTitle}</div>
          </div>
          <ArrowRight size={18} />
        </button>
      )}

      <div className="lw-lh__cards">
        <StatCard
          icon={BookOpen} color={CARD_COLORS.courses} title="Enrolled courses"
          value={stats.enrolledProductsCount} 
        />

        <StatCard
          icon={Trophy} color={CARD_COLORS.completedCourses} title="Courses completed"
          value={enrolled ? <>{stats.completedProductsCount} <span className="lw-lh__cardof">of {stats.enrolledProductsCount}</span></> : "—"}
         
        />

        <StatCard
          icon={CheckCircle2} color={CARD_COLORS.lessons} title="Lessons completed"
          value={enrolled ? <>{stats.completedLessonsCount} <span className="lw-lh__cardof">of {stats.totalLessonsCount}</span></> : "—"}
          
        />

        <StatCard
          icon={Clock} color={CARD_COLORS.time} title="Time invested"
          value={enrolled ? formatMinutes(stats.timeInvestedMinutes) : "—"}
          
        />

        <StatCard
          icon={ClipboardCheck} color={CARD_COLORS.assessments} title="Assessments passed"
          value={enrolled ? stats.passedAssessmentsCount : "—"}
          
        />

        <StatCard icon={Award} color={CARD_COLORS.certificates} title="Certificates" value="—" note="not built yet" />
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
  .lw-lh__continue {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    width: 100%; max-width: 800px; text-align: start; cursor: pointer;
    background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm);
    padding: 16px 20px; margin-bottom: 18px; font-family: var(--font-body);
  }
  .lw-lh__continue:hover { transform: translateY(-1px); }
  .lw-lh__continue svg { flex-shrink: 0; opacity: 0.85; }
  .lw-lh__continuelabel {
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em;
    text-transform: uppercase; opacity: 0.8; margin-bottom: 4px;
  }
  .lw-lh__continuetitle { font-family: var(--font-display); font-size: 1.05rem; font-weight: 600; }
  .lw-lh__continuesub { font-size: 0.82rem; opacity: 0.85; margin-top: 2px; }
  .lw-lh__cards {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 14px;
    max-width: 900px; margin: 0 auto;
  }
  .lw-lh__card {
    background: var(--card-bg, var(--surface-2)); border: 1px solid transparent;
    border-radius: 16px; padding: 16px 18px; width: 160px;
    display: flex; flex-direction: column; align-items: flex-start;
  }
  .lw-lh__card.is-muted { background: var(--surface-2); border: 1px dashed var(--line); opacity: 0.75; }
  .lw-lh__cardicon {
    width: 34px; height: 34px; border-radius: 9px; margin-bottom: 10px;
    display: flex; align-items: center; justify-content: center;
    background: var(--card-icon, var(--ink-soft)); color: #fff;
  }
  .lw-lh__card.is-muted .lw-lh__cardicon { background: var(--line); color: var(--ink-soft); }
  .lw-lh__cardtitle {
    font-family: var(--font-display); font-size: 0.98rem; font-weight: 700;
    line-height: 1.25; margin-bottom: 6px;
  }
  .lw-lh__cardvalue { font-size: 0.92rem; font-weight: 600; color: var(--card-icon, var(--ink-soft)); }
  .lw-lh__card.is-muted .lw-lh__cardvalue { color: var(--ink-soft); }
  .lw-lh__cardof { font-size: 0.8rem; font-weight: 500; color: var(--ink-soft); }
  .lw-lh__cardnote { font-size: 0.76rem; color: var(--ink-soft); margin-top: 3px; }
  .lw-lh__spin { animation: lwLhSpin 0.9s linear infinite; }
  @keyframes lwLhSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-lh__spin { animation: none; } }
`;
