import { useState } from "react";
import { KeyRound, ArrowLeft, LoaderCircle, MailCheck } from "lucide-react";
import * as api from "../api/client";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryField } from "../components/EntryShell";
import { apiErrorMessage } from "../i18n/apiErrors";
import { isolate } from "../i18n/format";

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

export default function ForgotPasswordScreen({ onBack }) {
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
      setError(apiErrorMessage(t, e));
      setSubmitting(false);
    }
  }

  const back = (
    <button type="button" className="lw-entry__link lw-entry__back" onClick={onBack}>
      <ArrowLeft size={13} className="lw-flip" aria-hidden="true" /> {t("forgotPassword.backToSignIn")}
    </button>
  );

  if (sent) {
    return (
      <EntryShell>
        <EntryCard icon={MailCheck} tone="good" title={t("forgotPassword.sentTitle")}
                   lead={t("forgotPassword.sentBody", { email: isolate(email.trim()) })}>
          {back}
        </EntryCard>
      </EntryShell>
    );
  }

  return (
    <EntryShell>
      <EntryCard icon={KeyRound} eyebrow={t("forgotPassword.eyebrow")} title={t("forgotPassword.title")} lead={t("forgotPassword.lead")}>
        <form className="lw-entry__form" onSubmit={handleSubmit} noValidate>
          {error && <div className="lw-entry__alert lw-entry__alert--bad" role="alert">{error}</div>}
          <EntryField label={t("forgotPassword.emailLabel")}>
            <input
              type="email" autoComplete="email" autoFocus required dir="auto"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t("forgotPassword.emailPlaceholder")} disabled={submitting}
            />
          </EntryField>
          <button type="submit" className="lw-btn lw-btn--accent" disabled={!canSubmit}>
            {submitting
              ? (<><LoaderCircle size={16} className="lw-entry__spin" aria-hidden="true" /> {t("forgotPassword.sending")}</>)
              : t("forgotPassword.sendLink")}
          </button>
        </form>
        {back}
      </EntryCard>
    </EntryShell>
  );
}
