import { useEffect, useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";

/* =========================================================================
   WORKSPACE SETTINGS — academy-wide switches.

   For now: email progress reports to parents (Parent Progress Reports
   Business Analysis §8). Two independent switches, both off by default — the
   academy decides. Only confirmed parents ever receive anything, whatever
   these say; parents are added per learner on the Members screen.
   ========================================================================= */

export default function WorkspaceSettingsScreen({ onOpenMembers }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [setup, setSetup] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getSetup(session.token, slug)
      .then((s) => { if (!cancelled) setSetup(s); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  async function save(next, toastKey) {
    setBusy(true); setError(null); setSuccess(null);
    try {
      setSetup(await api.setParentReports(session.token, slug, next));
      setSuccess(t(toastKey));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!setup) {
    return (
      <div className="lw-page">
        {error ? <Message type="error">{error}</Message>
          : <div className="lw-settings__loading"><LoaderCircle size={18} className="lw-settings__spin" /> {t("settings.loading")}</div>}
        <style>{CSS}</style>
      </div>
    );
  }

  const results = !!setup.emailParentsResults;
  const monthly = !!setup.emailParentsMonthlySummary;
  const canManage = setup.canManage;

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("settings.eyebrow")}</div>
      <h1>{t("settings.title")}</h1>
      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      <section className="lw-card lw-settings__card" aria-labelledby="parent-reports-title">
        <div className="lw-settings__head">
          <span className="lw-settings__icon" aria-hidden="true"><Mail size={18} /></span>
          <div>
            <h2 id="parent-reports-title" className="lw-settings__title">{t("settings.parentReportsTitle")}</h2>
            <p className="lw-settings__lead">{t("settings.parentReportsLead")}</p>
          </div>
        </div>

        <div className="lw-widgetrow">
          <div>
            <div className="lw-widgetrow__label" id="parent-results-label">{t("settings.parentResultsLabel")}</div>
            <div className="lw-widgetrow__consequence">{t("settings.parentResultsHint")}</div>
          </div>
          <button type="button" role="switch" aria-checked={results} aria-labelledby="parent-results-label"
                  className={`lw-toggle ${results ? "is-on" : ""}`} disabled={busy || !canManage}
                  onClick={() => save({ results: !results, monthlySummary: monthly }, results ? "settings.toastResultsOff" : "settings.toastResultsOn")}>
            <span />
          </button>
        </div>

        <div className="lw-widgetrow">
          <div>
            <div className="lw-widgetrow__label" id="parent-monthly-label">{t("settings.parentMonthlyLabel")}</div>
            <div className="lw-widgetrow__consequence">{t("settings.parentMonthlyHint")}</div>
          </div>
          <button type="button" role="switch" aria-checked={monthly} aria-labelledby="parent-monthly-label"
                  className={`lw-toggle ${monthly ? "is-on" : ""}`} disabled={busy || !canManage}
                  onClick={() => save({ results, monthlySummary: !monthly }, monthly ? "settings.toastMonthlyOff" : "settings.toastMonthlyOn")}>
            <span />
          </button>
        </div>

        <p className="lw-settings__note">
          {t("settings.parentReportsNote")}{" "}
          {onOpenMembers && (
            <button type="button" className="lw-settings__link" onClick={onOpenMembers}>{t("settings.parentReportsMembersLink")}</button>
          )}
        </p>
        {!canManage && <p className="lw-settings__note">{t("settings.viewOnly")}</p>}
      </section>
    </div>
  );
}

const CSS = `
  .lw-settings__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-settings__spin { animation: lwSettingsSpin 0.9s linear infinite; }
  @keyframes lwSettingsSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-settings__spin { animation: none; } }
  .lw-settings__card { max-width: 720px; margin: 8px auto 0; padding: 22px 24px; text-align: start; }
  .lw-settings__head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 8px; }
  .lw-settings__icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--surface-2); color: var(--ink); flex-shrink: 0; }
  .lw-settings__title { font-size: 1.1rem; margin: 0 0 4px; }
  .lw-settings__lead { margin: 0; color: var(--ink-soft); font-size: 0.9rem; line-height: 1.55; }
  .lw-settings__card .lw-widgetrow { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--line); }
  .lw-settings__note { margin: 14px 0 0; font-size: 0.84rem; color: var(--ink-soft); line-height: 1.55; }
  .lw-settings__link { background: none; border: none; padding: 0; font: inherit; color: var(--ink); font-weight: 600; text-decoration: underline; cursor: pointer; }
`;
