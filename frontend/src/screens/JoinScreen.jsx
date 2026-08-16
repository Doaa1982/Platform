import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, CheckCircle2, ArrowRight, Building2, Clock } from "lucide-react";
import * as api from "../api/client";
import { useFonts } from "../hooks/useFonts";
import RequiredMark, { invalidFieldStyle } from "../components/RequiredMark";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import Message from "../components/Message";

/* =========================================================================
   JOIN SCREEN — /join/{slug}

   Reached only through a link the Workspace shared itself. The platform never
   helps anyone find this page: there is no directory, search or browse, by
   permanent decision (Join Request BA-007, ADR-EA-002) — providing discovery
   would put the platform in competition with its own paying customers for
   their students' attention.

   Anonymous, and account-free (§11): submitting files a name, email and
   message for the Workspace to decide on — nothing is created here. If they
   approve, a real Invitation goes to that email, and accepting *that* is
   where an account first comes into existence — same as anyone invited
   outright. That is also why the endpoint behind this form carries a rate
   limit: it is reachable by anyone, with no account standing behind it.
   ========================================================================= */

export default function JoinScreen({ slug, onSignIn }) {
  useFonts();
  const { t } = useLanguage();

  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.previewJoin(slug)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((e) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
  }, [slug]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    if (!fullName.trim() || !email.trim()) {
      setAttempted(true);
      setError(t("join.errBothRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.submitJoin(slug, {
        fullName: fullName.trim(),
        email: email.trim(),
        message: message.trim() || null,
      });
      setDone(true);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <div className="pl-join__card pl-join__card--bad">
          <AlertCircle size={26} aria-hidden="true" />
          <h1>{t("join.linkBadTitle")}</h1>
          <p>{loadError}</p>
          <p className="pl-join__muted">{t("join.linkBadHint")}</p>
        </div>
      </Shell>
    );
  }

  if (!preview) {
    return (
      <Shell>
        <div className="pl-join__card">
          <LoaderCircle size={22} className="pl-join__spin" aria-hidden="true" />
          <p className="pl-join__muted">{t("join.loading")}</p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="pl-join__card pl-join__card--good">
          <CheckCircle2 size={26} aria-hidden="true" />
          <h1>{t("join.requestSentTitle")}</h1>
          <p>{t("join.requestSentBody", { workspace: preview.workspaceName, email: email.trim() })}</p>
          <button className="pl-join__ghost" onClick={onSignIn}>{t("join.signIn")}</button>
        </div>
      </Shell>
    );
  }

  // BA-005: accepting requests is off by default. A workspace that hasn't
  // opted in is a normal, expected state — not an error.
  if (!preview.acceptingRequests) {
    return (
      <Shell>
        <div className="pl-join__card">
          <div className="pl-join__mark" aria-hidden="true"><Building2 size={22} /></div>
          <h1>{preview.workspaceName}</h1>
          <p className="pl-join__lead">{t("join.notAcceptingLead")}</p>
          <p className="pl-join__muted">{t("join.notAcceptingHint")}</p>
          <button className="pl-join__ghost" onClick={onSignIn}>{t("join.signIn")}</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="pl-join__card">
        <div className="pl-join__mark" aria-hidden="true"><Building2 size={22} /></div>
        <div className="pl-join__eyebrow">{t("join.eyebrow")}</div>
        <h1>{preview.workspaceName}</h1>
        {preview.description && <p className="pl-join__lead">{preview.description}</p>}

        <form className="pl-join__form" onSubmit={handleSubmit} noValidate>
          {error && <Message type="error">{error}</Message>}

          <label className="pl-join__field">
            <span>{t("join.nameLabel")}<RequiredMark /></span>
            <input type="text" autoComplete="name" required autoFocus
                   value={fullName} onChange={(e) => { setFullName(e.target.value); setError(null); }}
                   placeholder={t("join.namePlaceholder")} disabled={submitting}
                   style={attempted && !fullName.trim() ? invalidFieldStyle : undefined} />
          </label>

          <label className="pl-join__field">
            <span>{t("join.emailLabel")}<RequiredMark /></span>
            <input type="email" autoComplete="email" required
                   value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                   placeholder={t("join.emailPlaceholder")} disabled={submitting}
                   style={attempted && !email.trim() ? invalidFieldStyle : undefined} />
          </label>

          <label className="pl-join__field">
            <span>{t("join.messageLabel")}</span>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("join.messagePlaceholder")} disabled={submitting} />
          </label>

          <button type="submit" className="pl-join__btn" disabled={submitting}>
            {submitting
              ? (<><LoaderCircle size={16} className="pl-join__spin" aria-hidden="true" /> {t("join.sending")}</>)
              : (<>{t("join.sendRequest")} <ArrowRight size={16} aria-hidden="true" /></>)}
          </button>
        </form>

        <p className="pl-join__muted">
          <Clock size={13} aria-hidden="true" /> {t("join.footerNote")}
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="pl-join">
      <style>{CSS}</style>
      <div className="pl-join__langtoggle"><LanguageToggle /></div>
      {children}
    </div>
  );
}

const CSS = `
  /* Notebook theme (2026-08-15): Tutor "leather ledger" palette, light
     variant — matches TUTOR_LIGHT in App.jsx. Applied here rather than a
     Student flavor because joining is a workspace/owner-facing process.
     --accent is TUTOR_LIGHT's primary --accent (maroon), not accent-2 gold:
     a WCAG pass (2026-08-15) found gold only cleared 3.32:1 as text on this
     cream bg (needs 4.5:1) — maroon clears 8.54:1. */
  .pl-join {
    --ink: #241A10; --ink-soft: #6E5C43; --line: #D8C9A3; --accent: #7A2E2E;
    font-family: 'Lora', Georgia, serif; color: var(--ink);
    background: #F3ECD8; min-height: 100vh; position: relative;
    display: flex; align-items: center; justify-content: center; padding: 40px 22px;
    background-image: repeating-linear-gradient(to bottom, transparent 0 34px, rgba(122,46,46,0.07) 34px 35px);
  }
  .pl-join *, .pl-join *::before, .pl-join *::after { box-sizing: border-box; }
  .pl-join__langtoggle { position: absolute; top: 20px; inset-inline-end: 20px; }

  .pl-join__card {
    width: 100%; max-width: 460px; background: #FBF7EA;
    border: 1px solid var(--line); border-radius: 16px; padding: 34px 30px; text-align: center;
    position: relative;
  }
  .pl-join__card::after {
    content: ""; position: absolute; top: 0; inset-inline-end: 0; width: 0; height: 0;
    border-style: solid; border-width: 0 14px 14px 0;
    border-color: transparent #EFE4C6 transparent transparent;
    filter: drop-shadow(-1px 1px 1.5px rgba(0,0,0,0.18));
    pointer-events: none;
  }
  [dir="rtl"] .pl-join__card::after { transform: scaleX(-1); }
  .pl-join__card--bad { border-color: rgba(179,56,43,0.3); color: #B3382B; }
  .pl-join__card--good { border-color: rgba(122,143,92,0.4); color: #5C7A3D; }
  .pl-join__card--bad h1, .pl-join__card--good h1 { color: inherit; }

  .pl-join__mark {
    width: 48px; height: 48px; border-radius: 13px; margin: 0 auto 14px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #F3ECD8;
  }
  .pl-join__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px;
  }
  /* Kept off the script font deliberately — this h1 renders the Workspace's
     own name, arbitrary length and sometimes non-Latin script, not fixed
     display copy, so it stays in the legible serif (same reasoning as the
     sidebar workspace name fix in App.jsx). */
  .pl-join h1 { font-family: 'Fraunces', Georgia, serif; font-size: 1.7rem; font-weight: 600; margin: 0 0 6px; line-height: 1.15; }
  .pl-join__lead { color: var(--ink-soft); font-size: 0.92rem; line-height: 1.6; margin: 0 0 22px; }

  /* UIC-003: one property per row — label left, value right. The card
     around this form is text-align: center (for its centered header); this
     grid overrides back to left, same override .pl-join__field always did. */
  .pl-join__form { display: grid; grid-template-columns: max-content 1fr; row-gap: 16px; column-gap: 14px; align-items: start; text-align: start; }
  .pl-join__form > .pl-join__field { display: contents; }
  .pl-join__field > span:first-child { font-size: 0.82rem; font-weight: 600; padding-top: 11px; white-space: nowrap; }
  .pl-join__field em { font-style: normal; font-weight: 400; color: var(--ink-soft); }
  .pl-join__field input, .pl-join__field textarea {
    width: 100%; font-family: inherit; font-size: 0.95rem; color: var(--ink);
    background: #FBF7EA; border: 1px solid var(--line); border-radius: 10px;
    padding: 11px 13px; resize: vertical;
  }
  .pl-join__form > .pl-join__btn { grid-column: 1 / -1; }
  @media (max-width: 480px) {
    .pl-join__form { grid-template-columns: 1fr; }
    .pl-join__form > .pl-join__field { display: flex; flex-direction: column; gap: 6px; }
    .pl-join__field > span:first-child { padding-top: 0; white-space: normal; }
  }
  .pl-join__field input:focus-visible, .pl-join__field textarea:focus-visible {
    outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(169,119,47,0.18);
  }

  .pl-join__btn {
    width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.95rem; font-weight: 600;
    color: #F3ECD8; background: var(--accent); border: none; border-radius: 10px;
    padding: 12px 16px; cursor: pointer; margin-top: 4px;
  }
  .pl-join__btn:hover:not(:disabled) { filter: brightness(0.92); }
  .pl-join__btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .pl-join__ghost {
    font-family: inherit; font-size: 0.88rem; font-weight: 600;
    color: var(--accent); background: transparent;
    border: 1px solid var(--line); border-radius: 9px; padding: 9px 18px; cursor: pointer; margin-top: 6px;
  }
  .pl-join__ghost:hover { border-color: var(--accent); }


  .pl-join__muted {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    font-size: 0.79rem; color: var(--ink-soft); margin: 18px 0 0; line-height: 1.55;
  }

  .pl-join__spin { animation: plJoinSpin 0.9s linear infinite; }
  @keyframes plJoinSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pl-join__spin { animation: none; } }

  ${LANGUAGE_TOGGLE_CSS}
`;
