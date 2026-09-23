import { useEffect, useState } from "react";
import {
  LoaderCircle, BookOpen, CheckCircle2, ClipboardCheck, Award, Trophy, Clock, PlayCircle, ChevronRight, Sparkles, ArrowRight, Play
} from "lucide-react";
import * as api from "../api/client";
import AssetImage from "../components/AssetImage";
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

/** "0 min" / "45 min" / "2h" / "2h 15m" — minutes alone past the first hour reads worse than the split. */
function formatMinutes(t, total) {
  if (!total) return t("learnerHome.zeroMin");
  if (total < 60) return `${total} ${t("learnerHome.min")}`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}${t("learnerHome.hour")}` : `${h}${t("learnerHome.hour")} ${m}${t("learnerHome.minShort")}`;
}

export default function LearnerHomeScreen({ onContinueLesson }) {
  const { session, workspace, me } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [setup, setSetup] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
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
        <style>{CSS}</style>
        <div className="lw-lh__loading">
          <LoaderCircle size={22} className="lw-lh__spin" />
          <span>{t("learnerHome.loading")}</span>
        </div>
      </div>
    );
  }

  const enrolled = stats.enrolledProductsCount > 0;
  const courseCompletionPercent = (enrolled && stats.enrolledProductsCount > 0)
    ? Math.round((stats.completedProductsCount / stats.enrolledProductsCount) * 100)
    : 0;
  const lessonCompletionPercent = (enrolled && stats.totalLessonsCount > 0)
    ? Math.round((stats.completedLessonsCount / stats.totalLessonsCount) * 100)
    : 0;

  return (
    <div className="lw-page lw-dashboard-page">
      <style>{CSS}</style>

      {/* Hero Welcome Banner */}
      <div className="lw-db-hero">
        <div className="lw-db-hero__content">
          <div className="lw-db-eyebadge">
            <Sparkles size={12} />
            <span>{setup.name}</span>
          </div>
          <h1 className="lw-db-title">
            {firstName ? t("home.welcomeNamed", { name: firstName }) : t("home.welcome")}
          </h1>
          <p className="lw-db-subtitle">
            Track your progress, resume your lessons, and achieve your learning goals.
          </p>
        </div>
      </div>

      {/* Continue Learning Section */}
      {stats.continueLearning.length > 0 && (
        <div className="lw-db-section">
          <div className="lw-db-sectionheader">
            <div className="lw-db-sectionicon">
              <PlayCircle size={20} />
            </div>
            <div>
              <h2 className="lw-db-sectiontitle">{t("learnerHome.continueLearning")}</h2>
              <div className="lw-db-sectionsubtitle">{t("learnerHome.continueSubtitle")}</div>
            </div>
          </div>

          <div className="lw-db-continuelist">
            {stats.continueLearning.map((c) => (
              <div
                key={c.lessonId}
                className="lw-db-resumecard"
                onClick={() => onContinueLesson?.(c.productId, c.lessonId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onContinueLesson?.(c.productId, c.lessonId); }}
              >
                <div className={`lw-db-resumethumb ${c.productCoverImageAssetId ? "" : `lw-cover--${coverVariant(c.productId)}`}`}>
                  {c.productCoverImageAssetId && (
                    <AssetImage
                      batch
                      className="lw-db-resumeimg"
                      alt=""
                      token={session?.token}
                      slug={slug}
                      assetId={c.productCoverImageAssetId}
                    />
                  )}
                  <div className="lw-db-playoverlay">
                    <span className="lw-db-playbtn">
                      <Play size={20} className="lw-db-playicon" />
                    </span>
                  </div>
                </div>

                <div className="lw-db-resumebody">
                  <div className="lw-db-resumecourse">{c.productTitle}</div>
                  <h3 className="lw-db-resumetitle">{c.lessonTitle}</h3>
                  <div className="lw-db-resumemeta">
                    <span className="lw-db-tag">
                      <BookOpen size={11} />
                      {t("learnerHome.lesson")}
                    </span>
                    {c.estimatedMinutes != null && (
                      <span className="lw-db-tag">
                        <Clock size={11} />
                        {c.estimatedMinutes} {t("learnerHome.minShort")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="lw-db-resumeaction">
                  <span className="lw-db-actbtn">
                    <span>{t("learnerHome.continueButton")}</span>
                    <ArrowRight size={15} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics / Progress Overview Grid */}
      <div className="lw-db-section">
        <div className="lw-db-statsgrid">
          {/* 1. Enrolled Courses */}
          <div className="lw-db-statcard lw-db-statcard--courses">
            <div className="lw-db-statcard__top">
              <span className="lw-db-staticon">
                <BookOpen size={18} />
              </span>
              <span className="lw-db-stattrend">Active</span>
            </div>
            <div className="lw-db-statcard__val">
              {stats.enrolledProductsCount}
            </div>
            <div className="lw-db-statcard__title">
              {t("learnerHome.enrolledCourses")}
            </div>
            <div className="lw-db-statcard__note">
              Courses currently enrolled
            </div>
          </div>

          {/* 2. Courses Completed */}
          <div className="lw-db-statcard lw-db-statcard--completed">
            <div className="lw-db-statcard__top">
              <span className="lw-db-staticon">
                <Trophy size={18} />
              </span>
              {enrolled && (
                <span className="lw-db-stattrend lw-db-stattrend--pct">
                  {courseCompletionPercent}%
                </span>
              )}
            </div>
            <div className="lw-db-statcard__val">
              {enrolled ? (
                <>
                  {stats.completedProductsCount}
                  <span className="lw-db-statof">/ {stats.enrolledProductsCount}</span>
                </>
              ) : "—"}
            </div>
            <div className="lw-db-statcard__title">
              {t("learnerHome.coursesCompleted")}
            </div>
            {enrolled && stats.enrolledProductsCount > 0 ? (
              <div className="lw-db-statprogress">
                <div className="lw-db-statprogress__fill" style={{ width: `${courseCompletionPercent}%` }} />
              </div>
            ) : (
              <div className="lw-db-statcard__note">Completed curriculum</div>
            )}
          </div>

          {/* 3. Lessons Completed */}
          <div className="lw-db-statcard lw-db-statcard--lessons">
            <div className="lw-db-statcard__top">
              <span className="lw-db-staticon">
                <CheckCircle2 size={18} />
              </span>
              {enrolled && (
                <span className="lw-db-stattrend lw-db-stattrend--pct">
                  {lessonCompletionPercent}%
                </span>
              )}
            </div>
            <div className="lw-db-statcard__val">
              {enrolled ? (
                <>
                  {stats.completedLessonsCount}
                  <span className="lw-db-statof">/ {stats.totalLessonsCount}</span>
                </>
              ) : "—"}
            </div>
            <div className="lw-db-statcard__title">
              {t("learnerHome.lessonsCompleted")}
            </div>
            {enrolled && stats.totalLessonsCount > 0 ? (
              <div className="lw-db-statprogress">
                <div className="lw-db-statprogress__fill" style={{ width: `${lessonCompletionPercent}%` }} />
              </div>
            ) : (
              <div className="lw-db-statcard__note">All finished checkpoints</div>
            )}
          </div>

          {/* 4. Time Invested */}
          <div className="lw-db-statcard lw-db-statcard--time">
            <div className="lw-db-statcard__top">
              <span className="lw-db-staticon">
                <Clock size={18} />
              </span>
            </div>
            <div className="lw-db-statcard__val">
              {enrolled ? formatMinutes(t, stats.timeInvestedMinutes) : "—"}
            </div>
            <div className="lw-db-statcard__title">
              {t("learnerHome.timeInvested")}
            </div>
            <div className="lw-db-statcard__note">
              Total interactive study time
            </div>
          </div>

          {/* 5. Assessments Passed */}
          <div className="lw-db-statcard lw-db-statcard--assessments">
            <div className="lw-db-statcard__top">
              <span className="lw-db-staticon">
                <ClipboardCheck size={18} />
              </span>
            </div>
            <div className="lw-db-statcard__val">
              {enrolled ? stats.passedAssessmentsCount : "—"}
            </div>
            <div className="lw-db-statcard__title">
              {t("learnerHome.assessmentsPassed")}
            </div>
            <div className="lw-db-statcard__note">
              Passing submissions recorded
            </div>
          </div>

          {/* 6. Certificates */}
          <div className="lw-db-statcard lw-db-statcard--certs is-placeholder">
            <div className="lw-db-statcard__top">
              <span className="lw-db-staticon">
                <Award size={18} />
              </span>
              <span className="lw-db-badge-soon">{t("learnerHome.notBuiltYet")}</span>
            </div>
            <div className="lw-db-statcard__val">—</div>
            <div className="lw-db-statcard__title">
              {t("learnerHome.certificates")}
            </div>
            <div className="lw-db-statcard__note">
              Verified credentials
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .lw-dashboard-page {
    max-width: 960px;
    margin: 0 auto;
    padding-bottom: 56px;
  }

  .lw-lh__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--ink-soft);
    padding: 60px 0;
    font-size: 0.95rem;
    font-weight: 500;
  }
  .lw-lh__spin {
    animation: lwLhSpin 0.8s linear infinite;
    color: var(--accent);
  }
  @keyframes lwLhSpin { to { transform: rotate(360deg); } }

  /* Hero Welcome Banner */
  .lw-db-hero {
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--line);
    text-align: start;
  }
  .lw-db-eyebadge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
    padding: 3px 10px;
    border-radius: 9999px;
    margin-bottom: 8px;
  }
  .lw-db-title {
    font-family: var(--font-body, system-ui);
    font-size: 2.1rem;
    font-weight: 700;
    color: var(--ink);
    margin: 4px 0 6px;
    letter-spacing: -0.02em;
    line-height: 1.2;
    text-align: start;
  }
  .lw-db-subtitle {
    font-size: 0.95rem;
    color: var(--ink-soft);
    margin: 0;
    line-height: 1.5;
  }

  /* Section Wrapper */
  .lw-db-section {
    margin-bottom: 32px;
  }
  .lw-db-sectionheader {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .lw-db-sectionicon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .lw-db-sectiontitle {
    font-family: var(--font-body, system-ui);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
    letter-spacing: -0.01em;
  }
  .lw-db-sectionsubtitle {
    font-size: 0.8rem;
    color: var(--ink-soft);
    margin-top: 1px;
  }

  /* Continue Learning Cards */
  .lw-db-continuelist {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .lw-db-resumecard {
    display: flex;
    align-items: center;
    gap: 20px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius, 16px);
    padding: 14px 18px 14px 14px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 6px rgba(0,0,0,0.02);
    text-align: start;
  }
  .lw-db-resumecard:hover {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
    background: color-mix(in srgb, var(--accent) 3%, var(--surface));
    transform: translateY(-2px);
    box-shadow: 0 8px 24px -4px rgba(0,0,0,0.08);
  }

  .lw-db-resumethumb {
    position: relative;
    width: 170px;
    height: 100px;
    border-radius: 10px;
    overflow: hidden;
    background: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .lw-db-resumeimg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lw-db-playoverlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }
  .lw-db-resumecard:hover .lw-db-playoverlay {
    background: rgba(0,0,0,0.4);
  }
  .lw-db-playbtn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.92);
    color: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .lw-db-playicon {
    margin-inline-start: 2px;
  }
  .lw-db-resumecard:hover .lw-db-playbtn {
    transform: scale(1.1);
    background: #fff;
  }

  .lw-db-resumebody {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lw-db-resumecourse {
    font-size: 0.76rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent);
  }
  .lw-db-resumetitle {
    font-family: var(--font-body, system-ui);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }
  .lw-db-resumemeta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .lw-db-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--ink-soft);
    background: var(--surface-2, rgba(0,0,0,0.04));
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 500;
  }

  .lw-db-resumeaction {
    flex-shrink: 0;
  }
  .lw-db-actbtn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: var(--accent);
    color: var(--on-accent, #fff);
    font-family: var(--font-body);
    font-size: 0.84rem;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 9999px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 26%, transparent);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .lw-db-resumecard:hover .lw-db-actbtn {
    box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 38%, transparent);
    transform: translateX(2px);
  }
  [dir="rtl"] .lw-db-actbtn svg { transform: scaleX(-1); }

  /* Metrics Grid */
  .lw-db-statsgrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .lw-db-statcard {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius, 16px);
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    text-align: start;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  }
  .lw-db-statcard:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
    box-shadow: 0 6px 16px -2px rgba(0,0,0,0.05);
  }

  .lw-db-statcard__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .lw-db-staticon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .lw-db-statcard--courses .lw-db-staticon {
    background: color-mix(in srgb, #E0912E 14%, transparent);
    color: #E0912E;
  }
  .lw-db-statcard--completed .lw-db-staticon {
    background: color-mix(in srgb, #1FA971 14%, transparent);
    color: #1FA971;
  }
  .lw-db-statcard--lessons .lw-db-staticon {
    background: color-mix(in srgb, #3E6FE0 14%, transparent);
    color: #3E6FE0;
  }
  .lw-db-statcard--time .lw-db-staticon {
    background: color-mix(in srgb, #8B5CF6 14%, transparent);
    color: #8B5CF6;
  }
  .lw-db-statcard--assessments .lw-db-staticon {
    background: color-mix(in srgb, #E0537B 14%, transparent);
    color: #E0537B;
  }
  .lw-db-statcard--certs .lw-db-staticon {
    background: color-mix(in srgb, #C9971C 14%, transparent);
    color: #C9971C;
  }

  .lw-db-stattrend {
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-soft);
    background: var(--surface-2, rgba(0,0,0,0.04));
    padding: 3px 8px;
    border-radius: 9999px;
  }
  .lw-db-stattrend--pct {
    color: var(--success, #1E7D61);
    background: color-mix(in srgb, var(--success, #1E7D61) 12%, transparent);
  }

  .lw-db-badge-soon {
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-soft);
    background: var(--surface-2, rgba(0,0,0,0.04));
    padding: 2px 7px;
    border-radius: 6px;
  }

  .lw-db-statcard__val {
    font-family: var(--font-body, system-ui);
    font-size: 1.85rem;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.2;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .lw-db-statof {
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--ink-soft);
    margin-inline-start: 4px;
  }

  .lw-db-statcard__title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 2px;
  }
  .lw-db-statcard__note {
    font-size: 0.78rem;
    color: var(--ink-soft);
    margin-top: 2px;
  }

  .lw-db-statprogress {
    width: 100%;
    height: 5px;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--line) 60%, transparent);
    overflow: hidden;
    margin-top: 8px;
  }
  .lw-db-statprogress__fill {
    height: 100%;
    border-radius: 9999px;
    background: linear-gradient(90deg, var(--accent-2), var(--accent));
  }

  .lw-db-statcard.is-placeholder {
    opacity: 0.8;
  }

  @media (max-width: 860px) {
    .lw-db-statsgrid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 640px) {
    .lw-db-statsgrid {
      grid-template-columns: 1fr;
    }
    .lw-db-resumecard {
      flex-direction: column;
      align-items: stretch;
      padding: 14px;
    }
    .lw-db-resumethumb {
      width: 100%;
      height: 160px;
    }
    .lw-db-resumeaction {
      margin-top: 8px;
    }
    .lw-db-actbtn {
      width: 100%;
      justify-content: center;
      padding: 10px;
    }
    .lw-db-title {
      font-size: 1.6rem;
    }
  }
`;

