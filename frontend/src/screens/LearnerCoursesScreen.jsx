import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle, ArrowLeft, BookOpen, CheckCircle2, PlayCircle, Lock,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   COURSES — a Learner's Published products and their Published curriculum.

   Mirrors ContentStudioScreen's own picker/detail split (productId prop +
   onSelectProduct callback owned by App.jsx), but read-only: no editing, no
   drafts, no unpublished units or lessons — only what a Learner may actually
   see (Learning Delivery Context's ownership boundary).
   ========================================================================= */

/** A small, fixed palette so each product gets a stable "cover" color from its id — matches ProductsScreen/ContentStudioScreen. */
const COVER_VARIANTS = 5;
function coverVariant(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return hash % COVER_VARIANTS;
}

export default function LearnerCoursesScreen({ productId, onSelectProduct, onOpenLesson }) {
  return productId
    ? <CurriculumView key={productId} productId={productId} onBack={() => onSelectProduct(null)} onOpenLesson={onOpenLesson} />
    : <ProductPicker onSelect={onSelectProduct} />;
}

function ProductPicker({ onSelect }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [requestingId, setRequestingId] = useState(null);

  const load = useCallback(() => api.getLearnerProducts(session.token, slug)
    .then((d) => { setData(d); setError(null); })
    .catch((e) => setError(e.message)),
    [session.token, slug]);

  useEffect(() => { load(); }, [load]);

  const requestToJoin = (productId) => {
    setRequestingId(productId);
    api.submitCourseJoinRequest(session.token, slug, productId)
      .then(load)
      .catch((e) => setError(e.message))
      .finally(() => setRequestingId(null));
  };

  if (error) {
    return <div className="lw-page"><style>{CSS}</style><Message type="error">{error}</Message></div>;
  }
  if (!data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> {t("learnerCourses.loading")}</div>
      </div>
    );
  }

  return (
    <div className="lw-page lw-courses-page">
      <style>{CSS}</style>
      <div className="lw-courses-header">
        <div className="lw-eyebrow">{t("learnerCourses.eyebrowCourses")}</div>
        <h1 className="lw-courses-title">{t("learnerCourses.learnTitle")}</h1>
        <p className="lw-sub">{t("learnerCourses.learnLead")}</p>
      </div>

      {data.products.length === 0 && (
        <div className="lw-learn__empty">
          <BookOpen size={32} className="lw-learn__emptyicon" />
          <h2>{t("learnerCourses.nothingPublishedTitle")}</h2>
          <p>{t("learnerCourses.nothingPublishedBody")}</p>
        </div>
      )}

      <div className="lw-courses-grid">
        {data.products.map((p) => {
          const needsRequest = p.enrollmentMode === "ApprovalRequired" && !p.isEnrolled;
          const cover = (
            <div className={`lw-course-cover ${p.coverImageAssetId ? "" : `lw-cover--${coverVariant(p.id)}`}`}>
              {p.coverImageAssetId ? (
                <img className="lw-course-coverimg" alt="" src={api.learningAssetDownloadUrl(session.token, slug, p.coverImageAssetId)} />
              ) : (
                <span className="lw-course-monogram">{(p.title.trim()[0] ?? "?").toUpperCase()}</span>
              )}
              {p.isEnrolled && (
                <span className="lw-course-enrolledbadge">
                  <CheckCircle2 size={12} /> Enrolled
                </span>
              )}
            </div>
          );

          if (needsRequest) {
            return (
              <div className="lw-course-card is-locked" key={p.id}>
                {cover}
                <div className="lw-course-body">
                  <h3 className="lw-course-cardtitle">{p.title}</h3>
                  {p.description && <p className="lw-course-desc">{p.description}</p>}
                  <div className="lw-course-footer">
                    {p.hasPendingRequest ? (
                      <span className="lw-course-pendingtag">{t("learnerCourses.pendingApproval")}</span>
                    ) : (
                      <button
                        type="button" className="lw-course-btn lw-course-btn--request"
                        disabled={requestingId === p.id}
                        onClick={() => requestToJoin(p.id)}
                      >
                        {t("learnerCourses.requestToJoin")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              className={`lw-course-card ${!p.hasContent ? "is-empty" : ""}`} key={p.id}
              onClick={() => p.hasContent && onSelect(p.id)}
              role={p.hasContent ? "button" : undefined}
              tabIndex={p.hasContent ? 0 : undefined}
              onKeyDown={(e) => { if (p.hasContent && (e.key === "Enter" || e.key === " ")) onSelect(p.id); }}
            >
              {cover}
              <div className="lw-course-body">
                <h3 className="lw-course-cardtitle">{p.title}</h3>
                {p.description && <p className="lw-course-desc">{p.description}</p>}
                <div className="lw-course-footer">
                  {!p.hasContent ? (
                    <span className="lw-course-emptynote">{t("learnerCourses.nothingInsideYet")}</span>
                  ) : (
                    <span className="lw-course-btn lw-course-btn--open">
                      <span>Explore Course</span>
                      <PlayCircle size={15} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CurriculumView({ productId, onBack, onOpenLesson }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(
    () => api.getLearnerCurriculum(session.token, slug, productId)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message)),
    [session.token, slug, productId]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="lw-page lw-curriculum-page">
        <style>{CSS}</style>
        <BackLink onBack={onBack} />
        <Message type="error">{error}</Message>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="lw-page lw-curriculum-page">
        <style>{CSS}</style>
        <BackLink onBack={onBack} />
        <div className="lw-learn__loading"><LoaderCircle size={22} className="lw-learn__spin" /> {t("learnerCourses.loading")}</div>
      </div>
    );
  }

  const allLessons = data.units.flatMap((u) => u.lessons || []);
  const totalMins = allLessons.reduce((acc, l) => acc + (l.estimatedMinutes || 0), 0);
  const doneLessons = allLessons.filter((l) => l.progressStatus === "Completed").length;
  const progressPercent = allLessons.length > 0 ? Math.round((doneLessons / allLessons.length) * 100) : 0;

  return (
    <div className="lw-page lw-curriculum-page">
      <style>{CSS}</style>
      <BackLink onBack={onBack} />

      <div className="lw-curriculum-hero">
        <div className="lw-eyebrow">{t("learnerCourses.eyebrowCourse")}</div>
        <h1 className="lw-curriculum-title">{data.productTitle}</h1>
        
        {/* Course Statistics Strip */}
        <div className="lw-curriculum-stats">
          <div className="lw-curriculum-stat">
            <BookOpen size={16} />
            <span>{data.units.length} {data.units.length === 1 ? "Unit" : "Units"}</span>
          </div>
          <div className="lw-curriculum-stat">
            <PlayCircle size={16} />
            <span>{allLessons.length} {allLessons.length === 1 ? "Lesson" : "Lessons"}</span>
          </div>
          {totalMins > 0 && (
            <div className="lw-curriculum-stat">
              <Clock size={16} />
              <span>{totalMins} {t("lessonSidebar.min")}</span>
            </div>
          )}
          {allLessons.length > 0 && (
            <div className="lw-curriculum-stat lw-curriculum-stat--progress">
              <CheckCircle2 size={16} />
              <span>{doneLessons}/{allLessons.length} {t("learnerCourses.completed")} ({progressPercent}%)</span>
            </div>
          )}
        </div>

        {data.requiresSequentialCompletion && (
          <div className="lw-learn__seqhint"><Lock size={13} /> {t("lessonSidebar.seqHint")}</div>
        )}
      </div>

      {data.units.length === 0 && (
        <div className="lw-learn__empty">
          <BookOpen size={32} className="lw-learn__emptyicon" />
          <h2>{t("learnerCourses.nothingHereTitle")}</h2>
          <p>{t("learnerCourses.nothingHereBody")}</p>
        </div>
      )}

      <div className="lw-curriculum-units">
        {data.units.map((u, i) => {
          const unitDoneCount = u.lessons.filter((l) => l.progressStatus === "Completed").length;
          return (
            <div className="lw-curriculum-unit" key={u.position}>
              <div className="lw-curriculum-unithead">
                <span className="lw-curriculum-unitnum">{i + 1}</span>
                <span className="lw-curriculum-unittitle">{u.title}</span>
                <span className="lw-curriculum-unitmeta">
                  {unitDoneCount}/{u.lessons.length} {t("learnerCourses.completed")}
                </span>
              </div>
              <div className="lw-curriculum-lessonlist">
                {u.lessons.map((l) => {
                  const done = l.progressStatus === "Completed";
                  return (
                    <button
                      className={`lw-curriculum-lessonrow ${done ? "is-done" : ""} ${l.locked ? "is-locked" : ""}`}
                      key={l.id}
                      disabled={l.locked}
                      title={l.locked ? t("lessonSidebar.lockedTitle") : undefined}
                      onClick={() => onOpenLesson(l.id)}
                    >
                      <span className="lw-curriculum-rowicon">
                        {done ? (
                          <CheckCircle2 size={17} className="icon-done" />
                        ) : l.locked ? (
                          <Lock size={15} className="icon-locked" />
                        ) : (
                          <PlayCircle size={17} className="icon-play" />
                        )}
                      </span>
                      <span className="lw-curriculum-lessontitle">{l.title}</span>
                      {l.estimatedMinutes != null && (
                        <span className="lw-curriculum-mins">{l.estimatedMinutes} {t("lessonSidebar.min")}</span>
                      )}
                      {done && (
                        <span className="lw-curriculum-donepill">{t("learnerCourses.completed")}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BackLink({ onBack }) {
  const { t } = useLanguage();
  return (
    <button className="lw-learn__back" onClick={onBack}>
      <ArrowLeft size={14} /> <span>{t("learnerCourses.allCourses")}</span>
    </button>
  );
}

const CSS = `
  .lw-courses-page, .lw-curriculum-page {
    max-width: 1040px; margin: 0 auto; padding-bottom: 56px;
  }
  .lw-courses-header {
    text-align: center; margin-bottom: 32px;
  }
  .lw-courses-title {
    font-size: 2.2rem; font-weight: 700; color: var(--ink); margin: 4px 0 10px; letter-spacing: -0.02em;
  }

  .lw-learn__loading { display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--ink-soft); padding: 50px 0; font-size: 0.95rem; }
  .lw-learn__spin { animation: lwCourseSpin 0.8s linear infinite; color: var(--accent); }
  @keyframes lwCourseSpin { to { transform: rotate(360deg); } }

  .lw-learn__back {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 9999px;
    color: var(--ink); font-family: var(--font-body); font-size: 0.84rem; font-weight: 500;
    cursor: pointer; padding: 6px 14px; margin-bottom: 20px; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .lw-learn__back:hover {
    color: var(--accent); border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--surface)); transform: translateX(-2px);
  }

  .lw-learn__empty {
    text-align: center; color: var(--ink-soft);
    background: var(--surface); border: 1px dashed var(--line);
    border-radius: var(--radius, 16px); padding: 48px 24px; margin-bottom: 24px;
  }
  .lw-learn__emptyicon { color: var(--ink-soft); margin-bottom: 12px; }
  .lw-learn__empty h2 { font-size: 1.15rem; font-weight: 700; color: var(--ink); margin: 0 0 6px; }
  .lw-learn__empty p { font-size: 0.9rem; max-width: 48ch; margin: 0 auto; line-height: 1.55; }

  /* Course Catalog Grid */
  .lw-courses-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;
  }
  .lw-course-card {
    display: flex; flex-direction: column; text-align: start; cursor: pointer; padding: 0;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius, 16px);
    overflow: hidden; font-family: var(--font-body); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.03); position: relative;
  }
  .lw-course-card:hover:not(.is-locked):not(.is-empty) {
    transform: translateY(-3px); border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
    box-shadow: 0 10px 24px -4px rgba(0,0,0,0.08);
  }
  .lw-course-card.is-locked { cursor: default; }
  .lw-course-card.is-empty { opacity: 0.65; cursor: not-allowed; }

  .lw-course-cover {
    height: 140px; position: relative; display: flex; align-items: center; justify-content: center;
    background: #111; overflow: hidden;
  }
  .lw-course-coverimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .lw-course-monogram { font-size: 2.4rem; font-weight: 700; color: rgba(255,255,255,0.92); letter-spacing: -0.02em; }
  .lw-course-enrolledbadge {
    position: absolute; top: 12px; inset-inline-end: 12px;
    background: rgba(30,125,97,0.9); backdrop-filter: blur(6px); color: #fff;
    font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;
    display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }

  .lw-cover--0 { background: linear-gradient(135deg, #2D5BD1, #6D3FC4); }
  .lw-cover--1 { background: linear-gradient(135deg, #1E7F63, #5B8DEF); }
  .lw-cover--2 { background: linear-gradient(135deg, #E0A83E, #C4533F); }
  .lw-cover--3 { background: linear-gradient(135deg, #0EA5A5, #6D3FC4); }
  .lw-cover--4 { background: linear-gradient(135deg, #D1477A, #E0A83E); }

  .lw-course-body { padding: 18px 20px 20px; display: flex; flex-direction: column; flex: 1; }
  .lw-course-cardtitle { font-weight: 700; font-size: 1.15rem; color: var(--ink); margin: 0 0 6px; line-height: 1.35; letter-spacing: -0.01em; }
  .lw-course-desc { font-size: 0.86rem; color: var(--ink-soft); margin: 0 0 16px; line-height: 1.5; flex: 1; }
  .lw-course-footer { display: flex; align-items: center; justify-content: flex-end; margin-top: auto; }
  .lw-course-btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 9999px;
    font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.18s ease;
  }
  .lw-course-btn--open {
    background: color-mix(in srgb, var(--accent) 10%, var(--surface)); color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--line));
  }
  .lw-course-card:hover .lw-course-btn--open {
    background: var(--accent); color: var(--on-accent, #fff); border-color: var(--accent);
  }
  .lw-course-btn--request {
    background: var(--accent); color: var(--on-accent, #fff); border: none;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .lw-course-pendingtag {
    font-size: 11px; font-weight: 600; color: var(--accent-2);
    background: color-mix(in srgb, var(--accent-2) 12%, transparent); padding: 4px 10px; border-radius: 9999px;
  }
  .lw-course-emptynote { font-size: 0.8rem; color: var(--ink-soft); font-style: italic; }

  /* Curriculum Detail View */
  .lw-curriculum-hero {
    text-align: start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--line);
  }
  .lw-curriculum-title {
    font-size: 2.1rem; font-weight: 700; color: var(--ink); margin: 4px 0 14px; letter-spacing: -0.02em; line-height: 1.25;
  }
  .lw-curriculum-stats {
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 12px;
  }
  .lw-curriculum-stat {
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.86rem; font-weight: 500;
    color: var(--ink-soft); background: var(--surface-2, rgba(0,0,0,0.03)); padding: 5px 12px; border-radius: 9999px;
  }
  .lw-curriculum-stat--progress {
    color: var(--success, #1E7D61); background: color-mix(in srgb, var(--success, #1E7D61) 12%, transparent); font-weight: 600;
  }
  .lw-learn__seqhint {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.8rem; color: var(--ink-soft); margin-top: 6px;
  }

  .lw-curriculum-units { display: flex; flex-direction: column; gap: 18px; }
  .lw-curriculum-unit {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius, 16px); padding: 20px 22px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.02);
  }
  .lw-curriculum-unithead {
    display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
  }
  .lw-curriculum-unitnum {
    width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
    background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent);
    display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
  }
  .lw-curriculum-unittitle { font-size: 1.05rem; font-weight: 700; color: var(--ink); flex: 1; letter-spacing: -0.01em; }
  .lw-curriculum-unitmeta { font-size: 0.8rem; font-weight: 600; color: var(--ink-soft); }

  .lw-curriculum-lessonlist { display: flex; flex-direction: column; gap: 8px; }
  .lw-curriculum-lessonrow {
    display: flex; align-items: center; gap: 12px; text-align: start; width: 100%;
    background: var(--bg); border: 1px solid var(--line); border-radius: 12px;
    padding: 12px 16px; cursor: pointer; font-family: var(--font-body); color: var(--ink);
    transition: all 0.18s ease;
  }
  .lw-curriculum-lessonrow:hover:not(.is-locked) {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
    background: color-mix(in srgb, var(--accent) 3%, var(--surface));
    transform: translateX(2px);
  }
  .lw-curriculum-lessonrow.is-done {
    border-color: color-mix(in srgb, var(--success, #1E7D61) 25%, var(--line));
  }
  .lw-curriculum-lessonrow.is-locked { cursor: not-allowed; opacity: 0.5; }
  .lw-curriculum-rowicon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .lw-curriculum-rowicon .icon-done { color: var(--success, #1E7D61); }
  .lw-curriculum-rowicon .icon-play { color: var(--accent); }
  .lw-curriculum-rowicon .icon-locked { color: var(--ink-soft); }
  .lw-curriculum-lessontitle { flex: 1; font-size: 0.92rem; font-weight: 600; line-height: 1.4; color: var(--ink); }
  .lw-curriculum-mins { font-family: var(--font-mono, monospace); font-size: 11px; color: var(--ink-soft); }
  .lw-curriculum-donepill {
    font-size: 10.5px; font-weight: 600; border-radius: 9999px; padding: 3px 9px;
    background: color-mix(in srgb, var(--success, #1E7D61) 14%, transparent); color: var(--success, #1E7D61);
  }
`;
