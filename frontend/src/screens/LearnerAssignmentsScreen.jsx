import { useEffect, useState } from "react";
import { LoaderCircle, ListChecks, Lock, CheckCircle2, ArrowRight } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   ASSIGNMENTS (Learner) — every Assignment targeting this learner, across
   every course they're enrolled in, grouped by product. LearnerStatus
   (Locked/Available/InProgress/Submitted/UnderReview/Completed/Overdue) is
   computed server-side (Assignment Business Analysis §11) — never stored,
   so it's always current the moment this loads.
   ========================================================================= */

export default function LearnerAssignmentsScreen({ onOpenAssignment }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getMyAssignments(session.token, slug)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  const groups = data ? groupByProduct(data.rows) : [];

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("learnerAssignments.eyebrow")}</div>
      <h1>{t("learnerAssignments.title")}</h1>

      {error && <Message type="error">{error}</Message>}

      {!data && !error && (
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> {t("learnerAssignments.loading")}</div>
      )}

      {data && groups.length === 0 && (
        <div className="lw-nby">
          <span className="lw-nby__icon" aria-hidden="true"><ListChecks size={20} /></span>
          <div><p className="lw-nby__lead">{t("learnerAssignments.emptyLead")}</p></div>
        </div>
      )}

      {groups.map((g) => (
        <div className="lw-lassign__group" key={g.productId}>
          <div className="lw-lassign__grouptitle">{g.productTitle}</div>
          {g.rows.map((r) => {
            const locked = r.learnerStatus === "Locked";
            return (
              <button
                type="button" key={r.assignmentId}
                className="lw-lassign__row" disabled={locked}
                onClick={() => !locked && onOpenAssignment(r.lessonId, r.learningActivityId)}
              >
                <div className="lw-lassign__rowmain">
                  <span className="lw-lassign__rowtitle">{r.activityTitle}</span>
                  <span className="lw-lassign__lesson">{r.lessonTitle}</span>
                  <StatusPill status={r.learnerStatus} t={t} />
                  {r.dueAt && r.learnerStatus !== "Completed" && (
                    <span className="lw-lassign__due">{t("learnerAssignments.dueLabel", { date: new Date(r.dueAt).toLocaleDateString() })}</span>
                  )}
                </div>
                {!locked && <ArrowRight size={14} className="lw-lassign__rowarrow" />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status, t }) {
  if (status === "Locked") return <span className="lw-lassign__pill"><Lock size={11} /> {t("learnerAssignments.statusLocked")}</span>;
  if (status === "Completed") return <span className="lw-lassign__pill is-passed"><CheckCircle2 size={11} /> {t("learnerAssignments.statusCompleted")}</span>;
  if (status === "Overdue") return <span className="lw-lassign__pill is-failed">{t("learnerAssignments.statusOverdue")}</span>;
  const key = { Available: "statusAvailable", InProgress: "statusInProgress", Submitted: "statusSubmitted", UnderReview: "statusUnderReview" }[status];
  return <span className="lw-lassign__pill is-pending">{t(`learnerAssignments.${key ?? "statusAvailable"}`)}</span>;
}

function groupByProduct(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.productId)) map.set(r.productId, { productId: r.productId, productTitle: r.productTitle, rows: [] });
    map.get(r.productId).rows.push(r);
  }
  return [...map.values()];
}

const CSS = `
  .lw-learn__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-learn__spin { animation: lwLearnSpin 0.9s linear infinite; }
  @keyframes lwLearnSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-learn__spin { animation: none; } }

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

  .lw-lassign__group { margin-bottom: 30px; }
  .lw-lassign__grouptitle {
    font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--ink-soft); margin-bottom: 12px;
  }
  .lw-lassign__row {
    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 16px 20px; margin-bottom: 10px; cursor: pointer; text-align: start;
    font-family: var(--font-body); color: var(--ink); box-shadow: 0 2px 6px rgba(0,0,0,0.02);
    transition: all 0.18s ease;
  }
  .lw-lassign__row:hover:not(:disabled) {
    border-color: var(--accent); transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.05);
  }
  .lw-lassign__row:disabled { cursor: default; opacity: 0.7; }
  .lw-lassign__rowmain { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .lw-lassign__rowtitle { font-size: 0.95rem; font-weight: 600; }
  .lw-lassign__lesson {
    font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--ink-soft); background: var(--surface-2); padding: 2px 8px; border-radius: 6px;
  }
  .lw-lassign__due {
    font-size: 0.82rem; color: var(--ink-soft); background: color-mix(in srgb, var(--surface-2) 60%, transparent);
    padding: 2px 8px; border-radius: 6px;
  }
  .lw-lassign__rowarrow { color: var(--ink-soft); flex-shrink: 0; transition: transform 0.15s ease; }
  .lw-lassign__row:hover:not(:disabled) .lw-lassign__rowarrow { transform: translateX(3px); color: var(--accent); }

  .lw-lassign__pill {
    display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 11px; font-weight: 600;
    border-radius: 20px; padding: 4px 11px; background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-lassign__pill.is-pending { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .lw-lassign__pill.is-passed { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2); }
  .lw-lassign__pill.is-failed { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
`;
