import { useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, CheckCircle2, Copy, Check } from "lucide-react";
import * as api from "../api/client";
import InfoTip from "../components/InfoTip";
import RequiredMark from "../components/RequiredMark";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryField } from "../components/EntryShell";
import { apiErrorMessage } from "../i18n/apiErrors";

/* =========================================================================
   APPLY — /apply

   The destination of the landing page's single call to action
   (ADR-EA-002), and the start of Platform Administrator Business Analysis
   §7.1: apply first, be reviewed, and only then pay. Nobody pays to be
   considered.

   Entirely anonymous. An applicant has no Identity at this stage and gets one
   only much later, when they accept the invitation to the workspace
   provisioned for them. So the confirmation hands them a Signup Status Link
   instead of a login — it is the only way back to their application (BA-008).
   ========================================================================= */

export default function ApplyScreen({ onBack, onSignIn, onStatus }) {
  const { t } = useLanguage();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [about, setAbout] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    if (!fullName.trim() || !email.trim()) {
      setAttempted(true);
      setError(t("apply.errBothRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      setResult(await api.submitSignup({
        fullName: fullName.trim(),
        email: email.trim(),
        about: about.trim() || null,
      }));
    } catch (e) {
      setError(apiErrorMessage(t, e, { 400: "apply.errBothRequired", 409: "apply.errAlreadyApplied" }));
      setSubmitting(false);
    }
  }

  if (result) {
    const absolute = `${window.location.origin}${result.statusLink}`;
    return (
      <EntryShell>
        <EntryCard icon={CheckCircle2} tone="good" title={t("apply.resultTitle")} lead={t("apply.resultLead")}>
          {/* No account exists yet, so this link is the only way back in */}
          <p className="lw-entry__note">{result.delivered ? t("apply.linkEmailed") : t("apply.linkSaveOnly")}</p>
          <code className="lw-entry__code" dir="ltr">{absolute}</code>
          <div className="lw-entry__actions">
            <button
              type="button" className="lw-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(absolute);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch { setCopied(false); }
              }}
            >
              {copied ? <><Check size={14} /> {t("apply.copied")}</> : <><Copy size={14} /> {t("apply.copyLink")}</>}
            </button>
            <button type="button" className="lw-btn lw-btn--accent" onClick={() => onStatus(result.statusLink)}>
              {t("apply.checkStatus")} <ArrowRight size={14} className="lw-flip" aria-hidden="true" />
            </button>
          </div>
        </EntryCard>
      </EntryShell>
    );
  }

  return (
    <EntryShell>
      <EntryCard eyebrow={t("apply.eyebrow")} title={t("apply.title")} lead={t("apply.lead")}>
        <form className="lw-entry__form" onSubmit={handleSubmit} noValidate>
          {error && <div className="lw-entry__alert lw-entry__alert--bad" role="alert">{error}</div>}

          <EntryField label={<>{t("apply.nameLabel")}<RequiredMark /></>}>
            <input type="text" autoComplete="name" required autoFocus dir="auto"
                   value={fullName} onChange={(e) => { setFullName(e.target.value); setError(null); }}
                   placeholder={t("apply.namePlaceholder")} disabled={submitting}
                   aria-invalid={attempted && !fullName.trim() ? "true" : undefined} />
          </EntryField>

          <EntryField label={<>{t("apply.emailLabel")}<RequiredMark /> <InfoTip text={t("apply.emailInfoTip")} /></>}>
            <input type="email" autoComplete="email" required dir="auto"
                   value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                   placeholder={t("apply.emailPlaceholder")} disabled={submitting}
                   aria-invalid={attempted && !email.trim() ? "true" : undefined} />
          </EntryField>

          <EntryField label={t("apply.teachLabel")}>
            <textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} dir="auto"
                      placeholder={t("apply.teachPlaceholder")} disabled={submitting} />
          </EntryField>

          <button type="submit" className="lw-btn lw-btn--accent" disabled={submitting}>
            {submitting
              ? (<><LoaderCircle size={16} className="lw-entry__spin" aria-hidden="true" /> {t("apply.sending")}</>)
              : (<>{t("apply.sendApplication")} <ArrowRight size={16} className="lw-flip" aria-hidden="true" /></>)}
          </button>
        </form>

        <div className="lw-entry__steps">
          <h2>{t("apply.howTitle")}</h2>
          <ol>
            <li>{t("apply.step1")}</li>
            <li>{t("apply.step2")}</li>
            <li>{t("apply.step3")}</li>
            <li>{t("apply.step4")}</li>
          </ol>
        </div>

        <div className="lw-entry__actions">
          <button type="button" className="lw-btn" onClick={onSignIn}>{t("apply.alreadyHaveAccount")}</button>
          <button type="button" className="lw-entry__link" onClick={onBack}>
            <ArrowLeft size={13} className="lw-flip" aria-hidden="true" /> {t("apply.back")}
          </button>
        </div>
      </EntryCard>
    </EntryShell>
  );
}
