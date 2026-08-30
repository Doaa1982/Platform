import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, ArrowLeft, CheckCircle2, Paperclip, UploadCloud, X } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import QuizScreen from "./QuizScreen";

/* =========================================================================
   ASSIGNMENT SUBMISSION (Learner) — take/submit one Assignment.

   Type Quiz/QuestionSet (an assessmentId is set) hands off entirely to the
   existing, unmodified QuizScreen — grading still rides the original
   Assessment.Grade() rails; this screen only adds the due-date/policy
   context around it. Every other type gets the generic free-text Response
   flow this feature adds (Assessment and Submission Aggregate Design v1.1):
   start → write a response → submit → wait for the tutor's evaluation.
   ========================================================================= */

export default function AssignmentSubmissionScreen({ lessonId, activityId, onBack }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [attachedAsset, setAttachedAsset] = useState(null); // { id, title } — this attempt's uploaded file, if any
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const load = useCallback(() => (
    api.getMyAssignment(session.token, slug, lessonId, activityId)
      .then((d) => { setData(d); setError(null); return d; })
      .catch((e) => { setError(e.message); return null; })
  ), [session.token, slug, lessonId, activityId]);

  useEffect(() => { load(); }, [load]);

  const latest = data?.submissions?.[0] ?? null;
  const isQuiz = data?.activity.type === "Quiz" || data?.activity.type === "QuestionSet";

  // The existing quiz flow owns its own back button/navigation — no need
  // for this screen's own chrome once it's handed off.
  if (data && isQuiz && data.activity.assessmentId) {
    return <QuizScreen lessonId={lessonId} onBackToLesson={onBack} onGoToLessons={onBack} />;
  }

  async function handleStart() {
    setBusy(true); setError(null);
    try { await api.startAssignmentSubmission(session.token, slug, lessonId, activityId); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function handleUploadFile(fileList) {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true); setUploadProgress(0); setError(null);
    try {
      const asset = await api.uploadSubmissionAsset(session.token, slug, file, setUploadProgress);
      setAttachedAsset({ id: asset.id, title: asset.title });
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  }

  async function handleSubmitResponse() {
    if (!latest || (!responseText.trim() && !attachedAsset)) return;
    setBusy(true); setError(null);
    try {
      await api.recordAssignmentResponse(session.token, slug, lessonId, activityId, latest.id, {
        text: responseText || null, attachedLearningAssetId: attachedAsset?.id ?? null,
      });
      setResponseText(""); setAttachedAsset(null);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (error && !data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <button className="lw-assign__back" onClick={onBack}><ArrowLeft size={13} /> {t("learnerAssignments.backToAssignments")}</button>
        <Message type="error">{error}</Message>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <div className="lw-assign__loading"><LoaderCircle size={18} className="lw-assign__spin" /> {t("learnerAssignments.loading")}</div>
      </div>
    );
  }

  const { assignment, activity } = data;
  const canStart = ["Published", "Active"].includes(assignment.status);

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <button className="lw-assign__back" onClick={onBack}><ArrowLeft size={13} /> {t("learnerAssignments.backToAssignments")}</button>

      <div className="lw-eyebrow">{t(`studio.activityType.${activity.type}`)}</div>
      <h1>{activity.title}</h1>
      <p className="lw-assign__duemeta">
        {assignment.dueAt ? t("learnerAssignments.dueLabel", { date: new Date(assignment.dueAt).toLocaleString() }) : t("learnerAssignments.noDueDate")}
      </p>

      {error && <Message type="error">{error}</Message>}

      {activity.instructions && (
        <>
          <h2 className="lw-assign__sectiontitle">{t("learnerAssignments.instructionsTitle")}</h2>
          <p className="lw-assign__instructions">{activity.instructions}</p>
        </>
      )}

      {!latest && (
        <button className="lw-btn lw-btn--primary lw-btn--sm" disabled={busy || !canStart} onClick={handleStart}>
          {t("learnerAssignments.startAssignment")}
        </button>
      )}

      {latest?.status === "InProgress" && (
        <div className="lw-assign__responsearea">
          <label>
            <span>{t("learnerAssignments.yourResponseLabel")}</span>
            <textarea rows={8} value={responseText} onChange={(e) => setResponseText(e.target.value)}
                      placeholder={t("learnerAssignments.responsePlaceholder")} disabled={busy} />
          </label>

          {attachedAsset ? (
            <div className="lw-assign__attachedfile">
              <Paperclip size={13} />
              <span>{attachedAsset.title}</span>
              <button type="button" className="lw-assign__removefile" onClick={() => setAttachedAsset(null)} disabled={busy} title={t("learnerAssignments.removeFile")}>
                <X size={13} />
              </button>
            </div>
          ) : uploading ? (
            <div className="lw-assign__uploadingfile">
              <LoaderCircle size={14} className="lw-assign__spin" /> {t("learnerAssignments.uploadingPct", { pct: Math.round(uploadProgress * 100) })}
            </div>
          ) : (
            <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              <UploadCloud size={13} /> {t("learnerAssignments.attachFile")}
            </button>
          )}
          <input
            ref={fileInputRef} type="file" style={{ display: "none" }}
            onChange={(e) => { handleUploadFile(e.target.files); e.target.value = ""; }}
          />

          <button className="lw-btn lw-btn--primary lw-btn--sm" disabled={busy || uploading || (!responseText.trim() && !attachedAsset)} onClick={handleSubmitResponse}>
            {t("learnerAssignments.submitResponse")}
          </button>
        </div>
      )}

      {(latest?.status === "Submitted" || latest?.status === "UnderReview") && (
        <div className="lw-assign__notice">
          <p>{t("learnerAssignments.awaitingReview")}</p>
          {latest.responseText && <p className="lw-assign__responsefull">{latest.responseText}</p>}
          {latest.responseLearningAssetId && (
            <a className="lw-assign__downloadlink" href={api.learningAssetDownloadUrl(session.token, slug, latest.responseLearningAssetId)} target="_blank" rel="noreferrer">
              <Paperclip size={13} /> {t("learnerAssignments.downloadYourFile")}
            </a>
          )}
        </div>
      )}

      {latest?.status === "Evaluated" && (
        <div className="lw-assign__feedbackbox">
          <h2 className="lw-assign__sectiontitle">{t("learnerAssignments.feedbackTitle")}</h2>
          <span className={`lw-assign__pill ${latest.passed === true ? "is-passed" : latest.passed === false ? "is-failed" : ""}`}>
            {latest.passed == null ? <>{t("learnerAssignments.resultReviewed")}</>
              : latest.passed ? <><CheckCircle2 size={11} /> {t("learnerAssignments.resultPassed")}</>
              : t("learnerAssignments.resultNotPassed")}
          </span>
          {latest.feedback && <p className="lw-assign__responsefull">{latest.feedback}</p>}
          {latest.responseLearningAssetId && (
            <a className="lw-assign__downloadlink" href={api.learningAssetDownloadUrl(session.token, slug, latest.responseLearningAssetId)} target="_blank" rel="noreferrer">
              <Paperclip size={13} /> {t("learnerAssignments.downloadYourFile")}
            </a>
          )}
        </div>
      )}

      {latest?.status === "Evaluated" && (
        // A tutor may reset a learner's attempt count after grading
        // (Assignment BA-011) — the backend, not this screen, is the
        // authority on whether another attempt is actually allowed right
        // now; a rejected attempt surfaces the backend's own message via
        // the error state below, same as the very first Start button.
        <button className="lw-btn lw-btn--ghost lw-btn--sm" style={{ marginTop: 14 }} disabled={busy || !canStart} onClick={handleStart}>
          {t("learnerAssignments.startNewAttempt")}
        </button>
      )}
    </div>
  );
}

const CSS = `
  .lw-assign__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-assign__spin { animation: lwAssignSubSpin 0.9s linear infinite; }
  @keyframes lwAssignSubSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-assign__spin { animation: none; } }
  .lw-assign__back {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--ink-soft);
    font-family: var(--font-body); font-size: 0.82rem; cursor: pointer; padding: 3px 6px; margin-bottom: 14px; margin-inline-start: -6px;
  }
  .lw-assign__back:hover { color: var(--ink); background: var(--surface-2, rgba(0,0,0,0.05)); }

  .lw-assign__duemeta { color: var(--ink-soft); font-size: 0.85rem; margin: -6px 0 20px; }
  .lw-assign__sectiontitle { font-size: 1rem; margin: 20px 0 10px; }
  .lw-assign__instructions { white-space: pre-wrap; font-size: 0.92rem; line-height: 1.6; max-width: 68ch; }

  .lw-assign__responsearea { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; max-width: 68ch; margin-top: 10px; }
  .lw-assign__responsearea label { display: flex; flex-direction: column; gap: 6px; width: 100%; }
  .lw-assign__responsearea textarea { width: 100%; font-family: inherit; font-size: 0.92rem; }
  .lw-assign__attachedfile, .lw-assign__uploadingfile {
    display: inline-flex; align-items: center; gap: 7px; font-size: 0.85rem; color: var(--ink-soft);
    background: var(--surface-2); border-radius: var(--radius-sm); padding: 6px 10px;
  }
  .lw-assign__removefile { display: inline-flex; background: transparent; border: none; cursor: pointer; color: var(--ink-soft); padding: 0; }
  .lw-assign__removefile:hover { color: var(--danger); }
  .lw-assign__downloadlink { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--accent); margin-top: 8px; }

  .lw-assign__notice, .lw-assign__feedbackbox {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 14px 16px; margin-top: 14px; max-width: 68ch;
  }
  .lw-assign__responsefull { white-space: pre-wrap; font-size: 0.88rem; margin-top: 8px; }

  .lw-assign__pill {
    display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-mono); font-size: 10px;
    border-radius: 20px; padding: 3px 9px; background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-assign__pill.is-passed { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2); }
  .lw-assign__pill.is-failed { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
`;
