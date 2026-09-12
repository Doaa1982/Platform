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
    <div className="lw-page lw-lessoncontent-page">
      <style>{CSS}</style>
      {onBackToLesson && (
        <button className="lw-learn__back" onClick={onBackToLesson}>
          <ArrowLeft size={14} /> <span>{t("aiAssistant.backToLesson")}</span>
        </button>
      )}

      <div className="lw-lessoncontent-header">
        <div className="lw-eyebrow">{t("learnerContent.eyebrow")}</div>
        <h1 className="lw-lessoncontent-title">{lesson ? lesson.title : "…"}</h1>
      </div>

      {error && <Message type="error">{error}</Message>}
      {!lesson && !error && (
        <div className="lw-learn__loading"><LoaderCircle size={22} className="lw-learn__spin" /> <span>{t("learnerLesson.loading")}</span></div>
      )}

      {lesson && sections.length === 0 && (
        <div className="lw-nby">
          <span className="lw-nby__icon" aria-hidden="true"><FileText size={22} /></span>
          <div><p className="lw-nby__lead">{t("learnerContent.emptyState")}</p></div>
        </div>
      )}

      <div className="lw-lessoncontent-sections">
        {sections.map((s) => (
          <div className="lw-content__section" key={s.key}>
            <div className="lw-content__kicker"><Sparkles size={13} /> {s.label}</div>
            {s.key === "glossary" ? <GlossaryTable text={s.text} /> : <MarkdownText className="lw-content__text" text={s.text} />}
          </div>
        ))}
      </div>
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
    <div className="lw-glossary-wrap">
      <table className="lw-glossary">
        <thead>
          <tr>
            <th>Term</th>
            <th>Definition</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i}>
              <th scope="row"><span className="lw-glossary-term">{e.term}</span></th>
              <td>{e.definition}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CSS = `
  .lw-lessoncontent-page { max-width: 900px; margin: 0 auto; padding-bottom: 56px; }
  .lw-lessoncontent-header { text-align: center; margin-bottom: 24px; }
  .lw-lessoncontent-title { font-size: 2.1rem; font-weight: 700; color: var(--ink); margin: 4px 0 0; letter-spacing: -0.02em; }

  .lw-nby {
    display: flex; gap: 16px; align-items: flex-start;
    background: var(--surface); border: 1px dashed var(--line);
    border-radius: var(--radius, 16px); padding: 28px 26px; max-width: 62ch; margin: 0 auto;
  }
  .lw-nby__icon {
    width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-nby__lead { font-size: 0.95rem; margin: 0 0 14px; line-height: 1.6; }

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
  .lw-learn__loading { display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--ink-soft); padding: 50px 0; font-size: 0.95rem; }
  .lw-learn__spin { animation: lwLearnSpin 0.8s linear infinite; color: var(--accent); }
  @keyframes lwLearnSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-learn__spin { animation: none; } }

  .lw-lessoncontent-sections { display: flex; flex-direction: column; gap: 20px; }
  .lw-content__section {
    width: 100%; background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius, 16px); padding: 22px 26px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.02); text-align: start;
  }
  .lw-content__kicker {
    display: inline-flex; align-items: center; gap: 6px; width: fit-content;
    font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
    padding: 3px 10px; border-radius: 9999px; margin-bottom: 14px;
  }
  .lw-content__text { font-size: 0.94rem; color: var(--ink); line-height: 1.75; margin: 0; white-space: pre-wrap; }

  .lw-glossary-wrap { overflow-x: auto; margin-top: 8px; border: 1px solid var(--line); border-radius: 12px; }
  .lw-glossary { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
  .lw-glossary thead th {
    background: var(--surface-2, rgba(0,0,0,0.03)); color: var(--ink-soft);
    font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    padding: 10px 16px; text-align: start; border-bottom: 1px solid var(--line);
  }
  .lw-glossary tr { border-top: 1px solid var(--line); }
  .lw-glossary tr:first-child { border-top: none; }
  .lw-glossary th, .lw-glossary td { text-align: start; padding: 12px 16px; vertical-align: top; line-height: 1.6; }
  .lw-glossary th { color: var(--ink); font-weight: 600; white-space: nowrap; width: 25%; }
  .lw-glossary-term {
    display: inline-block; background: color-mix(in srgb, var(--accent) 8%, var(--surface));
    color: var(--accent); padding: 3px 8px; border-radius: 6px; font-size: 0.88rem;
  }
  .lw-glossary td { color: var(--ink-soft); }
`;
