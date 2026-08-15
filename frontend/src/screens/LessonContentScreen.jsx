import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Sparkles, LoaderCircle } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import MarkdownText from "../components/MarkdownText";

/* =========================================================================
   LESSON CONTENT — the lesson's own written material as its own subscreen,
   the same "second door" pattern as the Assistant and Quiz: reached from a
   button on the lesson page, not scrolled to underneath the video. Read-only
   — everything shown here is exactly what LearnerLessonResponse already
   carries (What you'll learn, Learning objectives, Content, Glossary,
   Homework), just given a page of its own instead of being squeezed above
   the video player.
   ========================================================================= */

export default function LessonContentScreen({ lessonId, onGoToLessons, onBackToLesson }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  if (!lessonId) return <NoLessonSelected onGoToLessons={onGoToLessons} />;
  return <LessonContent key={lessonId} lessonId={lessonId} slug={slug} token={session.token} onBackToLesson={onBackToLesson} />;
}

function NoLessonSelected({ onGoToLessons }) {
  const { t } = useLanguage();
  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("learnerContent.eyebrow")}</div>
      <h1>{t("learnerContent.noLessonTitle")}</h1>

      <div className="lw-nby">
        <span className="lw-nby__icon" aria-hidden="true"><FileText size={20} /></span>
        <div>
          <p className="lw-nby__lead">{t("learnerContent.noLessonBlurb")}</p>
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={onGoToLessons}>
            {t("aiAssistant.goToLessons")} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonContent({ lessonId, slug, token, onBackToLesson }) {
  const { t } = useLanguage();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // No manual reset needed: LessonContentScreen mounts LessonContent with
    // key={lessonId} above, so a new lesson gets a fresh component instance
    // instead of this effect having to reset state itself.
    let cancelled = false;
    api.getLearnerLesson(token, slug, lessonId)
      .then((l) => { if (!cancelled) setLesson(l); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token, slug, lessonId]);

  const sections = lesson ? [
    { key: "whatYoullLearn", label: t("studio.whatYoullLearnLabel"), text: lesson.whatYoullLearn },
    { key: "learningObjectives", label: t("studio.learningObjectivesLabel"), text: lesson.learningObjectives },
    { key: "body", label: t("studio.contentLabel"), text: lesson.body },
    { key: "glossary", label: t("studio.glossaryLabel"), text: lesson.glossary },
  ].filter((s) => s.text && s.text.trim()) : [];

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      {onBackToLesson && (
        <button className="lw-learn__back" onClick={onBackToLesson}>
          <ArrowLeft size={13} /> {t("aiAssistant.backToLesson")}
        </button>
      )}

      <div className="lw-eyebrow">{t("learnerContent.eyebrow")}</div>
      <h1>{lesson ? lesson.title : "…"}</h1>

      {error && <Message type="error">{error}</Message>}
      {!lesson && !error && (
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> {t("learnerLesson.loading")}</div>
      )}

      {lesson && sections.length === 0 && (
        <div className="lw-nby">
          <span className="lw-nby__icon" aria-hidden="true"><FileText size={20} /></span>
          <div><p className="lw-nby__lead">{t("learnerContent.emptyState")}</p></div>
        </div>
      )}

      {sections.map((s) => (
        <div className="lw-content__section" key={s.key}>
          <div className="lw-content__kicker"><Sparkles size={13} /> {s.label}</div>
          {s.key === "glossary" ? <GlossaryTable text={s.text} /> : <MarkdownText className="lw-content__text" text={s.text} />}
        </div>
      ))}
    </div>
  );
}

function parseGlossary(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      return i === -1
        ? { term: line, definition: "" }
        : { term: line.slice(0, i).trim(), definition: line.slice(i + 1).trim() };
    });
}

function GlossaryTable({ text }) {
  const entries = parseGlossary(text);
  return (
    <table className="lw-glossary">
      <tbody>
        {entries.map((e, i) => (
          <tr key={i}>
            <th scope="row">{e.term}</th>
            <td>{e.definition}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CSS = `
  .lw-nby {
    display: flex; gap: 16px; align-items: flex-start;
    background: var(--surface); border: 1px dashed var(--line);
    border-radius: var(--radius-sm); padding: 24px 26px; max-width: 62ch;
  }
  .lw-nby__icon {
    width: 42px; height: 42px; border-radius: var(--radius-sm); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-nby__lead { font-size: 0.95rem; margin: 0 0 14px; line-height: 1.6; }

  .lw-learn__back {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: none; color: var(--ink-soft);
    font-family: var(--font-body); font-size: 0.82rem; cursor: pointer; padding: 0; margin-bottom: 14px;
  }
  .lw-learn__back:hover { color: var(--ink); }
  .lw-learn__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-learn__spin { animation: lwLearnSpin 0.9s linear infinite; }
  @keyframes lwLearnSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-learn__spin { animation: none; } }

  .lw-content__section {
    max-width: 72ch; margin: 0 0 20px; background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 16px 18px;
  }
  .lw-content__kicker {
    display: inline-flex; align-items: center; gap: 6px; width: fit-content;
    font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
    padding: 3px 9px; border-radius: 20px; margin-bottom: 10px;
  }
  .lw-content__text { font-size: 0.92rem; color: var(--ink); line-height: 1.7; margin: 0; white-space: pre-wrap; }

  .lw-glossary { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
  .lw-glossary tr { border-top: 1px solid var(--line); }
  .lw-glossary tr:first-child { border-top: none; }
  .lw-glossary th, .lw-glossary td { text-align: start; padding: 9px 12px 9px 0; vertical-align: top; line-height: 1.6; }
  .lw-glossary th { color: var(--ink); font-weight: 600; white-space: nowrap; width: 1%; }
  .lw-glossary td { color: var(--ink-soft); }
`;
