import { useCallback, useEffect, useState } from "react";
import { formatDateActive } from "../i18n/format";
import { LoaderCircle, ArrowLeft, ClipboardCheck, RotateCcw, Paperclip, Archive } from "lucide-react";
import * as api from "../api/client";
import AssetLink from "../components/AssetLink";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import Notice from "../components/Notice";
import Modal, { MODAL_CSS } from "../components/Modal";

/* =========================================================================
   ASSIGNMENTS OVERVIEW — the tutor's Assignment dashboard: one row per
   Assignment across the workspace, with a click-through per-assignment
   grading queue (every targeted learner × their submission, or "not
   started"). Recipients are never a stored list here — the row/queue
   counts come straight from Assignment/Submission, the same live-Enrollment
   resolution the backend already does (Assignment Aggregate Design INV-004).
   ========================================================================= */

/** Every Assignment and Submission status the API sends, as a translated label — never the raw enum. */
const ASSIGNMENT_STATUS_KEY = {
  Draft: "assignOverview.statusDraft", Scheduled: "assignOverview.statusScheduled",
  Published: "assignOverview.statusPublished", Active: "assignOverview.statusActive",
  Closed: "assignOverview.statusClosed", Archived: "assignOverview.statusArchived",
};
const SUBMISSION_STATUS_KEY = {
  NotStarted: "assignOverview.subNotStarted", InProgress: "assignOverview.subInProgress",
  Graded: "assignOverview.subGraded", Submitted: "assignOverview.subSubmitted",
  UnderReview: "assignOverview.subUnderReview", Evaluated: "assignOverview.subEvaluated",
};
const assignmentStatusLabel = (t, s) => (ASSIGNMENT_STATUS_KEY[s] ? t(ASSIGNMENT_STATUS_KEY[s]) : s);
const submissionStatusLabel = (t, s) => (SUBMISSION_STATUS_KEY[s] ? t(SUBMISSION_STATUS_KEY[s]) : s);

export default function AssignmentsOverviewScreen() {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [selected, setSelected] = useState(null); // { lessonId, activityId, activityTitle }

  if (selected) {
    return (
      <AssignmentDetail
        lessonId={selected.lessonId} activityId={selected.activityId} activityTitle={selected.activityTitle}
        slug={slug} token={session.token} onBack={() => setSelected(null)}
      />
    );
  }
  return <OverviewTable slug={slug} token={session.token} onSelect={setSelected} t={t} />;
}

function OverviewTable({ slug, token, onSelect, t }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [removing, setRemoving] = useState(null); // the row being removed from learners

  const load = useCallback(() => (
    api.getAssignmentsOverview(token, slug)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
  ), [token, slug]);

  useEffect(() => {
    let cancelled = false;
    api.getAssignmentsOverview(token, slug)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token, slug]);

  const archivedCount = data ? data.rows.filter((r) => r.status === "Archived").length : 0;
  const rows = data ? data.rows.filter((r) => (r.status === "Archived") === showArchived) : [];

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("assignOverview.eyebrow")}</div>
      <h1>{t("assignOverview.title")}</h1>
      <p className="lw-sub">{t("assignOverview.lead")}</p>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {!data && !error && (
        <div className="lw-assign__loading"><LoaderCircle size={18} className="lw-assign__spin" /> {t("assignOverview.loading")}</div>
      )}

      {data && data.rows.length > 0 && (
        <div className="lw-assign__filter" role="group" aria-label={t("assignOverview.filterLabel")}>
          <button type="button" className={!showArchived ? "active" : ""} aria-pressed={!showArchived} onClick={() => setShowArchived(false)}>
            {t("assignOverview.filterCurrent")}
          </button>
          <button type="button" className={showArchived ? "active" : ""} aria-pressed={showArchived} onClick={() => setShowArchived(true)}>
            {t("assignOverview.filterArchived", { count: archivedCount })}
          </button>
        </div>
      )}

      {data && data.rows.length > 0 && rows.length === 0 && (
        <p className="muted">{showArchived ? t("assignOverview.noArchived") : t("assignOverview.noCurrent")}</p>
      )}

      {data && data.rows.length === 0 && (
        <Notice tone="empty" layout="row" icon={ClipboardCheck}>
          <p>{t("assignOverview.emptyLead")}</p>
        </Notice>
      )}

      {rows.length > 0 && (
        <div className="lw-assign__tablescroll">
        <table className="lw-assign__table">
          <thead>
            <tr>
              <th>{t("assignOverview.colProduct")}</th>
              <th>{t("assignOverview.colLesson")}</th>
              <th>{t("assignOverview.colActivity")}</th>
              <th>{t("assignOverview.colStatus")}</th>
              <th>{t("assignOverview.colDueAt")}</th>
              <th>{t("assignOverview.colRecipients")}</th>
              <th>{t("assignOverview.colSubmitted")}</th>
              <th><span className="lw-assign__srOnly">{t("assignOverview.colActions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.assignmentId} className="lw-assign__row"
                  onClick={() => onSelect({ lessonId: r.lessonId, activityId: r.learningActivityId, activityTitle: r.activityTitle })}>
                <td className="lw-assign__namecell">{r.productTitle}</td>
                <td className="lw-assign__namecell">{r.lessonTitle}</td>
                <td className="lw-assign__namecell">{r.activityTitle}<div className="lw-assign__submeta">{t(`studio.activityType.${r.activityType}`)}</div></td>
                <td className="lw-assign__nowrap"><span className={`lw-assign__pill is-${r.status.toLowerCase()}`}>{assignmentStatusLabel(t, r.status)}</span></td>
                <td className="lw-assign__nowrap">{r.dueAt ? formatDateActive(r.dueAt) : "—"}</td>
                <td className="lw-assign__nowrap">{r.recipientCount}</td>
                <td className="lw-assign__nowrap">{r.submittedCount}</td>
                <td className="lw-assign__nowrap">
                  {r.status !== "Archived" && (
                    <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs"
                            onClick={(e) => { e.stopPropagation(); setRemoving(r); }}>
                      <Archive size={12} /> {t("assignOverview.removeFromLearners")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {removing && (
        <RemoveFromLearnersDialog
          row={removing} slug={slug} token={token}
          onCancel={() => setRemoving(null)}
          onDone={() => {
            setSuccess(t("assignOverview.toastRemoved", { title: removing.activityTitle }));
            setRemoving(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/**
 * Confirms "Remove from learners" (archive) — an in-app dialog, not window.confirm(). The
 * assignment is closed if still open, then archived: learners stop seeing it, submissions stay.
 */
export function RemoveFromLearnersDialog({ row, slug, token, onCancel, onDone }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirm() {
    setBusy(true); setError(null);
    try {
      await api.assignmentTransition(token, slug, row.lessonId, row.learningActivityId, "archive");
      onDone();
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal onClose={busy ? () => {} : onCancel} closeLabel={t("studio.close")} panelClassName="lw-assign__confirm">
      <style>{MODAL_CSS}</style>
      <h2 className="lw-modal__title">{t("assignOverview.removeTitle", { title: row.activityTitle })}</h2>
      <p>{t("assignOverview.removeBody")}</p>
      {row.submittedCount > 0 && <p className="muted">{t("assignOverview.removeKeepsSubmissions", { count: row.submittedCount })}</p>}
      {error && <div className="lw-assign__inlineerror" role="alert">{error}</div>}
      <div className="lw-modal__actions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onCancel}>{t("studio.cancel")}</button>
        <button type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={confirm}>
          <Archive size={13} /> {t("assignOverview.removeConfirm")}
        </button>
      </div>
    </Modal>
  );
}

function AssignmentDetail({ lessonId, activityId, activityTitle, slug, token, onBack }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [evaluating, setEvaluating] = useState(null); // membershipId being evaluated
  const [removing, setRemoving] = useState(false);
  const [success, setSuccess] = useState(null);

  const load = useCallback(() => (
    api.getAssignmentSubmissions(token, slug, lessonId, activityId)
      .then((d) => { setData(d); setError(null); return d; })
      .catch((e) => { setError(e.message); return null; })
  ), [token, slug, lessonId, activityId]);

  useEffect(() => { load(); }, [load]);

  async function handleReset(membershipId) {
    try {
      await api.resetAssignmentAttempts(token, slug, lessonId, activityId, membershipId);
      await load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <button className="lw-assign__back" onClick={onBack}>
        <ArrowLeft size={13} /> {t("assignOverview.backToOverview")}
      </button>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}
      {!data && !error && (
        <div className="lw-assign__loading"><LoaderCircle size={18} className="lw-assign__spin" /> {t("assignOverview.loading")}</div>
      )}

      {data && <>
        <div className="lw-eyebrow">{activityTitle}</div>
        <h1>{t("assignOverview.submissionsTitle")}</h1>
        <p className="lw-assign__meta">
          <span className={`lw-assign__pill is-${data.assignment.status.toLowerCase()}`}>{assignmentStatusLabel(t, data.assignment.status)}</span>
          {" · "}{data.rows.length} {t("assignOverview.recipientsWord")}
          {data.assignment.status !== "Archived" && (
            <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs lw-assign__metaaction" onClick={() => setRemoving(true)}>
              <Archive size={12} /> {t("assignOverview.removeFromLearners")}
            </button>
          )}
        </p>
        {data.assignment.status === "Archived" && <p className="muted">{t("assignOverview.archivedNote")}</p>}

        {data.rows.length === 0 && <p className="muted">{t("assignOverview.noRecipients")}</p>}

        {data.rows.length > 0 && (
          <div className="lw-assign__tablescroll">
          <table className="lw-assign__table">
            <thead>
              <tr>
                <th>{t("assignOverview.colLearner")}</th>
                <th>{t("assignOverview.colSubmissionStatus")}</th>
                <th>{t("assignOverview.colAttempt")}</th>
                <th>{t("assignOverview.colResponse")}</th>
                <th>{t("assignOverview.colResult")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.membershipId}>
                  <td className="lw-assign__nowrap">{r.fullName}<div className="lw-assign__submeta">{r.email}</div></td>
                  <td className="lw-assign__nowrap"><span className={`lw-assign__pill is-${r.status.toLowerCase()}`}>{submissionStatusLabel(t, r.status)}</span></td>
                  <td className="lw-assign__nowrap">{r.attemptNumber || "—"}</td>
                  <td className="lw-assign__responsecell">
                    {r.responseText || (!r.responseLearningAssetId && "—")}
                    {r.responseLearningAssetId && (
                      <AssetLink token={token} slug={slug} assetId={r.responseLearningAssetId}
                         onClick={(e) => e.stopPropagation()} className="lw-assign__downloadlink">
                        <Paperclip size={12} /> {t("assignOverview.hasAttachment")}
                      </AssetLink>
                    )}
                  </td>
                  <td className="lw-assign__resultcell">
                    {r.status === "Evaluated" ? (
                      <>
                        <span className={`lw-assign__pill ${r.passed ? "is-published" : "is-failed"}`}>
                          {r.passed == null ? t("assignOverview.reviewed") : r.passed ? t("assignOverview.passed") : t("assignOverview.notPassed")}
                        </span>
                        {r.feedback && <div className="lw-assign__submeta">{r.feedback}</div>}
                      </>
                    ) : (r.status === "Submitted" || r.status === "UnderReview") ? (
                      <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={() => setEvaluating(r)}>
                        {t("assignOverview.evaluate")}
                      </button>
                    ) : "—"}
                  </td>
                  <td className="lw-assign__nowrap">
                    {r.submissionId && r.status !== "InProgress" && (
                      <button className="lw-btn lw-btn--ghost lw-btn--xs" onClick={() => handleReset(r.membershipId)} title={t("assignOverview.resetAttempts")}>
                        <RotateCcw size={12} /> {t("assignOverview.resetAttempts")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {removing && (
          <RemoveFromLearnersDialog
            row={{ lessonId, learningActivityId: activityId, activityTitle, submittedCount: data.rows.filter((r) => r.submissionId).length }}
            slug={slug} token={token}
            onCancel={() => setRemoving(false)}
            onDone={() => { setRemoving(false); setSuccess(t("assignOverview.toastRemoved", { title: activityTitle })); load(); }}
          />
        )}

        {evaluating && (
          <EvaluateForm
            row={evaluating} lessonId={lessonId} activityId={activityId} slug={slug} token={token}
            onDone={() => { setEvaluating(null); load(); }}
            onCancel={() => setEvaluating(null)}
          />
        )}
      </>}
    </div>
  );
}

function EvaluateForm({ row, lessonId, activityId, slug, token, onDone, onCancel }) {
  const { t } = useLanguage();
  const [passed, setPassed] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.evaluateAssignmentSubmission(token, slug, lessonId, activityId, row.submissionId, { passed, feedback: feedback.trim() || null });
      onDone();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="lw-assign__evalpanel">
      <h2 className="lw-sectiontitle">{t("assignOverview.evaluateTitle", { name: row.fullName })}</h2>
      {row.responseText && <p className="lw-assign__responsefull">{row.responseText}</p>}
      {error && <Message type="error">{error}</Message>}
      <form onSubmit={submit} className="lw-assign__evalform">
        <label className="lw-assign__passfail">
          <input type="radio" checked={passed === true} onChange={() => setPassed(true)} /> {t("assignOverview.passed")}
        </label>
        <label className="lw-assign__passfail">
          <input type="radio" checked={passed === false} onChange={() => setPassed(false)} /> {t("assignOverview.notPassed")}
        </label>
        <textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)}
                  placeholder={t("assignOverview.feedbackPlaceholder")} disabled={busy} />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="lw-btn lw-btn--primary lw-btn--sm" disabled={busy}>{t("assignOverview.submitEvaluation")}</button>
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onCancel}>{t("studio.cancel")}</button>
        </div>
      </form>
    </div>
  );
}

const CSS = `
  /* .lw-page is a flex item of .lw-shell (display:flex); without this, its
     default min-width:auto lets it grow to fit a wide table instead of
     letting .lw-assign__tablescroll's own overflow-x:auto do the scrolling.
     Scoped to this screen only — this <style> tag unmounts with it. */
  .lw-page { min-width: 0; }
  .muted { color: var(--ink-soft); font-size: 0.86rem; line-height: 1.55; }
  .lw-assign__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-assign__back {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--ink-soft);
    font-family: var(--font-body); font-size: 0.82rem; cursor: pointer; padding: 3px 6px; margin-bottom: 14px; margin-inline-start: -6px;
  }
  .lw-assign__back:hover { color: var(--ink); background: var(--surface-2, rgba(0,0,0,0.05)); }
  .lw-assign__spin { animation: lwAssignSpin 0.9s linear infinite; }
  @keyframes lwAssignSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-assign__spin { animation: none; } }

  .lw-assign__tablescroll { width: 100%; overflow-x: auto; border-radius: var(--radius-sm); }
  .lw-assign__table { width: 100%; min-width: 720px; border-collapse: collapse; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; font-size: 0.86rem; }
  .lw-assign__table th {
    text-align: start; font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--ink-soft); background: var(--surface-2); padding: 10px 14px; border-bottom: 1px solid var(--line);
  }
  .lw-assign__table td { padding: 11px 14px; border-bottom: 1px solid var(--line); color: var(--ink); vertical-align: top; }
  .lw-assign__table tbody tr:last-child td { border-bottom: none; }
  .lw-assign__row { cursor: pointer; transition: background .12s; }
  .lw-assign__row:hover { background: var(--surface-2); }
  .lw-assign__submeta { font-size: 0.78rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-assign__nowrap { white-space: nowrap; }
  /* Course, lesson and activity names wrap instead of each forcing one long line — kept on one
     line they made the list ~1150px wide, pushing Recipients and Submitted behind a scroll at 1280px. */
  .lw-assign__namecell { white-space: normal; min-width: 12ch; overflow-wrap: anywhere; }
  .lw-assign__responsecell { max-width: 28ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lw-assign__downloadlink { display: inline-flex; align-items: center; gap: 5px; color: var(--accent); }
  .lw-assign__resultcell { max-width: 22ch; white-space: normal; }

  .lw-assign__pill {
    display: inline-flex; align-items: center; font-family: var(--font-mono); font-size: 10px;
    border-radius: 20px; padding: 3px 9px; background: var(--surface-2); color: color-mix(in srgb, var(--ink-soft) 45%, var(--ink));
  }
  .lw-assign__pill.is-published, .lw-assign__pill.is-active, .lw-assign__pill.is-evaluated { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: color-mix(in srgb, var(--accent-2) 55%, var(--ink)); }
  .lw-assign__pill.is-failed, .lw-assign__pill.is-closed { background: color-mix(in srgb, var(--danger) 12%, transparent); color: color-mix(in srgb, var(--danger) 60%, var(--ink)); }

  .lw-assign__meta { color: var(--ink-soft); font-size: 0.85rem; margin: -6px 0 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
  .lw-assign__metaaction { margin-inline-start: auto; }
  .lw-assign__pill.is-archived { background: var(--surface-2); color: var(--ink-soft); }
  .lw-assign__filter { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; margin: 0 0 14px; }
  .lw-assign__filter button {
    background: transparent; border: none; padding: 6px 12px; font: inherit; font-size: 0.82rem; color: var(--ink-soft); cursor: pointer;
  }
  .lw-assign__filter button + button { border-inline-start: 1px solid var(--line); }
  .lw-assign__filter button.active { background: var(--surface-2); color: var(--ink); font-weight: 600; }
  .lw-assign__srOnly { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .lw-assign__inlineerror { color: var(--danger); font-size: 0.86rem; margin: 0 0 12px; }
  .lw-assign__confirm { max-width: 460px; }
  .lw-assign__confirm p { margin: 0 0 14px; line-height: 1.55; }

  .lw-assign__evalpanel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 16px; margin-top: 18px; }
  .lw-assign__responsefull { white-space: pre-wrap; background: var(--surface-2); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 0.86rem; }
  .lw-assign__evalform { display: flex; flex-direction: column; gap: 10px; }
  .lw-assign__passfail { display: inline-flex; align-items: center; gap: 6px; font-size: 0.86rem; margin-inline-end: 14px; }
  .lw-assign__evalform textarea { width: 100%; font-family: inherit; font-size: 0.86rem; }
`;
