import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Paperclip, Download, LoaderCircle } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   RESOURCES — the lesson's supplementary files (slides, worksheets,
   handouts) as their own subscreen, the same "second door" pattern as
   Content/Quiz/Homework/Assistant. Read-only — a download link per file the
   tutor attached via Content Studio's Resources tab.
   ========================================================================= */

export default function ResourcesScreen({ lessonId, onGoToLessons, onBackToLesson }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  if (!lessonId) return <NoLessonSelected onGoToLessons={onGoToLessons} />;
  return <Resources key={lessonId} lessonId={lessonId} slug={slug} token={session.token} onBackToLesson={onBackToLesson} />;
}

function NoLessonSelected({ onGoToLessons }) {
  const { t } = useLanguage();
  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("learnerResources.eyebrow")}</div>
      <h1>{t("learnerResources.noLessonTitle")}</h1>

      <div className="lw-nby">
        <span className="lw-nby__icon" aria-hidden="true"><Paperclip size={20} /></span>
        <div>
          <p className="lw-nby__lead">{t("learnerResources.noLessonBlurb")}</p>
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={onGoToLessons}>
            {t("aiAssistant.goToLessons")} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Resources({ lessonId, slug, token, onBackToLesson }) {
  const { t } = useLanguage();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // No manual reset needed: ResourcesScreen mounts this with key={lessonId}
    // above, so a new lesson gets a fresh component instance instead of this
    // effect having to reset state itself.
    let cancelled = false;
    api.getLearnerLesson(token, slug, lessonId)
      .then((l) => { if (!cancelled) setLesson(l); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token, slug, lessonId]);

  const resources = lesson?.resources ?? [];

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      {onBackToLesson && (
        <button className="lw-learn__back" onClick={onBackToLesson}>
          <ArrowLeft size={13} /> {t("aiAssistant.backToLesson")}
        </button>
      )}

      <div className="lw-eyebrow">{t("learnerResources.eyebrow")}</div>
      <h1>{lesson ? lesson.title : "…"}</h1>

      {error && <Message type="error">{error}</Message>}
      {!lesson && !error && (
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> {t("learnerLesson.loading")}</div>
      )}

      {lesson && resources.length === 0 && (
        <div className="lw-nby">
          <span className="lw-nby__icon" aria-hidden="true"><Paperclip size={20} /></span>
          <div><p className="lw-nby__lead">{t("learnerResources.emptyState")}</p></div>
        </div>
      )}

      {resources.length > 0 && (
        <div className="lw-resourcelist">
          {resources.map((r) => (
            <a key={r.id} className="lw-resourcelist__item"
               href={api.learningAssetDownloadUrl(token, slug, r.id)} target="_blank" rel="noreferrer">
              <Paperclip size={14} />
              <span className="lw-resourcelist__title">{r.title}</span>
              <span className="lw-resourcelist__meta">{Math.round(r.fileSizeBytes / 1024)} KB</span>
              <Download size={14} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const CSS = `
  .lw-nby {
    display: flex; gap: 16px; align-items: flex-start;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 24px 26px; max-width: 68ch; margin: 0 auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  }
  .lw-nby__icon {
    width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-2); color: var(--accent);
  }
  .lw-nby__lead { font-size: 0.95rem; margin: 0; line-height: 1.6; }

  .lw-learn__back {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 20px; color: var(--ink-soft);
    font-family: var(--font-body); font-size: 0.82rem; font-weight: 500; cursor: pointer; padding: 6px 14px; margin-bottom: 18px;
    transition: all 0.15s ease;
  }
  .lw-learn__back:hover { color: var(--ink); border-color: var(--accent); transform: translateX(-2px); }
  .lw-learn__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-learn__spin { animation: lwLearnSpin 0.9s linear infinite; }
  @keyframes lwLearnSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-learn__spin { animation: none; } }

  .lw-resourcelist { display: grid; gap: 12px; max-width: 72ch; margin-top: 18px; }
  .lw-resourcelist__item {
    display: flex; align-items: center; gap: 14px;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 16px 20px; text-decoration: none; color: var(--ink);
    box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: all 0.18s ease;
  }
  .lw-resourcelist__item:hover {
    border-color: var(--accent); transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.06);
  }
  .lw-resourcelist__title { flex: 1; font-size: 0.95rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lw-resourcelist__meta {
    font-family: var(--font-mono); font-size: 11.5px; color: var(--ink-soft);
    background: var(--surface-2); padding: 4px 10px; border-radius: 12px; flex-shrink: 0;
  }
`;
