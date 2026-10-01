import { useState } from "react";
import { LoaderCircle, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryField } from "../components/EntryShell";
import { apiErrorMessage } from "../i18n/apiErrors";

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
  const { signIn, sessionExpired } = useAuth();
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
      setError(apiErrorMessage(t, err, { 401: "login.errMismatch", 400: "login.errMissing" }));
      setPassword("");
      setSubmitting(false);
    }
  }

  return (
    <EntryShell>
      <EntryCard icon={ShieldCheck} eyebrow={t("adminLogin.eyebrow")} title={t("adminLogin.heading")} lead={t("adminLogin.sub")}>
        <form className="lw-entry__form" onSubmit={handleSubmit} noValidate>
          {sessionExpired && !error && <div className="lw-entry__alert" role="status">{t("login.sessionExpired")}</div>}
          {error && <div className="lw-entry__alert lw-entry__alert--bad" role="alert">{error}</div>}

          <EntryField label={t("login.email")}>
            <input type="email" autoComplete="email" autoFocus required dir="auto" value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder={t("login.emailPlaceholder")}
                   disabled={submitting} />
          </EntryField>

          <EntryField label={t("login.password")}>
            <input type="password" autoComplete="current-password" required value={password}
                   onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
          </EntryField>

          <button type="submit" className="lw-btn lw-btn--accent" disabled={!canSubmit}>
            {submitting
              ? (<><LoaderCircle size={16} className="lw-entry__spin" aria-hidden="true" /> {t("login.signingIn")}</>)
              : (<>{t("login.signIn")} <ArrowRight size={16} className="lw-flip" aria-hidden="true" /></>)}
          </button>
        </form>

        <button type="button" className="lw-entry__link lw-entry__back" onClick={onBack}>
          <ArrowLeft size={13} className="lw-flip" aria-hidden="true" /> {t("apply.back")}
        </button>

        {import.meta.env.DEV && (
          <p className="lw-entry__note"><strong>{t("login.devSeed")}</strong> <bdi>admin@platform.com · Test1234!</bdi></p>
        )}
      </EntryCard>
    </EntryShell>
  );
}
