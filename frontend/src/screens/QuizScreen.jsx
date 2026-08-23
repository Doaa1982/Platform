import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, HelpCircle, LoaderCircle, Check, X, RotateCcw, Sparkles, Bot } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   QUIZ — one subscreen, two possible quizzes, decided by what the lesson
   actually has:

   - If the tutor has published a real Standalone quiz for this lesson (see
     AssessmentKind), that's what shows here: real questions, a passing
     threshold, graded as a real Submission. This used to live inline on the
     lesson page under the video; it moved here so "Quiz" is one door
     regardless of which kind a learner is about to get.
   - Otherwise, this falls back to the Studio "Quiz" output: an AI-drafted,
     ungraded self-check generated on demand from the lesson's material
     (GenerateLessonQuizSkill) — never persisted, never touches
     Submission/LessonProgress. Distinct on purpose: this is a self-check
     tool, not a stand-in for a tutor's real assessment.

   Reached the same way the Assistant is (a button on the lesson page, and
   the "Quiz" tile inside the Assistant's own Studio panel).
   ========================================================================= */

export default function QuizScreen({ lessonId, onGoToLessons, onBackToLesson }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  if (!lessonId) return <NoLessonSelected onGoToLessons={onGoToLessons} />;
  return <LessonQuiz key={lessonId} lessonId={lessonId} slug={slug} token={session.token} onBackToLesson={onBackToLesson} />;
}

function NoLessonSelected({ onGoToLessons }) {
  const { t } = useLanguage();
  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("learnerStudio.quizEyebrow")}</div>
      <h1>{t("learnerStudio.quizNoLessonTitle")}</h1>

      <div className="lw-nby">
        <span className="lw-nby__icon" aria-hidden="true"><HelpCircle size={20} /></span>
        <div>
          <p className="lw-nby__lead">{t("learnerStudio.quizNoLessonBlurb")}</p>
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={onGoToLessons}>
            {t("aiAssistant.goToLessons")} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonQuiz({ lessonId, slug, token, onBackToLesson }) {
  const { t } = useLanguage();

  const [lesson, setLesson] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    // No manual reset needed: QuizScreen mounts this with key={lessonId}
    // above, so a new lesson gets a fresh component instance instead of this
    // effect having to reset state itself.
    let cancelled = false;
    api.getLearnerLesson(token, slug, lessonId)
      .then((l) => { if (!cancelled) setLesson(l); })
      .catch((e) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
  }, [token, slug, lessonId]);

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      {onBackToLesson && (
        <button className="lw-learn__back" onClick={onBackToLesson}>
          <ArrowLeft size={13} /> {t("aiAssistant.backToLesson")}
        </button>
      )}

      {loadError && <Message type="error">{loadError}</Message>}
      {!lesson && !loadError && (
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> {t("learnerLesson.loading")}</div>
      )}

      {lesson && (
        lesson.standaloneAssessment
          ? <RealQuiz
              assessment={lesson.standaloneAssessment}
              onSubmit={(answers) => api.submitStandaloneAssessment(token, slug, lessonId, answers)}
            />
          : <PracticeQuiz lesson={lesson} slug={slug} token={token} lessonId={lessonId} />
      )}
    </div>
  );
}

/**
 * The tutor's real, graded quiz for this lesson (AssessmentKind.Standalone)
 * — every question shown at once (no timeline to pace against), graded as
 * its own real Submission. Deliberately doesn't touch LessonProgress or the
 * lesson-page completion badge — see SubmitStandaloneAssessmentAsync's
 * remarks.
 */
function RealQuiz({ assessment, onSubmit }) {
  const { t } = useLanguage();
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [retaking, setRetaking] = useState(false);

  const showForm = retaking || (!assessment.attempted && !result);
  const summary = result ?? (assessment.attempted && !retaking
    ? { scorePercent: assessment.scorePercent, passed: assessment.passed, perQuestion: null } : null);

  function setAnswer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  const allAnswered = assessment.questions.every((q) => {
    const a = answers[q.id];
    if (!a) return false;
    return (q.type === "MultipleChoice" || q.type === "TrueFalse")
      ? a.selectedOptionIndex != null
      : !!(a.textAnswer && a.textAnswer.trim());
  });

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = assessment.questions.map((q) => ({
        questionId: q.id,
        selectedOptionIndex: answers[q.id]?.selectedOptionIndex ?? null,
        textAnswer: answers[q.id]?.textAnswer ?? null,
      }));
      const r = await onSubmit(payload);
      setResult(r);
      setRetaking(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="lw-eyebrow">{t("learnerLesson.standaloneEyebrow")}</div>
      <h1>{assessment.title}</h1>

      {error && <Message type="error">{error}</Message>}

      {summary && (
        <div className="lw-aicard" style={{ marginTop: 14, flexDirection: "column", alignItems: "stretch" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Bot size={16} />
            <div className="lw-aicard__body">
              <strong>{summary.passed ? t("studio.passed") : t("studio.notYetPassing")} — {summary.scorePercent}%</strong>
            </div>
          </div>
          {result && (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {assessment.questions.map((q) => {
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
          )}
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" style={{ marginTop: 14, width: "fit-content" }}
                  onClick={() => { setRetaking(true); setResult(null); setAnswers({}); }}>
            {t("learnerLesson.retakeQuiz")}
          </button>
        </div>
      )}

      {showForm && (
        <div className="lw-learn__standaloneqform">
          {assessment.questions.map((q) => (
            <StandaloneQuestionField key={q.id} question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
          ))}
          <button type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={!allAnswered || submitting}
                  style={{ width: "fit-content" }} onClick={handleSubmit}>
            {submitting ? <LoaderCircle size={13} className="lw-learn__spin" /> : <Check size={13} />} {t("learnerLesson.submitQuiz")}
          </button>
        </div>
      )}
    </>
  );
}

function StandaloneQuestionField({ question, value, onChange }) {
  const { t } = useLanguage();
  const isChoice = question.type === "MultipleChoice" || question.type === "TrueFalse";
  return (
    <div className="lw-learn__standaloneqcard">
      <p className="lw-learn__checkpointprompt">{question.prompt}</p>
      {isChoice ? (
        <div className="lw-options">
          {question.options.map((opt, i) => (
            <button
              type="button" key={i}
              className={`lw-option ${value?.selectedOptionIndex === i ? "is-selected" : ""}`}
              onClick={() => onChange({ selectedOptionIndex: i, textAnswer: null })}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <input
          className="lw-learn__checkpointinput"
          value={value?.textAnswer ?? ""}
          onChange={(e) => onChange({ selectedOptionIndex: null, textAnswer: e.target.value })}
          placeholder={question.type === "CompleteTheSentence" ? t("studio.yourAnswerPlaceholder") : t("studio.yourResponsePlaceholder")}
        />
      )}
    </div>
  );
}

const COUNT_OPTIONS = [
  { key: "fewer", value: 3 },
  { key: "standard", value: 5 },
  { key: "more", value: 8 },
];
const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard"];

/**
 * The AI self-check fallback — shown only when this lesson has no real,
 * tutor-published Standalone quiz (RealQuiz above). Generated on demand,
 * ungraded, never persisted; see this file's own top remarks for why it's
 * kept deliberately distinct from RealQuiz rather than blended together.
 */
function PracticeQuiz({ lesson, slug, token, lessonId }) {
  const { t } = useLanguage();

  const [count, setCount] = useState("standard");
  const [difficulty, setDifficulty] = useState("Medium");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [quiz, setQuiz] = useState(null); // { questions } once generated

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const questionCount = COUNT_OPTIONS.find((o) => o.key === count)?.value ?? 5;
      const res = await api.generateLessonQuiz(token, slug, lessonId, { questionCount, difficulty, topic: topic.trim() || null });
      setQuiz({ questions: res.questions });
    } catch (e) {
      setError(e.message || t("learnerStudio.quizGenerateError"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div className="lw-eyebrow">{t("learnerStudio.quizEyebrow")}</div>
      <h1>{lesson.title}</h1>
      <p className="lw-ai__askingabout">{t("learnerStudio.quizAiNote")}</p>

      {error && <Message type="error">{error}</Message>}

      {!quiz && (
        <div className="lw-studio__configcard">
          <div className="lw-studio__field">
            <label className="lw-studio__label">{t("learnerStudio.numberOfQuestions")}</label>
            <div className="lw-studio__toggles">
              {COUNT_OPTIONS.map((o) => (
                <button
                  type="button" key={o.key}
                  className={`lw-studio__toggle ${count === o.key ? "is-active" : ""}`}
                  onClick={() => setCount(o.key)}
                >
                  {count === o.key && <Check size={12} />} {t(`learnerStudio.count.${o.key}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="lw-studio__field">
            <label className="lw-studio__label">{t("learnerStudio.difficulty")}</label>
            <div className="lw-studio__toggles">
              {DIFFICULTY_OPTIONS.map((d) => (
                <button
                  type="button" key={d}
                  className={`lw-studio__toggle ${difficulty === d ? "is-active" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  {difficulty === d && <Check size={12} />} {t(`learnerStudio.difficulty${d}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="lw-studio__field">
            <label className="lw-studio__label">{t("learnerStudio.topicLabel")}</label>
            <textarea
              className="lw-studio__topicinput"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("learnerStudio.topicPlaceholder")}
              rows={2}
            />
          </div>

          <button type="button" className="lw-btn lw-btn--accent" disabled={generating} onClick={handleGenerate}>
            {generating ? <LoaderCircle size={14} className="lw-learn__spin" /> : <Sparkles size={14} />}
            {generating ? t("learnerStudio.generating") : t("learnerStudio.generate")}
          </button>
        </div>
      )}

      {quiz && (
        <QuizResults questions={quiz.questions} onRetake={() => setQuiz(null)} />
      )}
    </>
  );
}

function QuizResults({ questions, onRetake }) {
  const { t } = useLanguage();
  const [answers, setAnswers] = useState({}); // index -> selectedOptionIndex

  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.reduce(
    (n, q, i) => n + (answers[i] === q.correctOptionIndex ? 1 : 0), 0);

  return (
    <div className="lw-studio__results">
      <div className="lw-studio__resultsheader">
        {answeredCount === questions.length && (
          <span className="lw-studio__score">{t("learnerStudio.score", { correct: correctCount, total: questions.length })}</span>
        )}
        <button type="button" className="lw-studio__retake" onClick={onRetake}>
          <RotateCcw size={12} /> {t("learnerStudio.newQuiz")}
        </button>
      </div>

      {questions.map((q, i) => {
        const selected = answers[i];
        const answered = selected != null;
        return (
          <div className="lw-studio__question" key={i}>
            <p className="lw-studio__prompt">{i + 1}. {q.prompt}</p>
            <div className="lw-options">
              {q.options.map((opt, oi) => {
                const isCorrect = oi === q.correctOptionIndex;
                const isSelected = oi === selected;
                let cls = "lw-option";
                if (answered && isCorrect) cls += " is-correct";
                else if (answered && isSelected && !isCorrect) cls += " is-wrong";
                else if (isSelected) cls += " is-selected";
                return (
                  <button
                    type="button" key={oi} className={cls} disabled={answered}
                    onClick={() => setAnswers((prev) => ({ ...prev, [i]: oi }))}
                  >
                    {answered && isCorrect && <Check size={13} />}
                    {answered && isSelected && !isCorrect && <X size={13} />}
                    {opt}
                  </button>
                );
              })}
            </div>
            {answered && q.explanation && <p className="lw-studio__explanation">{q.explanation}</p>}
          </div>
        );
      })}
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
  .lw-learn__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-learn__spin { animation: lwLearnSpin 0.9s linear infinite; }
  @keyframes lwLearnSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-learn__spin { animation: none; } }

  .lw-ai__askingabout { color: var(--ink-soft); font-size: 0.85rem; margin: -6px 0 18px; }

  .lw-learn__standaloneqform { display: grid; gap: 16px; margin-top: 14px; }
  .lw-learn__standaloneqcard {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 16px 18px; display: flex; flex-direction: column; gap: 10px;
    position: relative;
  }
  /* Notebook theme: dog-eared page corner (2026-08-15). */
  .lw-learn__standaloneqcard::after {
    content: ""; position: absolute; top: 0; inset-inline-end: 0; width: 0; height: 0;
    border-style: solid; border-width: 0 12px 12px 0;
    border-color: transparent var(--surface-2) transparent transparent;
    filter: drop-shadow(-1px 1px 1.5px rgba(0,0,0,0.18));
    pointer-events: none;
  }
  [dir="rtl"] .lw-learn__standaloneqcard::after { transform: scaleX(-1); }
  .lw-learn__checkpointprompt { font-size: 0.98rem; font-weight: 600; margin: 0; line-height: 1.5; }
  .lw-learn__checkpointinput {
    width: 100%; font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 9px 11px;
  }
  .lw-option.is-selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--bg)); }

  .lw-studio__configcard {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 22px 24px; max-width: 60ch;
    position: relative;
  }
  /* Notebook theme: dog-eared page corner (2026-08-15). */
  .lw-studio__configcard::after {
    content: ""; position: absolute; top: 0; inset-inline-end: 0; width: 0; height: 0;
    border-style: solid; border-width: 0 14px 14px 0;
    border-color: transparent var(--surface-2) transparent transparent;
    filter: drop-shadow(-1px 1px 1.5px rgba(0,0,0,0.18));
    pointer-events: none;
  }
  [dir="rtl"] .lw-studio__configcard::after { transform: scaleX(-1); }
  .lw-studio__field { margin: 0 0 18px; }
  .lw-studio__field:last-of-type { margin-bottom: 20px; }
  .lw-studio__label { display: block; font-size: 0.82rem; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
  .lw-studio__toggles { display: flex; gap: 6px; flex-wrap: wrap; }
  .lw-studio__toggle {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: var(--font-body); font-size: 0.82rem; color: var(--ink-soft);
    background: var(--bg); border: 1px solid var(--line); border-radius: 20px; padding: 6px 12px; cursor: pointer;
  }
  .lw-studio__toggle.is-active { color: var(--accent); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--bg)); }
  .lw-studio__topicinput {
    width: 100%; font-family: var(--font-body); font-size: 0.88rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 9px 11px; resize: vertical;
  }

  .lw-studio__results { margin-top: 4px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px 20px; max-width: 72ch; }
  .lw-studio__resultsheader { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; font-weight: 600; margin-bottom: 14px; }
  .lw-studio__score { font-family: var(--font-mono); font-size: 11px; color: var(--accent); }
  .lw-studio__retake {
    margin-inline-start: auto; display: inline-flex; align-items: center; gap: 5px;
    background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--ink-soft); font-size: 0.8rem; cursor: pointer;
  }
  .lw-studio__retake:hover { color: var(--ink); background: var(--surface-2, rgba(0,0,0,0.05)); }

  .lw-studio__question { padding: 12px 0; border-top: 1px solid var(--line); }
  .lw-studio__question:first-of-type { border-top: none; padding-top: 0; }
  .lw-studio__prompt { font-size: 0.9rem; font-weight: 600; margin: 0 0 10px; }
  .lw-studio__explanation { font-size: 0.83rem; color: var(--ink-soft); margin: 10px 0 0; line-height: 1.5; }
`;
