import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "../auth/authContext";
import { SIDES } from "../auth/sides";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import Message from "../components/Message";

/* =========================================================================
   LOGIN SCREEN — one component, two faces.

   The tutor and learner doors differ in copy and colour, not in mechanism:
   both post the same credentials to the same endpoint and receive the same
   identity-level token. Which door you used never grants anything — roles on
   your Membership do that, resolved per Workspace after sign-in.

   Deliberately carries no Workspace branding. Sign-in happens before
   Workspace Resolution, so there is no tenant whose colours could honestly be
   applied yet. Per-Workspace login pages arrive with the Entry Point Registry
   (Technical Debt Backlog TD-006).
   ========================================================================= */

export default function LoginScreen({ side, onBack, onForgotPassword }) {
  useFonts();
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const copy = SIDES[side].login;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = email.trim() && password && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
      // On success the gate swaps this screen out — nothing to do here.
    } catch (err) {
      // Never reveal which field was wrong: the API deliberately returns the
      // same message for an unknown email and a bad password.
      setError(
        err.status === 401 ? t("login.errMismatch")
        : err.status === 400 ? t("login.errMissing")
        : err.message || t("login.errGeneric")
      );
      setPassword("");
      setSubmitting(false);
    }
  }

  const themeVars = {
    "--pl-accent": copy.accent,
    "--pl-aside-from": copy.asideFrom,
    "--pl-aside-via": copy.asideVia,
    "--pl-aside-to": copy.asideTo,
    "--pl-texture": copy.texture,
  };

  return (
    <div className={`pl-login pl-login--${side}`} style={themeVars}>
      <style>{CSS}</style>

      <div className="pl-login__langtoggle"><LanguageToggle /></div>

      <section className="pl-login__aside" aria-hidden="true">
        <div className="pl-login__mark">
          <svg viewBox="0 0 40 40" width="44" height="44">
            <rect width="40" height="40" rx="11" fill="var(--pl-accent)" />
            <path d="M11 26 L20 12 L29 26" fill="none" stroke="#fff" strokeWidth="2.6"
                  strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15.5 22 L24.5 22" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="pl-login__asidetitle">
          {t(`sides.${side}.login.asideTitle`).split("\n").map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </h2>
        <p className="pl-login__asidetext">{t(`sides.${side}.login.asideText`)}</p>
      </section>

      <main className="pl-login__panel">
        <div className="pl-login__form-wrap">
          <button type="button" className="pl-login__back" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" /> {t("login.notWhatYouWanted")}
          </button>

          <div className="pl-login__eyebrow">{t(`sides.${side}.login.eyebrow`)}</div>
          <h1 className="pl-login__title">{t(`sides.${side}.login.heading`)}</h1>
          <p className="pl-login__sub">{t(`sides.${side}.login.sub`)}</p>

          <form onSubmit={handleSubmit} noValidate>
            {error && <Message type="error">{error}</Message>}

            <div className="pl-field">
              <label htmlFor="email">{t("login.email")}</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                placeholder={t("login.emailPlaceholder")}
                aria-invalid={error ? "true" : undefined}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="pl-field">
              <div className="pl-field__labelrow">
                <label htmlFor="password">{t("login.password")}</label>
                <button
                  type="button"
                  className="pl-field__forgot"
                  onClick={onForgotPassword}
                  disabled={submitting}
                >
                  {t("login.forgotPassword")}
                </button>
              </div>
              <div className="pl-field__control">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  placeholder="••••••••"
                  aria-invalid={error ? "true" : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="pl-field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                  disabled={submitting}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="pl-btn" disabled={!canSubmit}>
              {submitting
                ? (<><LoaderCircle size={16} className="pl-spin" aria-hidden="true" /> {t("login.signingIn")}</>)
                : (<>{t("login.signIn")} <ArrowRight size={16} aria-hidden="true" /></>)}
            </button>
          </form>

          {import.meta.env.DEV && (
            <p className="pl-login__hint">
              <strong>{t("login.devSeed")}</strong> {copy.devSeed} · Test1234!
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

const CSS = `
  .pl-login {
    --pl-bg: #F7F5F1;
    --pl-surface: #FFFFFF;
    --pl-ink: #1B2430;
    /* Darkened 2026-08-15 (WCAG pass) — #6A7383 cleared only 4.39:1 as
       secondary text against --pl-bg (needs 4.5:1). */
    --pl-ink-soft: #687180;
    --pl-line: #E1DED7;
    --pl-danger: #B3382B;
    --pl-danger-bg: #FDF1EF;

    font-family: 'Karla', system-ui, sans-serif;
    color: var(--pl-ink);
    background: var(--pl-bg);
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    position: relative;
  }
  .pl-login *, .pl-login *::before, .pl-login *::after { box-sizing: border-box; }
  .pl-login__langtoggle { position: absolute; top: 20px; inset-inline-end: 20px; z-index: 3; }

  /* ── Left brand panel ─────────────────────────────────────────────────── */
  .pl-login__aside {
    background: linear-gradient(155deg, var(--pl-aside-from) 0%, var(--pl-aside-via) 55%, var(--pl-aside-to) 160%);
    color: #F7F5F1;
    padding: 56px 52px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
    position: relative;
  }
  .pl-login__mark { line-height: 0; }

  /* Notebook theme (2026-08-15): a bound-spine flourish where the cover
     panel meets the form, mirroring the same treatment used in-app —
     stitching for the tutor's leather ledger, perforation for the student's
     composition notebook. Logical inset so it mirrors correctly under RTL. */
  .pl-login--teach .pl-login__aside::after {
    content: ""; position: absolute; top: 24px; bottom: 24px; inset-inline-end: 0; width: 1px;
    background-image: repeating-linear-gradient(to bottom, rgba(247,245,241,0.55) 0 5px, transparent 5px 10px);
  }
  .pl-login--learn .pl-login__aside::after {
    content: ""; position: absolute; top: 0; bottom: 0; inset-inline-end: -1px; width: 10px;
    background-image: radial-gradient(circle at 0 10px, var(--pl-bg) 4px, transparent 4.2px);
    background-size: 10px 20px; background-repeat: repeat-y;
  }
  .pl-login__asidetitle {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 600;
    font-size: clamp(1.9rem, 3.4vw, 2.7rem);
    line-height: 1.12;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .pl-login__asidetext {
    color: rgba(247,245,241,0.74);
    font-size: 0.98rem;
    line-height: 1.6;
    max-width: 38ch;
    margin: 0;
  }

  /* ── Right form panel ─────────────────────────────────────────────────── */
  /* Notebook theme (2026-08-15): faint ruled-page texture, tinted per side —
     same idea as .lw-content's --page-texture in-app, just a static rule
     here since there's no --page-texture token before Workspace Resolution. */
  .pl-login__panel {
    display: flex; align-items: center; justify-content: center; padding: 48px 32px;
    background-image: var(--pl-texture, none);
  }
  .pl-login__form-wrap { width: 100%; max-width: 380px; }

  .pl-login__back {
    display: inline-flex; align-items: center; gap: 5px;
    background: transparent; border: none; padding: 0; margin-bottom: 22px;
    font-family: inherit; font-size: 0.82rem; color: var(--pl-ink-soft); cursor: pointer;
  }
  .pl-login__back:hover { color: var(--pl-ink); }
  .pl-login__back:focus-visible { outline: 2px solid var(--pl-accent); outline-offset: 2px; border-radius: 4px; }

  .pl-login__eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--pl-accent); margin-bottom: 10px;
  }
  .pl-login__title {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 2.1rem; font-weight: 600; margin: 0 0 6px; line-height: 1.1;
  }
  .pl-login__sub { color: var(--pl-ink-soft); font-size: 0.94rem; margin: 0 0 28px; }

  .pl-field { margin-bottom: 18px; }
  .pl-field label {
    display: block; font-size: 0.82rem; font-weight: 600;
    margin-bottom: 6px; color: var(--pl-ink);
  }
  .pl-field__labelrow {
    display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  }
  .pl-field__labelrow label { margin-bottom: 6px; }
  .pl-field__forgot {
    background: transparent; border: none; padding: 0; margin-bottom: 6px;
    font-family: inherit; font-size: 0.8rem; font-weight: 600;
    color: var(--pl-accent); cursor: pointer; white-space: nowrap;
  }
  .pl-field__forgot:hover:not(:disabled) { text-decoration: underline; }
  .pl-field__forgot:disabled { opacity: 0.55; cursor: not-allowed; }
  .pl-field__forgot:focus-visible { outline: 2px solid var(--pl-accent); outline-offset: 2px; border-radius: 4px; }
  .pl-field__control { position: relative; display: flex; }
  .pl-field input {
    width: 100%;
    font-family: inherit; font-size: 0.95rem; color: var(--pl-ink);
    background: var(--pl-surface);
    border: 1px solid var(--pl-line);
    border-radius: 10px;
    padding: 11px 13px;
    transition: border-color .15s, box-shadow .15s;
  }
  .pl-field__control input { padding-inline-end: 44px; }
  .pl-field input::placeholder { color: #A9AFBA; }
  .pl-field input:focus-visible {
    outline: none;
    border-color: var(--pl-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pl-accent) 18%, transparent);
  }
  .pl-field input[aria-invalid="true"] { border-color: var(--pl-danger); }
  .pl-field input:disabled { background: #F4F3F0; color: var(--pl-ink-soft); }

  .pl-field__toggle {
    position: absolute; inset-inline-end: 4px; top: 50%; transform: translateY(-50%);
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px;
    background: transparent; border: none; border-radius: 8px;
    color: var(--pl-ink-soft); cursor: pointer;
  }
  .pl-field__toggle:hover:not(:disabled) { color: var(--pl-ink); background: #F0EEEA; }
  .pl-field__toggle:focus-visible { outline: 2px solid var(--pl-accent); outline-offset: 1px; }

  .pl-btn {
    width: 100%;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.95rem; font-weight: 600;
    color: #fff; background: var(--pl-accent);
    border: none; border-radius: 10px;
    padding: 12px 16px; margin-top: 6px;
    cursor: pointer;
    transition: filter .15s, opacity .15s;
  }
  .pl-btn:hover:not(:disabled) { filter: brightness(0.9); }
  .pl-btn:focus-visible { outline: 2px solid var(--pl-ink); outline-offset: 2px; }
  .pl-btn:disabled { opacity: 0.55; cursor: not-allowed; }


  .pl-login__hint {
    margin-top: 26px; padding-top: 16px;
    border-top: 1px dashed var(--pl-line);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11.5px; color: var(--pl-ink-soft);
  }
  .pl-login__hint strong { color: var(--pl-ink); font-weight: 500; }

  .pl-spin { animation: plSpin 0.9s linear infinite; }
  @keyframes plSpin { to { transform: rotate(360deg); } }

  /* ── Responsive: the brand panel is decorative, so it shrinks to a header
        band before disappearing entirely. ─────────────────────────────── */
  @media (max-width: 860px) {
    .pl-login { grid-template-columns: 1fr; }
    .pl-login__aside { padding: 36px 28px; gap: 14px; }
    .pl-login__asidetext { display: none; }
    .pl-login__panel { padding: 36px 28px 56px; }
  }
  @media (max-width: 420px) {
    .pl-login__aside { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pl-spin { animation: none; }
    .pl-login * { transition: none !important; }
  }

  ${LANGUAGE_TOGGLE_CSS}
`;
