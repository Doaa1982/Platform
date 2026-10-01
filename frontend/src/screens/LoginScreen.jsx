import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "../auth/authContext";
import { SIDES } from "../auth/sides";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryField } from "../components/EntryShell";
import { apiErrorMessage } from "../i18n/apiErrors";

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
  const { signIn, sessionExpired } = useAuth();
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
      setError(apiErrorMessage(t, err, { 401: "login.errMismatch", 400: "login.errMissing" }));
      setPassword("");
      setSubmitting(false);
    }
  }

  return (
    <EntryShell>
      <EntryCard eyebrow={t(`sides.${side}.login.eyebrow`)} title={t(`sides.${side}.login.heading`)} lead={t(`sides.${side}.login.sub`)}>
        <form className="lw-entry__form" onSubmit={handleSubmit} noValidate>
          {sessionExpired && !error && <div className="lw-entry__alert" role="status">{t("login.sessionExpired")}</div>}
          {error && <div className="lw-entry__alert lw-entry__alert--bad" role="alert">{error}</div>}

          <EntryField label={t("login.email")}>
            <input
              name="email" type="email" autoComplete="email" autoFocus required dir="auto"
              value={email} placeholder={t("login.emailPlaceholder")}
              aria-invalid={error ? "true" : undefined}
              onChange={(e) => setEmail(e.target.value)} disabled={submitting}
            />
          </EntryField>

          <EntryField label={t("login.password")}>
            <span className="lw-field__control">
              <input
                name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
                value={password} aria-invalid={error ? "true" : undefined}
                onChange={(e) => setPassword(e.target.value)} disabled={submitting}
              />
              <button
                type="button" className="lw-field__reveal" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")} disabled={submitting}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </EntryField>

          <button type="button" className="lw-entry__link" style={{ alignSelf: "flex-end" }} onClick={onForgotPassword} disabled={submitting}>
            {t("login.forgotPassword")}
          </button>

          <button type="submit" className="lw-btn lw-btn--accent" disabled={!canSubmit}>
            {submitting
              ? (<><LoaderCircle size={16} className="lw-entry__spin" aria-hidden="true" /> {t("login.signingIn")}</>)
              : (<>{t("login.signIn")} <ArrowRight size={16} className="lw-flip" aria-hidden="true" /></>)}
          </button>
        </form>

        <button type="button" className="lw-entry__link" style={{ marginTop: 18 }} onClick={onBack}>
          <ArrowLeft size={13} className="lw-flip" aria-hidden="true" /> {t("login.notWhatYouWanted")}
        </button>

        {import.meta.env.DEV && (
          <p className="lw-entry__note">
            <strong>{t("login.devSeed")}</strong> <bdi>{copy.devSeed} · Test1234!</bdi>
          </p>
        )}
      </EntryCard>
    </EntryShell>
  );
}
