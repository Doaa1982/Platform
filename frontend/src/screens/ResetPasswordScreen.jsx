import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, CheckCircle2, ArrowRight, KeyRound, Eye, EyeOff } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryField, EntryLoading } from "../components/EntryShell";
import { apiErrorMessage } from "../i18n/apiErrors";
import { formatDate, isolate } from "../i18n/format";

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
  const { adoptSession } = useAuth();
  const { t, lang } = useLanguage();

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
      .catch((e) => { if (!cancelled) setLoadError(e); });
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
      setError(apiErrorMessage(t, e, { 400: "resetPassword.minLengthHint", 404: "resetPassword.cantOpenBody" }));
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <EntryShell>
        <EntryCard icon={AlertCircle} tone="bad" title={t("resetPassword.cantOpenTitle")}
                   lead={apiErrorMessage(t, loadError, { 404: "resetPassword.cantOpenBody" })}>
          <p className="lw-entry__note">{t("resetPassword.cantOpenHint")}</p>
        </EntryCard>
      </EntryShell>
    );
  }

  if (!preview) return <EntryLoading label={t("resetPassword.checking")} />;

  if (done) {
    return (
      <EntryShell>
        <EntryCard icon={CheckCircle2} tone="good" title={t("resetPassword.doneTitle")} lead={t("resetPassword.doneBody")} />
      </EntryShell>
    );
  }

  return (
    <EntryShell>
      <EntryCard icon={KeyRound} eyebrow={t("resetPassword.eyebrow")} title={t("resetPassword.title")}
                 lead={t("resetPassword.lead", { email: isolate(preview.email) })}>
        <form className="lw-entry__form" onSubmit={handleSubmit} noValidate>
          {error && <div className="lw-entry__alert lw-entry__alert--bad" role="alert">{error}</div>}

          <EntryField label={t("resetPassword.newPasswordLabel")} hint={t("resetPassword.minLengthHint")}>
            <span className="lw-field__control">
              <input
                type={showPassword ? "text" : "password"} autoComplete="new-password"
                required autoFocus minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting}
              />
              <button
                type="button" className="lw-field__reveal" onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")} disabled={submitting}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </EntryField>

          <button type="submit" className="lw-btn lw-btn--accent" disabled={submitting || password.length < 8}>
            {submitting
              ? (<><LoaderCircle size={16} className="lw-entry__spin" aria-hidden="true" /> {t("resetPassword.saving")}</>)
              : (<>{t("resetPassword.setNewPassword")} <ArrowRight size={16} className="lw-flip" aria-hidden="true" /></>)}
          </button>
        </form>

        <p className="lw-entry__note">
          {t("resetPassword.validUntil", { date: isolate(formatDate(lang, preview.expiresAt, { dateStyle: "medium", timeStyle: "short" })) })}
        </p>
      </EntryCard>
    </EntryShell>
  );
}
