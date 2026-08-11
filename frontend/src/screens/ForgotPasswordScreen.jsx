import { useState } from "react";
import { KeyRound, ArrowLeft, LoaderCircle, MailCheck } from "lucide-react";
import * as api from "../api/client";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import Message from "../components/Message";

/* =========================================================================
   FORGOT PASSWORD SCREEN — /forgot-password/{side}

   Anonymous by necessity: someone locked out has no session to authenticate
   with. The `side` segment carries no authority — it only remembers which
   sign-in screen to return to — so it is never sent to the API.

   The response is identical whether or not the email belongs to an account
   (PasswordResetService.RequestAsync). This screen deliberately cannot show
   anything that would let a visitor tell the two cases apart: one success
   state, always, after a valid-looking submission.
   ========================================================================= */

export default function ForgotPasswordScreen({ side, onBack }) {
  useFonts();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim() && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      // A network/server failure is the only thing worth surfacing here —
      // "no such account" is never a possible error to show (see remarks above).
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <div className="pl-fpw__card">
        <div className="pl-fpw__mark" aria-hidden="true"><KeyRound size={22} /></div>

        {sent ? (
          <>
            <MailCheck size={26} className="pl-fpw__sentIcon" aria-hidden="true" />
            <h1>{t("forgotPassword.sentTitle")}</h1>
            <p className="pl-fpw__lead">{t("forgotPassword.sentBody", { email: email.trim() })}</p>
            <button type="button" className="pl-fpw__link" onClick={onBack}>
              <ArrowLeft size={14} aria-hidden="true" /> {t("forgotPassword.backToSignIn")}
            </button>
          </>
        ) : (
          <>
            <div className="pl-fpw__eyebrow">{t("forgotPassword.eyebrow")}</div>
            <h1>{t("forgotPassword.title")}</h1>
            <p className="pl-fpw__lead">{t("forgotPassword.lead")}</p>

            <form onSubmit={handleSubmit} noValidate>
              {error && <Message type="error">{error}</Message>}

              <label className="pl-fpw__field">
                <span>{t("forgotPassword.emailLabel")}</span>
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("forgotPassword.emailPlaceholder")}
                  disabled={submitting}
                />
              </label>

              <button type="submit" className="pl-fpw__btn" disabled={!canSubmit}>
                {submitting
                  ? (<><LoaderCircle size={16} className="pl-fpw__spin" aria-hidden="true" /> {t("forgotPassword.sending")}</>)
                  : t("forgotPassword.sendLink")}
              </button>
            </form>

            <button type="button" className="pl-fpw__link pl-fpw__link--back" onClick={onBack}>
              <ArrowLeft size={14} aria-hidden="true" /> {t("forgotPassword.backToSignIn")}
            </button>
          </>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="pl-fpw">
      <style>{CSS}</style>
      <div className="pl-fpw__langtoggle"><LanguageToggle /></div>
      {children}
    </div>
  );
}

const CSS = `
  .pl-fpw {
    --ink: #1B2430; --ink-soft: #6A7383; --line: #E1DED7; --accent: #2D5BD1;
    font-family: 'Karla', system-ui, sans-serif; color: var(--ink);
    background: #F7F5F1; min-height: 100vh; position: relative;
    display: flex; align-items: center; justify-content: center; padding: 40px 22px;
  }
  .pl-fpw *, .pl-fpw *::before, .pl-fpw *::after { box-sizing: border-box; }
  .pl-fpw__langtoggle { position: absolute; top: 20px; inset-inline-end: 20px; }

  .pl-fpw__card {
    width: 100%; max-width: 400px; background: #fff;
    border: 1px solid var(--line); border-radius: 16px; padding: 34px 30px;
    text-align: center;
  }

  .pl-fpw__mark {
    width: 48px; height: 48px; border-radius: 13px; margin: 0 auto 14px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff;
  }
  .pl-fpw__sentIcon { color: #1E7F63; margin-bottom: 4px; }

  .pl-fpw__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px;
  }
  .pl-fpw h1 {
    font-family: 'Fraunces', Georgia, serif; font-size: 1.5rem;
    font-weight: 600; margin: 0 0 8px; line-height: 1.15;
  }
  .pl-fpw__lead { color: var(--ink-soft); font-size: 0.93rem; line-height: 1.6; margin: 0 0 22px; }

  .pl-fpw__field { display: flex; flex-direction: column; gap: 6px; text-align: start; margin-bottom: 18px; }
  .pl-fpw__field span { font-size: 0.82rem; font-weight: 600; }
  .pl-fpw__field input {
    width: 100%; font-family: inherit; font-size: 0.95rem; color: var(--ink);
    background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 11px 13px;
  }
  .pl-fpw__field input:focus-visible {
    outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(45,91,209,0.16);
  }
  .pl-fpw__field input:disabled { background: #F4F3F0; color: var(--ink-soft); }

  .pl-fpw__btn {
    width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.95rem; font-weight: 600;
    color: #fff; background: var(--accent); border: none; border-radius: 10px;
    padding: 12px 16px; cursor: pointer;
  }
  .pl-fpw__btn:hover:not(:disabled) { background: #2449AC; }
  .pl-fpw__btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .pl-fpw__link {
    display: inline-flex; align-items: center; gap: 5px;
    background: transparent; border: none; padding: 0; margin-top: 20px;
    font-family: inherit; font-size: 0.85rem; color: var(--ink-soft); cursor: pointer;
  }
  .pl-fpw__link:hover { color: var(--ink); }
  .pl-fpw__link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  .pl-fpw__link--back { margin-top: 22px; }

  .pl-fpw__spin { animation: plFpwSpin 0.9s linear infinite; }
  @keyframes plFpwSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pl-fpw__spin { animation: none; } }

  ${LANGUAGE_TOGGLE_CSS}
`;
