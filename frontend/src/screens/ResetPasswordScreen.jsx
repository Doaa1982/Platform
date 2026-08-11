import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, CheckCircle2, ArrowRight, KeyRound, Eye, EyeOff } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import Message from "../components/Message";

/* =========================================================================
   RESET PASSWORD SCREEN — /reset-password/{token}

   Anonymous by necessity, mirroring InviteScreen: the token in the URL is
   the credential, and it resolves to an email before any authentication.

   Redeeming it signs the visitor straight in (same courtesy accepting an
   Invitation gets) — through adoptSession, never straight to storage, so
   whoever was signed in before this link was opened is replaced rather than
   left in place.
   ========================================================================= */

export default function ResetPasswordScreen({ token, onDone }) {
  useFonts();
  const { adoptSession } = useAuth();
  const { t } = useLanguage();

  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.previewPasswordReset(token)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((e) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const session = await api.resetPassword(token, password);

      // Through the provider, never straight to storage — see the file
      // remarks above and InviteScreen's identical reasoning.
      adoptSession({
        token: session.token,
        expiresAt: session.expiresAt,
        fullName: session.fullName,
      });
      setDone(true);
      setTimeout(() => onDone(), 1200);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <div className="pl-rpw__card pl-rpw__card--bad">
          <AlertCircle size={26} aria-hidden="true" />
          <h1>{t("resetPassword.cantOpenTitle")}</h1>
          <p>{loadError}</p>
          <p className="pl-rpw__muted">{t("resetPassword.cantOpenHint")}</p>
        </div>
      </Shell>
    );
  }

  if (!preview) {
    return (
      <Shell>
        <div className="pl-rpw__card">
          <LoaderCircle size={22} className="pl-rpw__spin" aria-hidden="true" />
          <p className="pl-rpw__muted">{t("resetPassword.checking")}</p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="pl-rpw__card pl-rpw__card--good">
          <CheckCircle2 size={26} aria-hidden="true" />
          <h1>{t("resetPassword.doneTitle")}</h1>
          <p>{t("resetPassword.doneBody")}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="pl-rpw__card">
        <div className="pl-rpw__mark" aria-hidden="true"><KeyRound size={22} /></div>
        <div className="pl-rpw__eyebrow">{t("resetPassword.eyebrow")}</div>
        <h1>{t("resetPassword.title")}</h1>
        <p className="pl-rpw__lead">
          {t("resetPassword.leadPrefix")} <strong>{preview.email}</strong>.
        </p>

        <form className="pl-rpw__form" onSubmit={handleSubmit} noValidate>
          {error && <Message type="error">{error}</Message>}

          <label className="pl-rpw__field">
            <span>{t("resetPassword.newPasswordLabel")}</span>
            <div className="pl-rpw__control">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required autoFocus minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" disabled={submitting}
              />
              <button
                type="button"
                className="pl-rpw__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                disabled={submitting}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <p className="pl-rpw__note">{t("resetPassword.minLengthHint")}</p>

          <button type="submit" className="pl-rpw__btn" disabled={submitting || password.length < 8}>
            {submitting
              ? (<><LoaderCircle size={16} className="pl-rpw__spin" aria-hidden="true" /> {t("resetPassword.saving")}</>)
              : (<>{t("resetPassword.setNewPassword")} <ArrowRight size={16} aria-hidden="true" /></>)}
          </button>
        </form>

        <p className="pl-rpw__muted">{t("resetPassword.validUntil", { date: formatDate(preview.expiresAt) })}</p>
      </div>
    </Shell>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function Shell({ children }) {
  return (
    <div className="pl-rpw">
      <style>{CSS}</style>
      <div className="pl-rpw__langtoggle"><LanguageToggle /></div>
      {children}
    </div>
  );
}

const CSS = `
  .pl-rpw {
    --ink: #1B2430; --ink-soft: #6A7383; --line: #E1DED7; --accent: #2D5BD1;
    font-family: 'Karla', system-ui, sans-serif; color: var(--ink);
    background: #F7F5F1; min-height: 100vh; position: relative;
    display: flex; align-items: center; justify-content: center; padding: 40px 22px;
  }
  .pl-rpw *, .pl-rpw *::before, .pl-rpw *::after { box-sizing: border-box; }
  .pl-rpw__langtoggle { position: absolute; top: 20px; inset-inline-end: 20px; }

  .pl-rpw__card {
    width: 100%; max-width: 420px; background: #fff;
    border: 1px solid var(--line); border-radius: 16px; padding: 34px 30px;
    text-align: center;
  }
  .pl-rpw__card--bad { border-color: rgba(179,56,43,0.3); color: #B3382B; }
  .pl-rpw__card--good { border-color: rgba(30,127,99,0.35); color: #1E7F63; }
  .pl-rpw__card--bad h1, .pl-rpw__card--good h1 { color: inherit; }

  .pl-rpw__mark {
    width: 48px; height: 48px; border-radius: 13px; margin: 0 auto 14px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff;
  }
  .pl-rpw__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px;
  }
  .pl-rpw h1 {
    font-family: 'Fraunces', Georgia, serif; font-size: 1.6rem;
    font-weight: 600; margin: 0 0 8px; line-height: 1.15;
  }
  .pl-rpw__lead { color: var(--ink-soft); font-size: 0.93rem; line-height: 1.6; margin: 0 0 24px; }
  .pl-rpw__lead strong { color: var(--ink); }

  .pl-rpw__form { text-align: start; }
  .pl-rpw__field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
  .pl-rpw__field span { font-size: 0.82rem; font-weight: 600; }
  .pl-rpw__control { position: relative; display: flex; }
  .pl-rpw__control input {
    width: 100%; font-family: inherit; font-size: 0.95rem; color: var(--ink);
    background: #fff; border: 1px solid var(--line); border-radius: 10px;
    padding: 11px 44px 11px 13px;
  }
  .pl-rpw__control input:focus-visible {
    outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(45,91,209,0.16);
  }
  .pl-rpw__toggle {
    position: absolute; inset-inline-end: 4px; top: 50%; transform: translateY(-50%);
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px;
    background: transparent; border: none; border-radius: 8px;
    color: var(--ink-soft); cursor: pointer;
  }
  .pl-rpw__toggle:hover:not(:disabled) { color: var(--ink); background: #F0EEEA; }

  .pl-rpw__note { font-size: 0.8rem; color: var(--ink-soft); margin: 0 0 18px; text-align: start; }

  .pl-rpw__btn {
    width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.95rem; font-weight: 600;
    color: #fff; background: var(--accent); border: none; border-radius: 10px;
    padding: 12px 16px; cursor: pointer;
  }
  .pl-rpw__btn:hover:not(:disabled) { background: #2449AC; }
  .pl-rpw__btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .pl-rpw__muted { font-size: 0.8rem; color: var(--ink-soft); margin: 18px 0 0; line-height: 1.55; }

  .pl-rpw__spin { animation: plRpwSpin 0.9s linear infinite; }
  @keyframes plRpwSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pl-rpw__spin { animation: none; } }

  ${LANGUAGE_TOGGLE_CSS}
`;
