import { useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, AlertCircle, CheckCircle2, Copy, Check } from "lucide-react";
import * as api from "../api/client";
import { useFonts } from "../hooks/useFonts";
import InfoTip from "../components/InfoTip";
import RequiredMark, { invalidFieldStyle } from "../components/RequiredMark";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";

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
  useFonts();
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
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (result) {
    const absolute = `${window.location.origin}${result.statusLink}`;
    return (
      <Shell>
        <div className="pl-apply__card">
          <div className="pl-apply__mark is-good" aria-hidden="true"><CheckCircle2 size={22} /></div>
          <h1>{t("apply.resultTitle")}</h1>
          <p className="pl-apply__lead">{t("apply.resultLead")}</p>

          {/* No account exists yet, so this link is the only way back in */}
          <div className="pl-apply__linkbox">
            <span className="pl-apply__linklabel">
              {result.delivered ? t("apply.linkEmailed") : t("apply.linkSaveOnly")}
            </span>
            <code>{absolute}</code>
            <div className="pl-apply__linkactions">
              <button
                className="pl-apply__ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(absolute);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch { setCopied(false); }
                }}
              >
                {copied ? <><Check size={13} /> {t("apply.copied")}</> : <><Copy size={13} /> {t("apply.copyLink")}</>}
              </button>
              <button className="pl-apply__primary" onClick={() => onStatus(result.statusLink)}>
                {t("apply.checkStatus")} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="pl-apply__card">
        <button type="button" className="pl-apply__back" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" /> {t("apply.back")}
        </button>

        <div className="pl-apply__eyebrow">{t("apply.eyebrow")}</div>
        <h1>{t("apply.title")}</h1>
        <p className="pl-apply__lead">{t("apply.lead")}</p>

        <form className="pl-apply__form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="pl-apply__alert" role="alert">
              <AlertCircle size={16} aria-hidden="true" /> <span>{error}</span>
            </div>
          )}

          <label className="pl-apply__field">
            <span>{t("apply.nameLabel")}<RequiredMark /></span>
            <input type="text" autoComplete="name" required autoFocus
                   value={fullName} onChange={(e) => { setFullName(e.target.value); setError(null); }}
                   placeholder={t("apply.namePlaceholder")} disabled={submitting}
                   style={attempted && !fullName.trim() ? invalidFieldStyle : undefined} />
          </label>

          <label className="pl-apply__field">
            <span>{t("apply.emailLabel")}<RequiredMark /> <InfoTip text={t("apply.emailInfoTip")} /></span>
            <input type="email" autoComplete="email" required
                   value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                   placeholder={t("apply.emailPlaceholder")} disabled={submitting}
                   style={attempted && !email.trim() ? invalidFieldStyle : undefined} />
          </label>

          <label className="pl-apply__field">
            <span>{t("apply.teachLabel")}</span>
            <textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)}
                      placeholder={t("apply.teachPlaceholder")}
                      disabled={submitting} />
          </label>

          <button type="submit" className="pl-apply__primary is-full" disabled={submitting}>
            {submitting
              ? (<><LoaderCircle size={16} className="pl-apply__spin" aria-hidden="true" /> {t("apply.sending")}</>)
              : (<>{t("apply.sendApplication")} <ArrowRight size={16} aria-hidden="true" /></>)}
          </button>
        </form>

        <div className="pl-apply__how">
          <h2>{t("apply.howTitle")}</h2>
          <ol>
            <li>{t("apply.step1")}</li>
            <li>{t("apply.step2")}</li>
            <li>{t("apply.step3")}</li>
            <li>{t("apply.step4")}</li>
          </ol>
        </div>

        <button className="pl-apply__ghost is-full" onClick={onSignIn}>
          {t("apply.alreadyHaveAccount")}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="pl-apply">
      <style>{CSS}</style>
      <div className="pl-apply__langtoggle"><LanguageToggle /></div>
      {children}
    </div>
  );
}

const CSS = `
  .pl-apply {
    --ink: #F2F5FA; --ink-soft: #98A2B5; --accent: #5B8DEF;
    font-family: 'Karla', system-ui, sans-serif; color: var(--ink);
    background: #0B0F16; min-height: 100vh; position: relative;
    display: flex; align-items: center; justify-content: center; padding: 40px 22px;
  }
  .pl-apply *, .pl-apply *::before, .pl-apply *::after { box-sizing: border-box; }
  .pl-apply__langtoggle { position: absolute; top: 20px; inset-inline-end: 20px; }

  .pl-apply__card {
    width: 100%; max-width: 480px;
    background: #12171F; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px; padding: 32px 30px;
  }
  .pl-apply__back {
    display: inline-flex; align-items: center; gap: 5px; background: transparent;
    border: none; padding: 0; margin-bottom: 20px; font-family: inherit;
    font-size: 0.82rem; color: var(--ink-soft); cursor: pointer;
  }
  .pl-apply__back:hover { color: var(--ink); }

  .pl-apply__mark {
    width: 46px; height: 46px; border-radius: 12px; margin-bottom: 16px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(91,141,239,0.16); color: var(--accent);
  }
  .pl-apply__mark.is-good { background: rgba(127,211,184,0.16); color: #7FD3B8; }

  /* UIC-004: the page's own header (eyebrow + h1) is centered; the lead
     paragraph and everything below stays left-aligned, as body copy. */
  .pl-apply__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px;
    text-align: center;
  }
  .pl-apply h1 { font-family: 'Fraunces', Georgia, serif; font-size: 1.5rem; font-weight: 600; margin: 0 0 10px; text-align: center; }
  .pl-apply__lead { color: var(--ink-soft); font-size: 0.9rem; line-height: 1.65; margin: 0 0 24px; }

  /* UIC-003: one property per row — label left, value right. */
  .pl-apply__form { display: grid; grid-template-columns: max-content 1fr; row-gap: 16px; column-gap: 14px; align-items: start; }
  .pl-apply__form > .pl-apply__field { display: contents; }
  .pl-apply__field > span:first-child { font-size: 0.8rem; font-weight: 600; padding-top: 11px; white-space: nowrap; }
  .pl-apply__field em { font-style: normal; font-weight: 400; color: var(--ink-soft); }
  .pl-apply__field input, .pl-apply__field textarea {
    width: 100%; font-family: inherit; font-size: 0.93rem; color: var(--ink);
    background: #0F1319; border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px; padding: 11px 13px; resize: vertical;
  }
  .pl-apply__form > .pl-apply__alert, .pl-apply__form > .pl-apply__primary { grid-column: 1 / -1; }
  @media (max-width: 480px) {
    .pl-apply__form { grid-template-columns: 1fr; }
    .pl-apply__form > .pl-apply__field { display: flex; flex-direction: column; gap: 6px; }
    .pl-apply__field > span:first-child { padding-top: 0; white-space: normal; }
  }
  .pl-apply__field input:focus-visible, .pl-apply__field textarea:focus-visible {
    outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(91,141,239,0.2);
  }

  .pl-apply__primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.93rem; font-weight: 600;
    color: #08111F; background: linear-gradient(100deg, #7FB0FF, #5B8DEF);
    border: none; border-radius: 10px; padding: 11px 18px; cursor: pointer;
  }
  .pl-apply__primary.is-full { width: 100%; margin-top: 4px; }
  .pl-apply__primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .pl-apply__ghost {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    font-family: inherit; font-size: 0.86rem; font-weight: 600;
    color: var(--ink); background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.14); border-radius: 10px;
    padding: 10px 16px; cursor: pointer;
  }
  .pl-apply__ghost.is-full { width: 100%; margin-top: 18px; }
  .pl-apply__ghost:hover { background: rgba(255,255,255,0.11); }

  .pl-apply__how {
    background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 11px; padding: 16px 20px; margin-top: 24px;
  }
  .pl-apply__how h2 {
    font-family: 'IBM Plex Mono', monospace; font-size: 10.5px;
    letter-spacing: 0.09em; text-transform: uppercase; font-weight: 500;
    color: var(--ink-soft); margin: 0 0 10px;
  }
  .pl-apply__how ol { margin: 0; padding-inline-start: 18px; color: var(--ink-soft); font-size: 0.85rem; line-height: 1.7; }
  .pl-apply__how li::marker { color: var(--accent); }

  .pl-apply__linkbox {
    background: rgba(91,141,239,0.08); border: 1px solid rgba(91,141,239,0.3);
    border-radius: 11px; padding: 16px; margin-top: 4px;
  }
  .pl-apply__linklabel { display: block; font-size: 0.83rem; color: var(--ink-soft); margin-bottom: 10px; line-height: 1.55; }
  .pl-apply__linkbox code {
    display: block; font-family: 'IBM Plex Mono', monospace; font-size: 0.74rem;
    background: #0F1319; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px; padding: 9px 11px; word-break: break-all; color: var(--accent);
  }
  .pl-apply__linkactions { display: flex; gap: 8px; margin-top: 12px; }
  .pl-apply__linkactions button { flex: 1; }

  .pl-apply__alert {
    display: flex; align-items: flex-start; gap: 9px;
    background: rgba(224,97,90,0.12); border: 1px solid rgba(224,97,90,0.4);
    color: #E0615A; border-radius: 10px; padding: 10px 12px; margin-bottom: 16px; font-size: 0.86rem;
  }
  .pl-apply__alert svg { flex-shrink: 0; margin-top: 1px; }

  .pl-apply__spin { animation: plApplySpin 0.9s linear infinite; }
  @keyframes plApplySpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pl-apply__spin { animation: none; } }

  ${LANGUAGE_TOGGLE_CSS}
`;
