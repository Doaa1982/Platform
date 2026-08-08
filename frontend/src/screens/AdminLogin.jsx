import { useState } from "react";
import { LoaderCircle, AlertCircle, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/authContext";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";

/* =========================================================================
   ADMIN LOGIN.

   Same endpoint, same credentials, same token as every other sign-in — only
   the surface differs. Signing in here does not make anyone an administrator;
   it only establishes who they are. The PlatformOperator check happens
   server-side on the first admin request, and being refused is a normal,
   visible outcome rather than a hidden route.

   Visually separate on purpose: the console is not Workspace-scoped, and
   dressing it like a tenant surface would misrepresent what it operates on.
   ========================================================================= */

export default function AdminLogin({ onBack }) {
  useFonts();
  const { signIn } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    } catch (err) {
      setError(
        err.status === 401 ? t("login.errMismatch")
        : err.message || t("login.errGeneric")
      );
      setPassword("");
      setSubmitting(false);
    }
  }

  return (
    <div className="pl-alogin">
      <style>{CSS}</style>
      <div className="pl-alogin__card">
        <button type="button" className="pl-alogin__back" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" /> {t("apply.back")}
        </button>

        <div className="pl-alogin__mark" aria-hidden="true"><ShieldCheck size={22} /></div>
        <div className="pl-alogin__eyebrow">{t("adminLogin.eyebrow")}</div>
        <h1>{t("adminLogin.heading")}</h1>
        <p className="pl-alogin__sub">{t("adminLogin.sub")}</p>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="pl-alogin__alert" role="alert">
              <AlertCircle size={16} aria-hidden="true" /> <span>{error}</span>
            </div>
          )}

          <label className="pl-alogin__field">
            <span>{t("login.email")}</span>
            <input type="email" autoComplete="email" autoFocus required value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="admin@platform.com"
                   disabled={submitting} />
          </label>

          <label className="pl-alogin__field">
            <span>{t("login.password")}</span>
            <input type="password" autoComplete="current-password" required value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                   disabled={submitting} />
          </label>

          <button type="submit" className="pl-alogin__btn" disabled={!canSubmit}>
            {submitting
              ? (<><LoaderCircle size={16} className="pl-alogin__spin" aria-hidden="true" /> {t("login.signingIn")}</>)
              : (<>{t("login.signIn")} <ArrowRight size={16} aria-hidden="true" /></>)}
          </button>
        </form>

        {import.meta.env.DEV && (
          <p className="pl-alogin__hint"><strong>{t("login.devSeed")}</strong> admin@platform.com · Test1234!</p>
        )}
      </div>
    </div>
  );
}

const CSS = `
  .pl-alogin {
    --ink: #E8EAED; --ink-soft: #949AA5; --line: #2A2F36;
    --surface: #1B1F24; --accent: #4C8DFF;
    font-family: 'Karla', system-ui, sans-serif;
    background: #131619; color: var(--ink); min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 40px 22px;
  }
  .pl-alogin *, .pl-alogin *::before, .pl-alogin *::after { box-sizing: border-box; }

  .pl-alogin__card {
    width: 100%; max-width: 400px; background: var(--surface);
    border: 1px solid var(--line); border-radius: 16px; padding: 32px 30px;
  }
  .pl-alogin__back {
    display: inline-flex; align-items: center; gap: 5px; background: transparent;
    border: none; padding: 0; margin-bottom: 20px; font-family: inherit;
    font-size: 0.82rem; color: var(--ink-soft); cursor: pointer;
  }
  .pl-alogin__back:hover { color: var(--ink); }

  /* UIC-004: the page's own header (mark + eyebrow + h1) is centered. */
  .pl-alogin__mark {
    width: 46px; height: 46px; border-radius: 12px; margin: 0 auto 16px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #0B1220;
  }
  .pl-alogin__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px;
    text-align: center;
  }
  .pl-alogin h1 { font-family: 'Fraunces', Georgia, serif; font-size: 1.55rem; font-weight: 600; margin: 0 0 6px; text-align: center; }
  .pl-alogin__sub { color: var(--ink-soft); font-size: 0.88rem; margin: 0 0 26px; line-height: 1.55; text-align: center; }

  .pl-alogin__field { display: block; margin-bottom: 16px; }
  .pl-alogin__field span { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px; }
  .pl-alogin__field input {
    width: 100%; font-family: inherit; font-size: 0.93rem; color: var(--ink);
    background: #0F1215; border: 1px solid var(--line); border-radius: 9px; padding: 10px 12px;
  }
  .pl-alogin__field input:focus-visible {
    outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(76,141,255,0.18);
  }
  .pl-alogin__field input:disabled { opacity: 0.6; }

  .pl-alogin__btn {
    width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.93rem; font-weight: 600;
    color: #0B1220; background: var(--accent); border: none; border-radius: 9px;
    padding: 11px 16px; margin-top: 6px; cursor: pointer;
  }
  .pl-alogin__btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .pl-alogin__alert {
    display: flex; align-items: flex-start; gap: 9px;
    background: rgba(224,97,90,0.12); border: 1px solid rgba(224,97,90,0.4);
    color: #E0615A; border-radius: 9px; padding: 10px 12px; margin-bottom: 16px; font-size: 0.86rem;
  }
  .pl-alogin__alert svg { flex-shrink: 0; margin-top: 1px; }

  .pl-alogin__hint {
    margin-top: 24px; padding-top: 14px; border-top: 1px dashed var(--line);
    font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--ink-soft);
  }
  .pl-alogin__hint strong { color: var(--ink); font-weight: 500; }

  .pl-alogin__spin { animation: plALSpin 0.9s linear infinite; }
  @keyframes plALSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pl-alogin__spin { animation: none; } }
`;
