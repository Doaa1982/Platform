import { useEffect, useRef, useState } from "react";
import {
  LoaderCircle, ArrowLeft, CheckCircle2, Check, X, Sparkles, Bot, Radio, HelpCircle, FileText, ClipboardList, Paperclip, ListChecks, Play, Pause, Volume2, Subtitles, Clock, CheckCircle
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import VideoPlayer from "../components/VideoPlayer";
import AssetImage from "../components/AssetImage";
import AssetFrame from "../components/AssetFrame";
import GlassCard from "../components/GlassCard";
import AnimatedButton from "../components/AnimatedButton";
import MarkdownText from "../components/MarkdownText";
import CompetencyBreakdown from "../components/CompetencyBreakdown";

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

export default function LearnerLessonScreen({ lessonId, onBack, onProgress, onOpenAssistant, onOpenQuiz, onOpenContent, onOpenHomework, onOpenResources, onOpenAssignments }) {
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
  const [activeTab, setActiveTab] = useState("video");
  const [activeWordIndex, setActiveWordIndex] = useState(0);

  // Once a lesson is already Completed, it's just a video to rewatch — no
  // re-answering the checkpoints, no re-grading. Free playback, scrubbing
  // included.
  const completed = lesson?.progressStatus === "Completed";

  useEffect(() => {
    let cancelled = false;
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
        if (!l.video && !l.videoUrl) setVideoEnded(true);
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug, lessonId]);

  useEffect(() => {
    onProgress?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.progressStatus, result]);

  useEffect(() => {
    if (!lesson || activeQuestion || result || submitting || completed) return;
    if ((lesson.video || lesson.videoUrl) && !videoEnded) return;

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
  const inlineResource = !hasVideo
    ? lesson?.resources?.find((r) => INLINE_RESOURCE_TYPES.has((r.contentType || "").toLowerCase()))
    : null;

  const fallbackWords = [
    "ثواني،", "هو", "ده", "الهايت", "صح؟",
    "اللي", "هو", "ال", "4.5", "ده", "الهايت", "صح؟",
    "كام؟", "point.", "تمام", "فإحنا", "كده", "هو", "اه", "اوف", "تايم", "13", "4.5",
    "بوينت", "إيه.", "فكده", "التريانجل", "اللي", "فوق", "هيبقى", "الاريا", "بتاعته",
    "like.", "يعني", "تبقى", "17.7.", "ماشي", "نعمل", "إيه", "بقى.", "طيب"
  ];
  const transcriptWords = lesson?.transcript
    ? lesson.transcript.trim().split(/\s+/)
    : fallbackWords;

  return (
    <GlassCard className="lw-page lw-lesson-page">
      <style>{CSS}</style>
      
      {/* Top Header Navigation & Status Bar */}
      <div className="lw-lesson-topbar">
        <button className="lw-lesson-backbtn" onClick={onBack} title={t("learnerLesson.backToCourse")}>
          <ArrowLeft size={15} />
          <span>{t("learnerLesson.backToCourse")}</span>
        </button>

        {done ? (
          <div className="lw-lesson-statuspill lw-lesson-statuspill--done">
            <CheckCircle size={14} />
            <span>{t("learnerCourses.completed")}</span>
          </div>
        ) : (
          <div className="lw-lesson-statuspill lw-lesson-statuspill--active">
            <span className="lw-lesson-statuspulse" />
            <span>In Progress</span>
          </div>
        )}
      </div>

      {error && !lesson && <Message type="error">{error}</Message>}
      {!lesson && !error && (
        <div className="lw-learn__loading">
          <LoaderCircle size={22} className="lw-learn__spin" />
          <span>{t("learnerLesson.loading")}</span>
        </div>
      )}

      {lesson && (
        <div className="lw-lesson-container">
          {/* 1. Video Player Cinema Experience at the top */}
          {hasVideo && (
            <div className="lw-lesson-cinema">
              <div className="lw-lesson-playerframe">
                <VideoPlayer
                  ref={videoRef}
                  {...(lesson.video
                    ? { assetAccess: { token: session?.token, slug, assetId: lesson.video.id } }
                    : { src: lesson.videoUrl })}
                  controls={!activeQuestion}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                  style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
                />
                {activeQuestion && (
                  <div className="lw-lesson-checkpoint-overlay">
                    <QuestionPrompt question={activeQuestion} onAnswer={(a) => recordAnswer(activeQuestion.id, a)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {!hasVideo && inlineResource && (
            <div className="lw-lesson-cinema">
              <div className="lw-lesson-playerframe">
                {inlineResource.contentType.toLowerCase() === "application/pdf" ? (
                  <AssetFrame
                    token={session?.token}
                    slug={slug}
                    assetId={inlineResource.id}
                    title={inlineResource.title}
                    style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                  />
                ) : (
                  <AssetImage
                    token={session?.token}
                    slug={slug}
                    assetId={inlineResource.id}
                    alt={inlineResource.title}
                    style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }}
                  />
                )}
              </div>
            </div>
          )}

          {!hasVideo && activeQuestion && (
            <div className="lw-lesson-standalone-checkpoint">
              <QuestionPrompt question={activeQuestion} onAnswer={(a) => recordAnswer(activeQuestion.id, a)} />
            </div>
          )}

          {/* 2. Main Hero Header: Title, Metadata & Action Toolbar */}
          <div className="lw-lesson-hero">
            <div className="lw-lesson-hero__meta">
              <span className="lw-lesson-eyebadge">
                <Sparkles size={12} />
                {t("studio.lessonEyebrow")}
              </span>
              {lesson.estimatedMinutes != null && lesson.estimatedMinutes > 0 && (
                <span className="lw-lesson-metatag">
                  <Clock size={12} />
                  {lesson.estimatedMinutes} {t("lessonSidebar.min")}
                </span>
              )}
              {lesson.questions && lesson.questions.length > 0 && (
                <span className="lw-lesson-metatag">
                  <HelpCircle size={12} />
                  {lesson.questions.length} {lesson.questions.length === 1 ? "Checkpoint" : "Checkpoints"}
                </span>
              )}
            </div>

            <h1 className="lw-lesson-title">{lesson.title}</h1>

            {/* Quick Actions Toolbar */}
            <div className="lw-lesson-actionsbar">
              {onOpenContent && (
                <AnimatedButton variant="ghost" onClick={onOpenContent}>
                  <FileText size={14} className="lw-lesson-actbtn__icon" />
                  <span>{t("learnerContent.eyebrow")}</span>
                </AnimatedButton>
              )}
              {onOpenHomework && (
                <AnimatedButton variant="ghost" onClick={onOpenHomework}>
                  <ClipboardList size={14} className="lw-lesson-actbtn__icon" />
                  <span>{t("learnerHomework.eyebrow")}</span>
                </AnimatedButton>
              )}
              {onOpenResources && (
                <AnimatedButton variant="ghost" onClick={onOpenResources}>
                  <Paperclip size={14} className="lw-lesson-actbtn__icon" />
                  <span>{t("learnerResources.eyebrow")}</span>
                </AnimatedButton>
              )}
              {onOpenQuiz && (
                <AnimatedButton variant="ghost" onClick={onOpenQuiz}>
                  <HelpCircle size={14} className="lw-lesson-actbtn__icon" />
                  <span>{t("learnerStudio.quiz")}</span>
                </AnimatedButton>
              )}
              {onOpenAssignments && (
                <AnimatedButton variant="ghost" onClick={onOpenAssignments}>
                  <ListChecks size={14} className="lw-lesson-actbtn__icon" />
                  <span>{t("learnerAssignments.eyebrow")}</span>
                </AnimatedButton>
              )}
              {onOpenAssistant && (
                <AnimatedButton variant="primary" className="lw-lesson-actbtn--ai" onClick={onOpenAssistant}>
                  <Bot size={14} className="lw-lesson-actbtn__icon" />
                  <span>{t("aiAssistant.eyebrow")}</span>
                </AnimatedButton>
              )}
            </div>

            {/* Speechmatics Navigation & Tab Switcher */}
            <div className="speech-tabs" style={{ marginTop: 14 }}>
              <button
                type="button"
                className={`speech-tab-btn ${activeTab === "video" ? "is-active" : ""}`}
                onClick={() => setActiveTab("video")}
              >
                <Play size={13} />
                <span>Overview & Video</span>
              </button>
              <button
                type="button"
                className={`speech-tab-btn ${activeTab === "transcript" ? "is-active" : ""}`}
                onClick={() => setActiveTab("transcript")}
              >
                <Subtitles size={13} />
                <span>Synchronized Transcript</span>
              </button>
              {lesson.whatYoullLearn && (
                <button
                  type="button"
                  className={`speech-tab-btn ${activeTab === "objectives" ? "is-active" : ""}`}
                  onClick={() => setActiveTab("objectives")}
                >
                  <Sparkles size={13} />
                  <span>Objectives</span>
                </button>
              )}
            </div>
          </div>

          {activeTab === "transcript" && (
            <div className="lw-lesson-bodycard" style={{ marginBottom: 24 }}>
              {/* Waveform Visualizer Bar */}
              <div className="speech-waveform-container">
                <button
                  type="button"
                  className="speech-video-playbtn"
                  style={{ width: 34, height: 34, cursor: "pointer" }}
                  onClick={() => {
                    if (videoRef.current) {
                      if (videoRef.current.paused) videoRef.current.play();
                      else videoRef.current.pause();
                    }
                  }}
                  title="Play / Pause"
                >
                  <Play size={13} />
                </button>
                <div className="speech-waveform-bars">
                  {[26, 14, 22, 30, 16, 24, 18, 32, 26, 12, 20, 28, 15, 30, 24, 18, 22, 16, 28, 20, 32, 14, 26, 18, 30, 22, 16, 24, 14, 28, 20, 32, 18, 24, 12, 30, 26, 16, 22, 28].map((h, i) => (
                    <div
                      key={i}
                      className={`speech-waveform-bar ${i < 18 ? "is-played" : ""}`}
                      style={{ height: `${h}px` }}
                    />
                  ))}
                </div>
                <div className="speech-credit-badge" style={{ fontSize: 11, padding: "3px 10px" }}>
                  <Volume2 size={12} />
                  <span>AI Synchronized</span>
                </div>
              </div>

              {/* Spoken Word Chips Container */}
              <div className="speech-transcript-box">
                {transcriptWords.map((word, idx) => (
                  <span
                    key={idx}
                    className={`speech-word-chip ${idx === activeWordIndex ? "is-active" : ""}`}
                    onClick={() => {
                      setActiveWordIndex(idx);
                      if (videoRef.current) {
                        videoRef.current.currentTime = idx * 2.2;
                        videoRef.current.play?.();
                      }
                    }}
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <Message type="error">{error}</Message>}

          {isLive && (
            <div className="lw-lesson-livebanner">
              <Radio size={16} className="lw-lesson-liveicon" />
              <div className="lw-lesson-livetext">
                <strong>Live Session</strong> — {t("learnerLesson.liveSessionPrefix")}{(lesson.video || lesson.videoUrl) ? ` ${t("learnerLesson.liveSessionWithRecording")}` : "."}
              </div>
            </div>
          )}

          {/* 3. What You'll Learn Card */}
          {lesson.whatYoullLearn ? (
            <div className="lw-lesson-outcomes">
              <div className="lw-lesson-outcomes__header">
                <div className="lw-lesson-outcomes__iconwrap">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="lw-lesson-outcomes__title">{t("studio.whatYoullLearnLabel")}</div>
                  <div className="lw-lesson-outcomes__subtitle">Key objectives covered in this lesson</div>
                </div>
              </div>
              <div className="lw-lesson-outcomes__body">
                <MarkdownText className="lw-lesson-outcomes__text" text={lesson.whatYoullLearn} />
              </div>
            </div>
          ) : lesson.body ? (
            <div className="lw-lesson-bodycard">
              <MarkdownText className="lw-lesson-bodytext" text={lesson.body} />
            </div>
          ) : null}

          {submitting && (
            <div className="lw-lesson-gradingcard">
              <LoaderCircle size={20} className="lw-learn__spin" />
              <span>{t("learnerLesson.grading")}</span>
            </div>
          )}

          {/* Results & AI Feedback */}
          {result && (
            <div className="lw-lesson-resultcard">
              <div className="lw-lesson-resultcard__header">
                <div className="lw-lesson-resultcard__avatar">
                  <Bot size={22} />
                </div>
                <div className="lw-lesson-resultcard__summary">
                  <div className="lw-lesson-resultcard__scorebadge" data-passed={result.passed ? "true" : "false"}>
                    {result.passed ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span>{t("studio.passed")} · {result.scorePercent}%</span>
                      </>
                    ) : (
                      <>
                        <X size={16} />
                        <span>{t("studio.notYetPassing")} · {result.scorePercent}%</span>
                      </>
                    )}
                  </div>
                  {result.aiFeedback && (
                    <p className="lw-lesson-resultcard__feedback">{result.aiFeedback}</p>
                  )}
                </div>
              </div>

              {lesson.questions && lesson.questions.length > 0 && (
                <div className="lw-lesson-resultcard__questions">
                  <div className="lw-lesson-resultcard__sectiontitle">Question Review</div>
                  {lesson.questions.map((q, idx) => {
                    const pq = result.perQuestion.find((p) => p.questionId === q.id);
                    const reviewed = pq?.correct == null;
                    const isCorrect = pq?.correct === true;
                    return (
                      <div key={q.id} className="lw-lesson-resultrow" data-status={reviewed ? "reviewed" : isCorrect ? "correct" : "incorrect"}>
                        <div className="lw-lesson-resultrow__icon">
                          {reviewed ? <Sparkles size={16} /> : isCorrect ? <Check size={16} /> : <X size={16} />}
                        </div>
                        <div className="lw-lesson-resultrow__content">
                          <div className="lw-lesson-resultrow__prompt">
                            <span className="lw-lesson-resultrow__num">Q{idx + 1}.</span> {q.prompt}
                          </div>
                          <div className="lw-lesson-resultrow__detail">
                            {reviewed ? (
                              <span className="lw-lesson-resultrow__subtext">{t("studio.reviewedNotScored")}</span>
                            ) : isCorrect ? (
                              <span className="lw-lesson-resultrow__correcttag">{t("studio.correct")}</span>
                            ) : (
                              <span className="lw-lesson-resultrow__incorrecttag">
                                {t("studio.correctAnswerIs", { answer: pq?.correctAnswerDisplay ?? t("studio.notAvailable") })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {result.competencyLevels && Object.keys(result.competencyLevels).length > 0 && (
                <div className="lw-lesson-resultcard__competencies">
                  <CompetencyBreakdown levels={result.competencyLevels} />
                </div>
              )}
            </div>
          )}

          {!hasVideo && lesson.questions.length === 0 && done && (
            <div className="lw-lesson-donebanner">
              <CheckCircle2 size={18} />
              <span>{t("learnerLesson.doneBanner")}</span>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function QuestionPrompt({ question, onAnswer }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState("");

  const isChoice = question.type === "MultipleChoice" || question.type === "TrueFalse";
  const canSubmit = isChoice ? selected != null : text.trim().length > 0;

  const optionLetters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="lw-checkpoint-card">
      <div className="lw-checkpoint-card__header">
        <span className="lw-checkpoint-kicker">
          <Sparkles size={13} />
          {t("learnerLesson.checkpoint")}
        </span>
      </div>
      <p className="lw-checkpoint-prompt">{question.prompt}</p>

      {isChoice ? (
        <div className="lw-checkpoint-options">
          {question.options.map((opt, i) => {
            const isSel = selected === i;
            return (
              <button
                type="button"
                key={i}
                className={`lw-checkpoint-option ${isSel ? "is-selected" : ""}`}
                onClick={() => setSelected(i)}
              >
                <span className="lw-checkpoint-optletter">{optionLetters[i] ?? (i + 1)}</span>
                <span className="lw-checkpoint-opttext">{opt}</span>
                {isSel && <Check size={16} className="lw-checkpoint-optcheck" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="lw-checkpoint-inputwrap">
          <textarea
            className="lw-checkpoint-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder={question.type === "CompleteTheSentence" ? t("studio.yourAnswerPlaceholder") : t("studio.yourResponsePlaceholder")}
          />
        </div>
      )}

      <div className="lw-checkpoint-footer">
        <button
          type="button"
          className="lw-checkpoint-submitbtn"
          disabled={!canSubmit}
          onClick={() => onAnswer(isChoice ? { selectedOptionIndex: selected, textAnswer: null } : { selectedOptionIndex: null, textAnswer: text.trim() })}
        >
          <span>{t("learnerLesson.continue")}</span>
          <Check size={15} />
        </button>
      </div>
    </div>
  );
}

const CSS = `
  /* Modern Learner Lesson Experience */
  .lw-lesson-page {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 0 48px;
  }

  /* Top Navigation & Status Bar */
  .lw-lesson-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--line);
  }

  .lw-lesson-backbtn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 9999px;
    color: var(--ink);
    font-family: var(--font-body);
    font-size: 0.84rem;
    font-weight: 500;
    cursor: pointer;
    padding: 6px 14px;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .lw-lesson-backbtn:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--surface));
    transform: translateX(-2px);
  }

  .lw-lesson-statuspill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 9999px;
    letter-spacing: 0.02em;
  }
  .lw-lesson-statuspill--done {
    background: color-mix(in srgb, var(--success, #1E7D61) 14%, var(--surface));
    color: var(--success, #1E7D61);
    border: 1px solid color-mix(in srgb, var(--success, #1E7D61) 30%, transparent);
    box-shadow: 0 1px 4px rgba(30,125,97,0.12);
  }
  .lw-lesson-statuspill--active {
    background: color-mix(in srgb, var(--accent-2) 12%, var(--surface));
    color: var(--accent-2);
    border: 1px solid color-mix(in srgb, var(--accent-2) 25%, transparent);
  }
  .lw-lesson-statuspulse {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent-2);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-2) 40%, transparent);
    animation: lwPulse 2s infinite cubic-bezier(0.45, 0, 0.55, 1);
  }
  @keyframes lwPulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-2) 50%, transparent); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px transparent; }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 transparent; }
  }

  /* Loading State */
  .lw-learn__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--ink-soft);
    font-size: 0.95rem;
    padding: 60px 0;
    font-weight: 500;
  }
  .lw-learn__spin {
    animation: lwLearnSpin 0.8s linear infinite;
    color: var(--accent);
  }
  @keyframes lwLearnSpin { to { transform: rotate(360deg); } }

  /* Lesson Hero Header */
  .lw-lesson-hero {
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lw-lesson-hero__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .lw-lesson-eyebadge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
    padding: 3px 10px;
    border-radius: 9999px;
  }

  .lw-lesson-metatag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--ink-soft);
    background: var(--surface-2, rgba(0,0,0,0.04));
    padding: 3px 9px;
    border-radius: 9999px;
    font-weight: 500;
  }

  .lw-lesson-title {
    font-family: var(--font-body, system-ui);
    font-size: 2.1rem;
    font-weight: 700;
    line-height: 1.25;
    color: var(--ink);
    margin: 4px 0 8px;
    letter-spacing: -0.02em;
    text-align: start;
  }

  /* Quick Actions Bar */
  .lw-lesson-actionsbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 6px 0;
  }

  .lw-lesson-actbtn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-body);
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 9999px;
    padding: 6px 14px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    position: relative;
    overflow: hidden;
  }
  .lw-lesson-actbtn:hover {
    background: var(--surface-2, rgba(0,0,0,0.05));
    border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
    color: var(--ink);
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(0,0,0,0.06);
  }
  .lw-lesson-actbtn__icon {
    color: var(--ink-soft);
    transition: color 0.15s ease;
  }
  .lw-lesson-actbtn:hover .lw-lesson-actbtn__icon {
    color: var(--accent);
  }

  .lw-lesson-actbtn--ai {
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--surface)), var(--surface));
    border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
    color: var(--accent);
    font-weight: 600;
  }
  .lw-lesson-actbtn--ai .lw-lesson-actbtn__icon {
    color: var(--accent);
  }
  .lw-lesson-actbtn--ai:hover {
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 20%, var(--surface)), var(--surface));
    border-color: var(--accent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 22%, transparent);
  }

  /* Live Session Banner */
  .lw-lesson-livebanner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: color-mix(in srgb, #E53E3E 8%, var(--surface));
    border: 1px solid color-mix(in srgb, #E53E3E 24%, var(--line));
    border-radius: var(--radius, 12px);
    margin-bottom: 20px;
    font-size: 0.88rem;
    color: var(--ink);
  }
  .lw-lesson-liveicon {
    color: #E53E3E;
    flex-shrink: 0;
  }

  /* What You'll Learn Outcomes Card */
  .lw-lesson-outcomes {
    background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 5%, var(--surface)), var(--surface));
    border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--line));
    border-radius: var(--radius, 16px);
    padding: 20px 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  }
  .lw-lesson-outcomes__header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .lw-lesson-outcomes__iconwrap {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .lw-lesson-outcomes__title {
    font-family: var(--font-body, system-ui);
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.01em;
  }
  .lw-lesson-outcomes__subtitle {
    font-size: 0.78rem;
    color: var(--ink-soft);
    margin-top: 1px;
  }
  .lw-lesson-outcomes__body {
    border-top: 1px solid color-mix(in srgb, var(--accent) 12%, var(--line));
    padding-top: 12px;
  }
  .lw-lesson-outcomes__text {
    font-size: 0.92rem;
    color: var(--ink);
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .lw-lesson-outcomes__text ul {
    margin: 0;
    padding-inline-start: 20px;
  }
  .lw-lesson-outcomes__text li {
    margin-bottom: 6px;
  }

  .lw-lesson-bodycard {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius, 16px);
    padding: 20px 24px;
    margin-bottom: 24px;
  }
  .lw-lesson-bodytext {
    font-size: 0.94rem;
    color: var(--ink);
    line-height: 1.7;
    white-space: pre-wrap;
  }

  /* Cinema Video Player Experience */
  .lw-lesson-cinema {
    position: relative;
    width: 100%;
    margin-bottom: 28px;
    border-radius: var(--radius, 16px);
    box-shadow: 0 16px 40px -12px rgba(0,0,0,0.35);
    background: #000;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .lw-lesson-playerframe {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
  }

  /* Interactive Checkpoint Overlay */
  .lw-lesson-checkpoint-overlay {
    position: absolute;
    inset: 0;
    background: rgba(10, 14, 22, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 10;
    animation: lwFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .lw-lesson-standalone-checkpoint {
    display: flex;
    justify-content: center;
    margin-bottom: 28px;
  }

  @keyframes lwFadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }

  /* Checkpoint Card */
  .lw-checkpoint-card {
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: var(--radius, 16px);
    padding: 26px 28px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 20px 48px -8px rgba(0,0,0,0.45);
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: lwSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes lwSlideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .lw-checkpoint-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .lw-checkpoint-kicker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    padding: 4px 10px;
    border-radius: 9999px;
  }

  .lw-checkpoint-prompt {
    font-family: var(--font-body, system-ui);
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.5;
    color: var(--ink);
    margin: 0;
  }

  /* Options list */
  .lw-checkpoint-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .lw-checkpoint-option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: start;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px 14px;
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--ink);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .lw-checkpoint-option:hover {
    background: var(--surface-2, rgba(0,0,0,0.04));
    border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
    transform: translateX(2px);
  }
  .lw-checkpoint-option.is-selected {
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .lw-checkpoint-optletter {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--surface-2, rgba(0,0,0,0.06));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-soft);
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .lw-checkpoint-option.is-selected .lw-checkpoint-optletter {
    background: var(--accent);
    color: var(--on-accent, #fff);
  }
  .lw-checkpoint-opttext {
    flex: 1;
    line-height: 1.4;
  }
  .lw-checkpoint-optcheck {
    color: var(--accent);
    flex-shrink: 0;
  }

  .lw-checkpoint-inputwrap {
    width: 100%;
  }
  .lw-checkpoint-input {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-body);
    font-size: 0.92rem;
    color: var(--ink);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px 14px;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .lw-checkpoint-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .lw-checkpoint-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }
  .lw-checkpoint-submitbtn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--accent);
    color: var(--on-accent, #fff);
    border: none;
    border-radius: 9999px;
    padding: 9px 20px;
    font-family: var(--font-body);
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .lw-checkpoint-submitbtn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .lw-checkpoint-submitbtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* Grading Card */
  .lw-lesson-gradingcard {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius, 14px);
    color: var(--ink-soft);
    font-size: 0.94rem;
    font-weight: 500;
    margin-top: 20px;
  }

  /* Results Card */
  .lw-lesson-resultcard {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius, 16px);
    padding: 24px 28px;
    margin-top: 24px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  }
  .lw-lesson-resultcard__header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--line);
  }
  .lw-lesson-resultcard__avatar {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .lw-lesson-resultcard__summary {
    flex: 1;
  }
  .lw-lesson-resultcard__scorebadge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 0.88rem;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .lw-lesson-resultcard__scorebadge[data-passed="true"] {
    background: color-mix(in srgb, var(--success, #1E7D61) 14%, var(--surface));
    color: var(--success, #1E7D61);
    border: 1px solid color-mix(in srgb, var(--success, #1E7D61) 30%, transparent);
  }
  .lw-lesson-resultcard__scorebadge[data-passed="false"] {
    background: color-mix(in srgb, var(--danger, #E53E3E) 14%, var(--surface));
    color: var(--danger, #E53E3E);
    border: 1px solid color-mix(in srgb, var(--danger, #E53E3E) 30%, transparent);
  }
  .lw-lesson-resultcard__feedback {
    margin: 4px 0 0;
    font-size: 0.94rem;
    color: var(--ink);
    line-height: 1.6;
  }

  .lw-lesson-resultcard__questions {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .lw-lesson-resultcard__sectiontitle {
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-soft);
    margin-bottom: 4px;
  }

  .lw-lesson-resultrow {
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--bg);
    border: 1px solid var(--line);
  }
  .lw-lesson-resultrow[data-status="correct"] {
    border-color: color-mix(in srgb, var(--success, #1E7D61) 30%, var(--line));
    background: color-mix(in srgb, var(--success, #1E7D61) 4%, var(--bg));
  }
  .lw-lesson-resultrow[data-status="incorrect"] {
    border-color: color-mix(in srgb, var(--danger, #E53E3E) 30%, var(--line));
    background: color-mix(in srgb, var(--danger, #E53E3E) 4%, var(--bg));
  }
  .lw-lesson-resultrow__icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .lw-lesson-resultrow[data-status="correct"] .lw-lesson-resultrow__icon {
    background: color-mix(in srgb, var(--success, #1E7D61) 18%, transparent);
    color: var(--success, #1E7D61);
  }
  .lw-lesson-resultrow[data-status="incorrect"] .lw-lesson-resultrow__icon {
    background: color-mix(in srgb, var(--danger, #E53E3E) 18%, transparent);
    color: var(--danger, #E53E3E);
  }
  .lw-lesson-resultrow[data-status="reviewed"] .lw-lesson-resultrow__icon {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent);
  }
  .lw-lesson-resultrow__content {
    flex: 1;
  }
  .lw-lesson-resultrow__prompt {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.45;
  }
  .lw-lesson-resultrow__num {
    color: var(--ink-soft);
    margin-inline-end: 4px;
  }
  .lw-lesson-resultrow__detail {
    margin-top: 4px;
    font-size: 0.84rem;
  }
  .lw-lesson-resultrow__correcttag {
    color: var(--success, #1E7D61);
    font-weight: 600;
  }
  .lw-lesson-resultrow__incorrecttag {
    color: var(--danger, #E53E3E);
  }
  .lw-lesson-resultrow__subtext {
    color: var(--ink-soft);
  }

  .lw-lesson-resultcard__competencies {
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
  }

  .lw-lesson-donebanner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    border-radius: var(--radius, 12px);
    background: color-mix(in srgb, var(--success, #1E7D61) 10%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--success, #1E7D61) 25%, var(--line));
    color: var(--success, #1E7D61);
    font-size: 0.92rem;
    font-weight: 600;
    margin-top: 24px;
  }

  @media (max-width: 640px) {
    .lw-lesson-title {
      font-size: 1.6rem;
    }
    .lw-lesson-topbar {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .lw-lesson-actionsbar {
      gap: 6px;
    }
    .lw-lesson-actbtn {
      padding: 5px 10px;
      font-size: 0.78rem;
    }
    .lw-checkpoint-card {
      padding: 18px 16px;
    }
  }
`;

