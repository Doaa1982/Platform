import { useEffect, useState } from "react";
import { LoaderCircle, ArrowLeft, Award, ClipboardCheck } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   ASSESSMENTS OVERVIEW — the tutor's gradebook: one row per lesson with a
   real Assessment on its current revision, workspace-wide, not just the one
   the tutor happens to have open in Content Studio. Everything shown here is
   aggregated from Submission/SubmissionAnswer, which every real learner
   attempt already writes — no new domain concept, just the first screen that
   surfaces it.

   Certificates deliberately isn't built yet (held off for now) — noted
   honestly at the bottom rather than silently absent, same pattern as
   StudioPanel's coming-soon tiles.
   ========================================================================= */

export default function AssessmentsOverviewScreen() {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [selectedId, setSelectedId] = useState(null);

  if (selectedId) {
    return (
      <AssessmentDetail
        assessmentId={selectedId} slug={slug} token={session.token}
        onBack={() => setSelectedId(null)}
      />
    );
  }
  return <OverviewTable slug={slug} token={session.token} onSelect={setSelectedId} t={t} />;
}

function OverviewTable({ slug, token, onSelect, t }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getAssessmentsOverview(token, slug)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token, slug]);

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("assessOverview.eyebrow")}</div>
      <h1>{t("assessOverview.title")}</h1>

      {error && <Message type="error">{error}</Message>}

      {!data && !error && (
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> {t("assessOverview.loading")}</div>
      )}

      {data && data.assessments.length === 0 && (
        <div className="lw-nby">
          <span className="lw-nby__icon" aria-hidden="true"><ClipboardCheck size={20} /></span>
          <div>
            <p className="lw-nby__lead">{t("assessOverview.emptyLead")}</p>
          </div>
        </div>
      )}

      {data && data.assessments.length > 0 && (
        <table className="lw-assess__table">
          <thead>
            <tr>
              <th>{t("assessOverview.colProduct")}</th>
              <th>{t("assessOverview.colLesson")}</th>
              <th>{t("assessOverview.colKind")}</th>
              <th>{t("assessOverview.colStatus")}</th>
              <th>{t("assessOverview.colQuestions")}</th>
              <th>{t("assessOverview.colSubmissions")}</th>
              <th>{t("assessOverview.colAvgScore")}</th>
              <th>{t("assessOverview.colPassRate")}</th>
            </tr>
          </thead>
          <tbody>
            {data.assessments.map((a) => (
              <tr key={a.assessmentId} className="lw-assess__row" onClick={() => onSelect(a.assessmentId)}>
                <td>{a.productTitle}</td>
                <td>{a.lessonTitle}</td>
                <td>{t(a.kind === "Standalone" ? "assessOverview.kindStandalone" : "assessOverview.kindInteractive")}</td>
                <td><span className={`lw-assess__pill ${a.status === "Published" ? "is-published" : ""}`}>{a.status}</span></td>
                <td>{a.questionCount}</td>
                <td>{a.submissionCount}</td>
                <td>{a.averageScorePercent != null ? `${a.averageScorePercent}%` : "—"}</td>
                <td>{a.passRatePercent != null ? `${a.passRatePercent}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="lw-assess__certnote">
        <Award size={15} />
        <span>{t("assessOverview.certificatesComingSoon")}</span>
      </div>
    </div>
  );
}

function AssessmentDetail({ assessmentId, slug, token, onBack }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getAssessmentDetail(token, slug, assessmentId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token, slug, assessmentId]);

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <button className="lw-learn__back" onClick={onBack}>
        <ArrowLeft size={13} /> {t("assessOverview.backToOverview")}
      </button>

      {error && <Message type="error">{error}</Message>}
      {!data && !error && (
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> {t("assessOverview.loading")}</div>
      )}

      {data && <>
        <div className="lw-eyebrow">{data.productTitle} · {data.lessonTitle}</div>
        <h1>{data.title}</h1>
        <p className="lw-assess__meta">
          {t("assessOverview.passingThreshold", { percent: data.passingThresholdPercent })} · {data.submissions.length} {t("assessOverview.submissionsWord")}
        </p>

        <h2 className="lw-assess__sectiontitle">{t("assessOverview.questionBreakdown")}</h2>
        {data.questions.length === 0 && <p className="muted">{t("assessOverview.noQuestions")}</p>}
        {data.questions.map((q) => (
          <div className="lw-assess__qcard" key={q.questionId}>
            <p className="lw-assess__qprompt">{q.prompt}</p>
            <p className="lw-assess__qmeta">
              {q.type} · {q.points} {t("assessOverview.pointsWord")} · {q.totalAnswered} {t("assessOverview.answeredWord")}
              {q.correctCount != null && q.totalAnswered > 0 &&
                ` · ${Math.round((q.correctCount / q.totalAnswered) * 100)}% ${t("assessOverview.correctWord")}`}
            </p>
            {q.optionCounts && q.totalAnswered > 0 && (
              <div className="lw-assess__bars">
                {q.optionCounts.map((count, i) => (
                  <div className="lw-assess__barrow" key={i}>
                    <span className="lw-assess__barlabel">{i + 1}</span>
                    <div className="lw-assess__bartrack">
                      <div className="lw-assess__barfill" style={{ width: `${(count / q.totalAnswered) * 100}%` }} />
                    </div>
                    <span className="lw-assess__barcount">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <h2 className="lw-assess__sectiontitle">{t("assessOverview.submitters")}</h2>
        {data.submissions.length === 0 && <p className="muted">{t("assessOverview.noSubmissions")}</p>}
        {data.submissions.length > 0 && (
          <table className="lw-assess__table">
            <thead>
              <tr>
                <th>{t("assessOverview.colLearner")}</th>
                <th>{t("assessOverview.colScore")}</th>
                <th>{t("assessOverview.colResult")}</th>
                <th>{t("assessOverview.colSubmittedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {data.submissions.map((s) => (
                <tr key={s.membershipId}>
                  <td>{s.learnerName}<div className="lw-assess__submeta">{s.learnerEmail}</div></td>
                  <td>{s.scorePercent}%</td>
                  <td><span className={`lw-assess__pill ${s.passed ? "is-published" : "is-failed"}`}>{s.passed ? t("assessOverview.passed") : t("assessOverview.notYetPassing")}</span></td>
                  <td>{new Date(s.submittedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>}
    </div>
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
  .lw-learn__spin { animation: lwLearnSpin 0.9s linear infinite; }
  @keyframes lwLearnSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-learn__spin { animation: none; } }

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
  .lw-nby__lead { font-size: 0.95rem; margin: 0; line-height: 1.6; }

  .lw-assess__table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; font-size: 0.86rem; }
  .lw-assess__table th {
    text-align: start; font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--ink-soft); background: var(--surface-2); padding: 10px 14px; border-bottom: 1px solid var(--line);
  }
  .lw-assess__table td { padding: 11px 14px; border-bottom: 1px solid var(--line); color: var(--ink); vertical-align: top; }
  .lw-assess__table tbody tr:last-child td { border-bottom: none; }
  .lw-assess__row { cursor: pointer; transition: background .12s; }
  .lw-assess__row:hover { background: var(--surface-2); }
  .lw-assess__submeta { font-size: 0.78rem; color: var(--ink-soft); margin-top: 2px; }

  .lw-assess__pill {
    display: inline-flex; align-items: center; font-family: var(--font-mono); font-size: 10px;
    border-radius: 20px; padding: 3px 9px; background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-assess__pill.is-published { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2); }
  .lw-assess__pill.is-failed { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }

  .lw-assess__meta { color: var(--ink-soft); font-size: 0.85rem; margin: -6px 0 20px; }
  .lw-assess__sectiontitle { font-size: 1rem; margin: 26px 0 12px; }

  .lw-assess__qcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 10px; }
  .lw-assess__qprompt { font-size: 0.9rem; font-weight: 600; margin: 0 0 6px; }
  .lw-assess__qmeta { font-size: 0.8rem; color: var(--ink-soft); margin: 0 0 10px; }
  .lw-assess__bars { display: grid; gap: 6px; }
  .lw-assess__barrow { display: flex; align-items: center; gap: 8px; }
  .lw-assess__barlabel { font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-soft); width: 14px; }
  .lw-assess__bartrack { flex: 1; height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
  .lw-assess__barfill { height: 100%; background: var(--accent); border-radius: 4px; }
  .lw-assess__barcount { font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-soft); width: 20px; text-align: end; }

  .lw-assess__certnote {
    display: flex; align-items: center; gap: 8px; margin-top: 26px; padding: 12px 14px;
    border: 1px dashed var(--line); border-radius: var(--radius-sm); color: var(--ink-soft); font-size: 0.83rem; max-width: 62ch;
  }
`;
