import { useEffect, useRef, useState } from "react";
import { LoaderCircle, ArrowLeft, ArrowRight, Bot, Send, User, Sparkles } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import StudioPanel from "./StudioPanel";

/* =========================================================================
   AI ASSISTANT — real, and deliberately narrow: it only ever answers about
   whatever lesson is currently open (LessonAssistantSkill grounds every
   answer in that lesson's own body/transcript/objectives, never outside
   knowledge). There is no "workspace-wide" mode — a learner who reaches this
   screen without an open lesson is asked to open one first, rather than
   being handed a generic chatbot with nothing real to ground it in.
   ========================================================================= */

export default function AiAssistantScreen({ lessonId, onGoToLessons, onBackToLesson, onOpenQuiz }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  if (!lessonId) return <NoLessonSelected onGoToLessons={onGoToLessons} />;
  return (
    <LessonChat
      key={lessonId} lessonId={lessonId} slug={slug} token={session.token}
      onBackToLesson={onBackToLesson} onOpenQuiz={onOpenQuiz}
    />
  );
}

function NoLessonSelected({ onGoToLessons }) {
  const { t } = useLanguage();
  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("aiAssistant.eyebrow")}</div>
      <h1>{t("aiAssistant.noLessonTitle")}</h1>

      <div className="lw-nby">
        <span className="lw-nby__icon" aria-hidden="true"><Bot size={20} /></span>
        <div>
          <p className="lw-nby__lead">{t("aiAssistant.noLessonBlurb")}</p>
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={onGoToLessons}>
            {t("aiAssistant.goToLessons")} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonChat({ lessonId, slug, token, onBackToLesson, onOpenQuiz }) {
  const { t } = useLanguage();
  const listRef = useRef(null);

  const [lesson, setLesson] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getLearnerLesson(token, slug, lessonId)
      .then((l) => { if (!cancelled) setLesson(l); })
      .catch((e) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
  }, [token, slug, lessonId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = question.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setSending(true);
    setError(null);
    try {
      const res = await api.askLessonAssistant(token, slug, lessonId, text);
      setMessages((prev) => [...prev, { role: "assistant", text: res.answer }]);
    } catch (e2) {
      setError(e2.message || t("aiAssistant.askError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      {onBackToLesson && (
        <button className="lw-learn__back" onClick={onBackToLesson}>
          <ArrowLeft size={13} /> {t("aiAssistant.backToLesson")}
        </button>
      )}

      <div className="lw-eyebrow">{t("aiAssistant.eyebrow")}</div>
      <h1>{lesson ? lesson.title : "…"}</h1>
      {lesson && <p className="lw-ai__askingabout">{t("aiAssistant.askingAbout")}: {lesson.title}</p>}

      {loadError && <Message type="error">{loadError}</Message>}
      {error && <Message type="error">{error}</Message>}

      <div className="lw-ai__chat">
        <div className="lw-ai__list" ref={listRef}>
          {messages.length === 0 && !sending && (
            <p className="lw-ai__empty">{t("aiAssistant.emptyState")}</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`lw-ai__bubblerow ${m.role === "user" ? "is-user" : ""}`}>
              <span className="lw-ai__avatar">{m.role === "user" ? <User size={14} /> : <Bot size={14} />}</span>
              <div className={`lw-ai__bubble ${m.role === "user" ? "is-user" : ""}`}>{m.text}</div>
            </div>
          ))}
          {sending && (
            <div className="lw-ai__bubblerow">
              <span className="lw-ai__avatar"><Bot size={14} /></span>
              <div className="lw-ai__bubble lw-ai__bubble--loading">
                <LoaderCircle size={14} className="lw-learn__spin" /> {t("aiAssistant.thinking")}
              </div>
            </div>
          )}
        </div>

        <form className="lw-ai__composer" onSubmit={handleSubmit}>
          <Sparkles size={14} className="lw-ai__composericon" />
          <input
            className="lw-ai__input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("aiAssistant.placeholder")}
            disabled={!lesson || sending}
            autoFocus
          />
          <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={!lesson || sending || !question.trim()}>
            <Send size={13} /> {t("aiAssistant.send")}
          </button>
        </form>
      </div>

      {lesson && <StudioPanel onOpenQuiz={onOpenQuiz} />}
    </div>
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
    background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--ink-soft);
    font-family: var(--font-body); font-size: 0.82rem; cursor: pointer; padding: 3px 6px; margin-bottom: 14px; margin-inline-start: -6px;
  }
  .lw-learn__back:hover { color: var(--ink); background: var(--surface-2, rgba(0,0,0,0.05)); }
  .lw-learn__spin { animation: lwLearnSpin 0.9s linear infinite; }
  @keyframes lwLearnSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-learn__spin { animation: none; } }

  .lw-ai__askingabout { color: var(--ink-soft); font-size: 0.85rem; margin: -6px 0 18px; }

  .lw-ai__chat {
    display: flex; flex-direction: column;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    max-width: 72ch; height: min(560px, 62vh); overflow: hidden;
  }
  .lw-ai__list { flex: 1; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
  .lw-ai__empty { color: var(--ink-soft); font-size: 0.88rem; line-height: 1.6; margin: auto; text-align: center; max-width: 40ch; }

  .lw-ai__bubblerow { display: flex; gap: 9px; align-items: flex-start; }
  .lw-ai__bubblerow.is-user { flex-direction: row-reverse; }
  .lw-ai__avatar {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-ai__bubble {
    background: var(--surface-2); color: var(--ink);
    border-radius: var(--radius-sm); padding: 10px 13px;
    font-size: 0.88rem; line-height: 1.55; max-width: 46ch; white-space: pre-wrap;
  }
  .lw-ai__bubble.is-user { background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); }
  .lw-ai__bubble--loading { display: flex; align-items: center; gap: 8px; color: var(--ink-soft); }

  .lw-ai__composer {
    display: flex; align-items: center; gap: 8px;
    border-top: 1px solid var(--line); padding: 12px 14px; background: var(--surface);
  }
  .lw-ai__composericon { color: var(--accent); flex-shrink: 0; }
  .lw-ai__input {
    flex: 1; font-family: var(--font-body); font-size: 0.88rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 9px 12px;
  }
  .lw-ai__input:disabled { opacity: 0.6; }
`;
