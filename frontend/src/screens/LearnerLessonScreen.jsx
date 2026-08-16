import { useEffect, useRef, useState } from "react";
import {
  LoaderCircle, ArrowLeft, CheckCircle2, Check, X, Sparkles, Bot, Radio, HelpCircle, FileText, ClipboardList, Paperclip,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import VideoPlayer from "../components/VideoPlayer";
import MarkdownText from "../components/MarkdownText";

/* =========================================================================
   LESSON — watch the video, answer its questions, get graded for real.

   The literal loop AI Interactive Video Lesson Generator §8 describes: video
   plays, pauses at a question's timestamp, the learner answers, the video
   resumes. Feedback on each answer is deferred to a results screen once
   every question has been answered (video end, or immediately for a
   video-less lesson) — the whole set is graded together in one real
   Submission, the same way AssessmentService.PreviewAsync already grades a
   tutor's preview; only the *reveal* is deferred here, not the collection.
   ========================================================================= */

/** Same content types the Content Studio's Extract action and the extraction endpoint's pre-flight check accept. */
const INLINE_RESOURCE_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
]);

export default function LearnerLessonScreen({ lessonId, onBack, onProgress, onOpenAssistant, onOpenQuiz, onOpenContent, onOpenHomework, onOpenResources }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;
  const videoRef = useRef(null);

  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);

  const [answers, setAnswers] = useState({});
  const [answeredIds, setAnsweredIds] = useState(() => new Set());
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [videoEnded, setVideoEnded] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Once a lesson is already Completed, it's just a video to rewatch — no
  // re-answering the checkpoints, no re-grading. Free playback, scrubbing
  // included.
  const completed = lesson?.progressStatus === "Completed";

  useEffect(() => {
    let cancelled = false;
    // A fresh lesson: reset every bit of the previous lesson's local
    // progress (answers, active checkpoint, grading result) — this effect
    // now re-runs whenever the sidebar swaps lessonId on an already-mounted
    // screen, not just on first mount.
    setLesson(null);
    setAnswers({});
    setAnsweredIds(new Set());
    setActiveQuestion(null);
    setVideoEnded(false);
    setSubmitting(false);
    setResult(null);
    api.getLearnerLesson(session.token, slug, lessonId)
      .then((l) => {
        if (cancelled) return;
        setLesson(l);
        setError(null);
        // No video and no questions: the lesson already completed itself on
        // open (LearningDeliveryService.GetLessonAsync) — nothing to drive here.
        if (!l.video && !l.videoUrl) setVideoEnded(true);
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug, lessonId]);

  // Tells App's LessonSidebar (a sibling, not a child, of this screen) to
  // re-fetch — auto-complete on open, video watched, or a passing
  // submission all change this lesson's row/unit-count there.
  useEffect(() => {
    onProgress?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.progressStatus, result]);

  // Once the video has ended (or there was none), work through whatever
  // questions remain one at a time; once none remain, submit the whole set.
  useEffect(() => {
    if (!lesson || activeQuestion || result || submitting || completed) return;
    if ((lesson.video || lesson.videoUrl) && !videoEnded) return; // timeupdate handles in-video checkpoints

    const remaining = lesson.questions.filter((q) => !answeredIds.has(q.id));
    if (remaining.length > 0) {
      const next = [...remaining].sort((a, b) => (a.videoTimestampSeconds ?? 0) - (b.videoTimestampSeconds ?? 0))[0];
      setActiveQuestion(next);
      return;
    }

    if (lesson.questions.length > 0) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, activeQuestion, answeredIds, videoEnded, result, submitting, completed]);

  function handleTimeUpdate(currentTime) {
    if (activeQuestion || videoEnded || !lesson || completed) return;
    const next = lesson.questions
      .filter((q) => q.videoTimestampSeconds != null && !answeredIds.has(q.id))
      .sort((a, b) => a.videoTimestampSeconds - b.videoTimestampSeconds)
      .find((q) => currentTime >= q.videoTimestampSeconds);
    if (next) {
      videoRef.current?.pause?.();
      setActiveQuestion(next);
    }
  }

  function handleVideoEnded() {
    setVideoEnded(true);
    // The response already carries the authoritative post-watch progress —
    // a video-only lesson (no questions to submit afterward) completes right
    // here, and without applying it back nothing else ever refreshes this
    // screen's `lesson` to show that.
    if (!completed) api.markVideoWatched(session.token, slug, lessonId).then(setLesson).catch(() => {});
  }

  function recordAnswer(questionId, answer) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setAnsweredIds((prev) => new Set(prev).add(questionId));
    setActiveQuestion(null);
    videoRef.current?.play?.().catch(() => {});
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = lesson.questions.map((q) => ({
        questionId: q.id,
        selectedOptionIndex: answers[q.id]?.selectedOptionIndex ?? null,
        textAnswer: answers[q.id]?.textAnswer ?? null,
      }));
      setResult(await api.submitLearnerAssessment(session.token, slug, lessonId, payload));
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const done = result ? true : lesson?.progressStatus === "Completed";
  const isLive = lesson?.deliveryMode === "LiveSession";
  const hasVideo = !!(lesson?.video || lesson?.videoUrl);
  // PDF & Image Lesson Content Extraction §10.1 — a Reading-mode (or any
  // video-less) lesson features its first visible PDF/image resource
  // (already position-ordered, already learner-visibility-filtered
  // server-side) in the same slot the video would occupy, instead of
  // leaving it one click away behind the Resources button. Any further
  // resources stay reachable there as before.
  const inlineResource = !hasVideo
    ? lesson?.resources?.find((r) => INLINE_RESOURCE_TYPES.has((r.contentType || "").toLowerCase()))
    : null;

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <BackLink onBack={onBack} />

      {error && !lesson && <Message type="error">{error}</Message>}
      {!lesson && !error && (
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> {t("learnerLesson.loading")}</div>
      )}

      {lesson && <>
        <div className="lw-eyebrow">{t("studio.lessonEyebrow")}</div>
        <div className="lw-learn__heading">
          <h1>{lesson.title}</h1>
          {done && <span className="lw-learn__donepill"><CheckCircle2 size={12} /> {t("learnerCourses.completed")}</span>}
          {onOpenContent && (
            <button type="button" className="lw-learn__askai" onClick={onOpenContent}>
              <FileText size={13} /> {t("learnerContent.eyebrow")}
            </button>
          )}
          {onOpenHomework && (
            <button type="button" className="lw-learn__askai" onClick={onOpenHomework}>
              <ClipboardList size={13} /> {t("learnerHomework.eyebrow")}
            </button>
          )}
          {onOpenResources && (
            <button type="button" className="lw-learn__askai" onClick={onOpenResources}>
              <Paperclip size={13} /> {t("learnerResources.eyebrow")}
            </button>
          )}
          {onOpenQuiz && (
            <button type="button" className="lw-learn__askai" onClick={onOpenQuiz}>
              <HelpCircle size={13} /> {t("learnerStudio.quiz")}
            </button>
          )}
          {onOpenAssistant && (
            <button type="button" className="lw-learn__askai" onClick={onOpenAssistant}>
              <Bot size={13} /> {t("aiAssistant.eyebrow")}
            </button>
          )}
        </div>

        {error && <Message type="error">{error}</Message>}

        {isLive && (
          <p className="muted" style={{ marginBottom: 14 }}>
            <Radio size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            {t("learnerLesson.liveSessionPrefix")}{(lesson.video || lesson.videoUrl) ? ` ${t("learnerLesson.liveSessionWithRecording")}` : "."}
          </p>
        )}

        {lesson.whatYoullLearn ? (
          <div className="lw-learn__outcomes">
            <div className="lw-learn__outcomeskicker"><Sparkles size={13} /> {t("studio.whatYoullLearnLabel")}</div>
            <MarkdownText className="lw-learn__outcomestext" text={lesson.whatYoullLearn} />
          </div>
        ) : lesson.body && <MarkdownText className="lw-learn__body" text={lesson.body} />}

        {hasVideo && (
          <div className="lw-learn__playerframe">
            <VideoPlayer
              ref={videoRef}
              src={lesson.video ? api.learningAssetDownloadUrl(session.token, slug, lesson.video.id) : lesson.videoUrl}
              controls={!activeQuestion}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
            />
            {activeQuestion && (
              <div className="lw-learn__checkpoint">
                <QuestionPrompt question={activeQuestion} onAnswer={(a) => recordAnswer(activeQuestion.id, a)} />
              </div>
            )}
          </div>
        )}

        {!hasVideo && inlineResource && (
          <div className="lw-learn__playerframe">
            {inlineResource.contentType.toLowerCase() === "application/pdf" ? (
              <iframe
                src={api.learningAssetDownloadUrl(session.token, slug, inlineResource.id)}
                title={inlineResource.title}
                style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
              />
            ) : (
              <img
                src={api.learningAssetDownloadUrl(session.token, slug, inlineResource.id)}
                alt={inlineResource.title}
                style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }}
              />
            )}
          </div>
        )}

        {!hasVideo && activeQuestion && (
          <div className="lw-learn__standalone">
            <QuestionPrompt question={activeQuestion} onAnswer={(a) => recordAnswer(activeQuestion.id, a)} />
          </div>
        )}

        {submitting && (
          <div className="lw-learn__grading"><LoaderCircle size={16} className="lw-learn__spin" /> {t("learnerLesson.grading")}</div>
        )}

        {result && (
          <div className="lw-aicard" style={{ marginTop: 18, flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Bot size={16} />
              <div className="lw-aicard__body">
                <strong>{result.passed ? t("studio.passed") : t("studio.notYetPassing")} — {result.scorePercent}%</strong>
                <p style={{ margin: "4px 0 0" }}>{result.aiFeedback}</p>
              </div>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {lesson.questions.map((q) => {
                const pq = result.perQuestion.find((p) => p.questionId === q.id);
                const reviewed = pq?.correct == null;
                return (
                  <div key={q.id} className="lw-feedback" style={{ margin: 0 }}>
                    {reviewed ? <Sparkles size={14} /> : pq?.correct ? <Check size={14} /> : <X size={14} />}
                    <span>
                      {q.prompt}{" "}
                      {reviewed ? t("studio.reviewedNotScored") : pq?.correct ? t("studio.correct") : t("studio.correctAnswerIs", { answer: pq?.correctAnswerDisplay ?? t("studio.notAvailable") })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/*
          Gated on `done`, not just "no video and no interactive questions" —
          a Reading lesson with RequireQuizToComplete on and no passing
          Standalone submission yet is exactly "no video, no interactive
          questions" but genuinely NOT complete (LearningDeliveryService
          .GetLessonAsync's RequireQuizToComplete branch). Claiming "marked
          complete" here would be flatly wrong for that case.
        */}
        {!hasVideo && lesson.questions.length === 0 && done && (
          <Message type="success">{t("learnerLesson.doneBanner")}</Message>
        )}
      </>}
    </div>
  );
}

function QuestionPrompt({ question, onAnswer }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState("");

  const isChoice = question.type === "MultipleChoice" || question.type === "TrueFalse";
  const canSubmit = isChoice ? selected != null : text.trim().length > 0;

  return (
    <div className="lw-learn__checkpointcard">
      <div className="lw-learn__checkpointkicker"><Sparkles size={13} /> {t("learnerLesson.checkpoint")}</div>
      <p className="lw-learn__checkpointprompt">{question.prompt}</p>
      {isChoice ? (
        <div className="lw-options">
          {question.options.map((opt, i) => (
            <button
              type="button" key={i}
              className={`lw-option ${selected === i ? "is-selected" : ""}`}
              onClick={() => setSelected(i)}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="lw-learn__checkpointinput" value={text} onChange={(e) => setText(e.target.value)} autoFocus
          placeholder={question.type === "CompleteTheSentence" ? t("studio.yourAnswerPlaceholder") : t("studio.yourResponsePlaceholder")}
        />
      )}
      <button
        type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={!canSubmit}
        onClick={() => onAnswer(isChoice ? { selectedOptionIndex: selected, textAnswer: null } : { selectedOptionIndex: null, textAnswer: text.trim() })}
      >
        <Check size={13} /> {t("learnerLesson.continue")}
      </button>
    </div>
  );
}

function BackLink({ onBack }) {
  const { t } = useLanguage();
  return (
    <button className="lw-learn__back" onClick={onBack}>
      <ArrowLeft size={13} /> {t("learnerLesson.backToCourse")}
    </button>
  );
}

const CSS = `
  .muted { color: var(--ink-soft); font-size: 0.86rem; line-height: 1.55; }
  .lw-learn__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-learn__back {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: none; color: var(--ink-soft);
    font-family: var(--font-body); font-size: 0.82rem; cursor: pointer; padding: 0; margin-bottom: 14px;
  }
  .lw-learn__back:hover { color: var(--ink); }

  .lw-learn__heading { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .lw-learn__donepill {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-mono); font-size: 10px; border-radius: 20px; padding: 3px 9px;
    background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2);
  }
  .lw-learn__askai {
    display: inline-flex; align-items: center; gap: 6px; margin-inline-start: auto;
    font-family: var(--font-body); font-size: 0.8rem; cursor: pointer;
    background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line)); border-radius: 20px; padding: 5px 12px;
  }
  .lw-learn__askai:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .lw-learn__body { font-size: 0.92rem; color: var(--ink); line-height: 1.7; margin: 14px 0 20px; white-space: pre-wrap; }

  .lw-learn__outcomes {
    background: color-mix(in srgb, var(--accent) 6%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line));
    border-radius: var(--radius-sm); padding: 14px 16px; margin: 14px 0 20px;
  }
  .lw-learn__outcomeskicker {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent);
  }
  .lw-learn__outcomestext { font-size: 0.92rem; color: var(--ink); line-height: 1.7; margin: 8px 0 0; white-space: pre-wrap; }

  .lw-learn__playerframe { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--radius); overflow: hidden; background: #000; }
  .lw-learn__checkpoint {
    position: absolute; inset: 0; background: rgba(10,12,15,0.88);
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .lw-learn__standalone { display: flex; justify-content: center; }
  .lw-learn__checkpointcard {
    background: var(--surface); color: var(--ink); border-radius: var(--radius);
    padding: 22px 24px; width: 100%; max-width: 460px;
    display: flex; flex-direction: column; gap: 12px;
    position: relative;
  }
  /* Notebook theme: dog-eared page corner (2026-08-15). */
  .lw-learn__checkpointcard::after {
    content: ""; position: absolute; top: 0; inset-inline-end: 0; width: 0; height: 0;
    border-style: solid; border-width: 0 14px 14px 0;
    border-color: transparent var(--surface-2) transparent transparent;
    filter: drop-shadow(-1px 1px 1.5px rgba(0,0,0,0.18));
    pointer-events: none;
  }
  [dir="rtl"] .lw-learn__checkpointcard::after { transform: scaleX(-1); }
  .lw-learn__checkpointkicker {
    display: inline-flex; align-items: center; gap: 6px; width: fit-content;
    font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
    padding: 3px 9px; border-radius: 20px;
  }
  .lw-learn__checkpointprompt { font-size: 0.98rem; font-weight: 600; margin: 0; line-height: 1.5; }
  .lw-learn__checkpointinput {
    width: 100%; font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 9px 11px;
  }

  .lw-learn__grading { display: flex; align-items: center; gap: 8px; color: var(--ink-soft); font-size: 0.87rem; margin-top: 16px; }

  .lw-option.is-selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--bg)); }

  .lw-learn__spin { animation: lwLearnSpin 0.9s linear infinite; }
  @keyframes lwLearnSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-learn__spin { animation: none; } }
`;
