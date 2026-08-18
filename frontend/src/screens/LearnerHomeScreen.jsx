import { useEffect, useRef, useState } from "react";
import {
  LoaderCircle, BookOpen, CheckCircle2, ClipboardCheck, Award, Trophy, Clock, PlayCircle, ChevronRight,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/** A small, fixed palette so a course with no cover photo still gets a stable color — matches ProductsScreen/LearnerCoursesScreen. */
const COVER_VARIANTS = 5;
function coverVariant(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return hash % COVER_VARIANTS;
}

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
function formatMinutes(t, total) {
  if (!total) return t("learnerHome.zeroMin");
  if (total < 60) return `${total} ${t("learnerHome.min")}`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}${t("learnerHome.hour")}` : `${h}${t("learnerHome.hour")} ${m}${t("learnerHome.minShort")}`;
}

/** A stat card reads as "what is this measuring" first, the number second — title carries the weight, the value is a colored accent underneath it, not the headline. */
function StatCard({ icon: Icon, color, title, value, note, muted }) {
  const style = muted ? undefined : {
    "--card-bg": `color-mix(in srgb, ${color.icon} 16%, var(--surface-2))`,
    "--card-icon": color.icon,
  };
  return (
    <div className={`lw-lh__card ${muted ? "is-muted" : ""}`} style={style}>
      <div className="lw-lh__cardicon"><Icon size={17} /></div>
      <div className="lw-lh__cardtitle">{title}</div>
      <div className="lw-lh__cardvalue">{value}</div>
      {note && <div className="lw-lh__cardnote">{note}</div>}
    </div>
  );
}

/* Backgrounds are derived (color-mix against --surface-2, see StatCard) so
   these tints stay a light accent wash in Light mode and a muted dark-surface
   wash in Dark mode, instead of a hardcoded pastel fighting the page. */
const CARD_COLORS = {
  courses: { icon: "#E0912E" },
  completedCourses: { icon: "#1FA971" },
  lessons: { icon: "#3E6FE0" },
  time: { icon: "#8B5CF6" },
  assessments: { icon: "#E0537B" },
  certificates: { icon: "#C9971C" },
};

export default function LearnerHomeScreen({ onContinueLesson }) {
  const { session, workspace, me } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [setup, setSetup] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const continueRowRef = useRef(null);

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
    return <div className="lw-page"><Message type="error">{error}</Message></div>;
  }
  if (!setup || !stats) {
    return (
      <div className="lw-page">
        <div className="lw-lh__loading"><LoaderCircle size={18} className="lw-lh__spin" /> {t("learnerHome.loading")}</div>
      </div>
    );
  }

  const enrolled = stats.enrolledProductsCount > 0;

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{setup.name}</div>
      <h1>{firstName ? t("home.welcomeNamed", { name: firstName }) : t("home.welcome")}</h1>

      {stats.continueLearning.length > 0 && (
        <div className="lw-lh__continuewrap">
          <div className="lw-lh__continuelabel">{t("learnerHome.continueLearning")}</div>
          <div className="lw-lh__continuerow" ref={continueRowRef}>
            {stats.continueLearning.map((c) => (
              <button key={c.lessonId} className="lw-lh__continuecard"
                      onClick={() => onContinueLesson?.(c.productId, c.lessonId)}>
                <div className={`lw-lh__continuethumb ${c.productCoverImageAssetId ? "" : `lw-cover--${coverVariant(c.productId)}`}`}>
                  {c.productCoverImageAssetId && (
                    <img className="lw-lh__continueimg" alt=""
                         src={api.learningAssetDownloadUrl(session.token, slug, c.productCoverImageAssetId)} />
                  )}
                  <span className="lw-lh__continueplay"><PlayCircle size={30} /></span>
                </div>
                <div className="lw-lh__continuebody">
                  <div className="lw-lh__continuecourse">{c.productTitle}</div>
                  <div className="lw-lh__continuetitle">{c.lessonTitle}</div>
                  <div className="lw-lh__continuemeta">
                    {t("learnerHome.lesson")}
                    {c.estimatedMinutes != null && <> · {c.estimatedMinutes}{t("learnerHome.minShort")}</>}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {stats.continueLearning.length > 3 && (
            <button className="lw-lh__continuescroll" aria-label={t("learnerHome.scrollMore")}
                    onClick={() => continueRowRef.current?.scrollBy({ left: 320, behavior: "smooth" })}>
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      )}

      <div className="lw-lh__cards">
        <StatCard
          icon={BookOpen} color={CARD_COLORS.courses} title={t("learnerHome.enrolledCourses")}
          value={stats.enrolledProductsCount}
        />

        <StatCard
          icon={Trophy} color={CARD_COLORS.completedCourses} title={t("learnerHome.coursesCompleted")}
          value={enrolled ? <>{stats.completedProductsCount} <span className="lw-lh__cardof">{t("learnerHome.of")} {stats.enrolledProductsCount}</span></> : "—"}

        />

        <StatCard
          icon={CheckCircle2} color={CARD_COLORS.lessons} title={t("learnerHome.lessonsCompleted")}
          value={enrolled ? <>{stats.completedLessonsCount} <span className="lw-lh__cardof">{t("learnerHome.of")} {stats.totalLessonsCount}</span></> : "—"}

        />

        <StatCard
          icon={Clock} color={CARD_COLORS.time} title={t("learnerHome.timeInvested")}
          value={enrolled ? formatMinutes(t, stats.timeInvestedMinutes) : "—"}

        />

        <StatCard
          icon={ClipboardCheck} color={CARD_COLORS.assessments} title={t("learnerHome.assessmentsPassed")}
          value={enrolled ? stats.passedAssessmentsCount : "—"}

        />

        <StatCard icon={Award} color={CARD_COLORS.certificates} title={t("learnerHome.certificates")} value="—" note={t("learnerHome.notBuiltYet")} />
      </div>
    </div>
  );
}

const CSS = `
  .lw-lh__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-lh__continuewrap { position: relative; max-width: 900px; margin: 0 auto 22px; }
  .lw-lh__continuelabel {
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--ink-soft); margin-bottom: 9px;
  }
  .lw-lh__continuerow {
    display: flex; gap: 14px; overflow-x: auto; padding-bottom: 4px;
    scroll-snap-type: x proximity;
  }
  .lw-lh__continuecard {
    display: flex; flex-direction: column; text-align: start; cursor: pointer; padding: 0;
    flex: 0 0 240px; scroll-snap-align: start;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    overflow: hidden; font-family: var(--font-body);
  }
  .lw-lh__continuecard:hover { border-color: var(--accent); }
  .lw-lh__continuethumb { height: 110px; position: relative; display: flex; align-items: center; justify-content: center; }
  .lw-lh__continueimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .lw-lh__continueplay { position: relative; color: rgba(255,255,255,0.92); display: flex; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35)); }
  .lw-lh__continuebody { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 3px; }
  .lw-lh__continuecourse { font-size: 0.72rem; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lw-lh__continuetitle { font-family: var(--font-display); font-size: 0.92rem; font-weight: 600; color: var(--ink); line-height: 1.3; }
  .lw-lh__continuemeta { font-size: 0.76rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-lh__continuescroll {
    position: absolute; top: 50%; inset-inline-end: -6px; transform: translateY(-6px);
    width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--surface); border: 1px solid var(--line); color: var(--ink-soft); cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
  }
  .lw-lh__continuescroll:hover { color: var(--ink); }
  [dir="rtl"] .lw-lh__continuescroll { transform: translateY(-6px) scaleX(-1); }
  .lw-lh__cards {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 14px;
    max-width: 900px; margin: 0 auto;
  }
  .lw-lh__card {
    background: var(--card-bg, var(--surface-2)); border: 1px solid transparent;
    border-radius: 16px; padding: 16px 18px; width: 160px;
    display: flex; flex-direction: column; align-items: flex-start;
    position: relative;
  }
  .lw-lh__card.is-muted { background: var(--surface-2); border: 1px dashed var(--line); opacity: 0.75; }
  /* Notebook theme: dog-eared page corner (2026-08-15). */
  .lw-lh__card::after {
    content: ""; position: absolute; top: 0; inset-inline-end: 0; width: 0; height: 0;
    border-style: solid; border-width: 0 12px 12px 0;
    border-color: transparent var(--line) transparent transparent;
    filter: drop-shadow(-1px 1px 1.5px rgba(0,0,0,0.18));
    pointer-events: none;
  }
  [dir="rtl"] .lw-lh__card::after { transform: scaleX(-1); }
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
