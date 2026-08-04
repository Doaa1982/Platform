import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "../auth/authContext";
import { SIDES } from "../auth/sides";
import { useFonts } from "../hooks/useFonts";

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

export default function LoginScreen({ side, onBack }) {
  useFonts();
  const { signIn } = useAuth();
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
        err.status === 401 ? "That email and password don't match."
        : err.status === 400 ? "Please enter both your email and password."
        : err.message || "Something went wrong. Please try again."
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
  };

  return (
    <div className="pl-login" style={themeVars}>
      <style>{CSS}</style>

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
          {copy.asideTitle.split("\n").map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </h2>
        <p className="pl-login__asidetext">{copy.asideText}</p>
      </section>

      <main className="pl-login__panel">
        <div className="pl-login__form-wrap">
          <button type="button" className="pl-login__back" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" /> Not what you wanted?
          </button>

          <div className="pl-login__eyebrow">{copy.eyebrow}</div>
          <h1 className="pl-login__title">{copy.heading}</h1>
          <p className="pl-login__sub">{copy.sub}</p>

          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="pl-alert" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="pl-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                placeholder="you@example.com"
                aria-invalid={error ? "true" : undefined}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="pl-field">
              <label htmlFor="password">Password</label>
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={submitting}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="pl-btn" disabled={!canSubmit}>
              {submitting
                ? (<><LoaderCircle size={16} className="pl-spin" aria-hidden="true" /> Signing in…</>)
                : (<>Sign in <ArrowRight size={16} aria-hidden="true" /></>)}
            </button>
          </form>

          {import.meta.env.DEV && (
            <p className="pl-login__hint">
              <strong>Dev seed:</strong> tutor@platform.com · Test1234!
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
    --pl-ink-soft: #6A7383;
    --pl-line: #E1DED7;
    --pl-danger: #B3382B;
    --pl-danger-bg: #FDF1EF;

    font-family: 'Karla', system-ui, sans-serif;
    color: var(--pl-ink);
    background: var(--pl-bg);
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1.05fr 1fr;
  }
  .pl-login *, .pl-login *::before, .pl-login *::after { box-sizing: border-box; }

  /* ── Left brand panel ─────────────────────────────────────────────────── */
  .pl-login__aside {
    background: linear-gradient(155deg, var(--pl-aside-from) 0%, var(--pl-aside-via) 55%, var(--pl-aside-to) 160%);
    color: #F7F5F1;
    padding: 56px 52px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 20px;
  }
  .pl-login__mark { line-height: 0; }
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
  .pl-login__panel { display: flex; align-items: center; justify-content: center; padding: 48px 32px; }
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
  .pl-field__control input { padding-right: 44px; }
  .pl-field input::placeholder { color: #A9AFBA; }
  .pl-field input:focus-visible {
    outline: none;
    border-color: var(--pl-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pl-accent) 18%, transparent);
  }
  .pl-field input[aria-invalid="true"] { border-color: var(--pl-danger); }
  .pl-field input:disabled { background: #F4F3F0; color: var(--pl-ink-soft); }

  .pl-field__toggle {
    position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
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

  .pl-alert {
    display: flex; align-items: flex-start; gap: 9px;
    background: var(--pl-danger-bg);
    border: 1px solid rgba(179,56,43,0.28);
    color: var(--pl-danger);
    border-radius: 10px; padding: 10px 12px; margin-bottom: 18px;
    font-size: 0.87rem; line-height: 1.45;
  }
  .pl-alert svg { flex-shrink: 0; margin-top: 1px; }

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
`;
