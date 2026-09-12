import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ClipboardList, Sparkles, LoaderCircle } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   HOMEWORK — the lesson's homework/practice exercises as their own
   subscreen, the same "second door" pattern as Content/Quiz/Assistant.
   Split out of LessonContentScreen so it gets its own tab ahead of Quiz,
   instead of being one more section on the Content page. Read-only — the
   text already comes back on LearnerLessonResponse.homework.
   ========================================================================= */

export default function HomeworkScreen({ lessonId, onGoToLessons, onBackToLesson }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  if (!lessonId) return <NoLessonSelected onGoToLessons={onGoToLessons} />;
  return <Homework key={lessonId} lessonId={lessonId} slug={slug} token={session.token} onBackToLesson={onBackToLesson} />;
}

function NoLessonSelected({ onGoToLessons }) {
  const { t } = useLanguage();
  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("learnerHomework.eyebrow")}</div>
      <h1>{t("learnerHomework.noLessonTitle")}</h1>

      <div className="lw-nby">
        <span className="lw-nby__icon" aria-hidden="true"><ClipboardList size={20} /></span>
        <div>
          <p className="lw-nby__lead">{t("learnerHomework.noLessonBlurb")}</p>
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={onGoToLessons}>
            {t("aiAssistant.goToLessons")} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Homework({ lessonId, slug, token, onBackToLesson }) {
  const { t } = useLanguage();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // No manual reset needed: HomeworkScreen mounts this with key={lessonId}
    // above, so a new lesson gets a fresh component instance instead of this
    // effect having to reset state itself.
    let cancelled = false;
    api.getLearnerLesson(token, slug, lessonId)
      .then((l) => { if (!cancelled) setLesson(l); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token, slug, lessonId]);

  const hasHomework = lesson?.homework && lesson.homework.trim();

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      {onBackToLesson && (
        <button className="lw-learn__back" onClick={onBackToLesson}>
          <ArrowLeft size={13} /> {t("aiAssistant.backToLesson")}
        </button>
      )}

      <div className="lw-eyebrow">{t("learnerHomework.eyebrow")}</div>
      <h1>{lesson ? lesson.title : "…"}</h1>

      {error && <Message type="error">{error}</Message>}
      {!lesson && !error && (
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> {t("learnerLesson.loading")}</div>
      )}

      {lesson && !hasHomework && (
        <div className="lw-nby">
          <span className="lw-nby__icon" aria-hidden="true"><ClipboardList size={20} /></span>
          <div><p className="lw-nby__lead">{t("learnerHomework.emptyState")}</p></div>
        </div>
      )}

      {lesson && hasHomework && (
        <div className="lw-content__section">
          <div className="lw-content__kicker"><Sparkles size={13} /> {t("studio.homeworkLabel")}</div>
          <p className="lw-content__text">{lesson.homework}</p>
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

  .lw-content__section {
    max-width: 72ch; margin: 0 0 24px; background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 24px 26px; box-shadow: 0 3px 12px rgba(0,0,0,0.03);
  }
  .lw-content__kicker {
    display: inline-flex; align-items: center; gap: 6px; width: fit-content;
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
    padding: 4px 12px; border-radius: 20px; margin-bottom: 14px;
  }
  .lw-content__text { font-size: 0.95rem; color: var(--ink); line-height: 1.75; margin: 0; white-space: pre-wrap; }
`;
