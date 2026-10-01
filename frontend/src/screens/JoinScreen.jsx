import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, CheckCircle2, ArrowRight, Building2, Clock } from "lucide-react";
import * as api from "../api/client";
import RequiredMark from "../components/RequiredMark";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryField, EntryLoading } from "../components/EntryShell";
import { apiErrorMessage } from "../i18n/apiErrors";
import { isolate } from "../i18n/format";

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
  const [statusLink, setStatusLink] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.previewJoin(slug)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((e) => { if (!cancelled) setLoadError(e); });
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
      const receipt = await api.submitJoin(slug, {
        fullName: fullName.trim(),
        email: email.trim(),
        message: message.trim() || null,
      });
      setStatusLink(receipt.statusLink);
      setDone(true);
    } catch (e) {
      setError(apiErrorMessage(t, e, { 400: "join.errBothRequired", 404: "join.linkBadBody", 409: "join.errAlreadyConnected" }));
      setSubmitting(false);
    }
  }

  const signIn = <button type="button" className="lw-btn" onClick={onSignIn}>{t("join.signIn")}</button>;

  if (loadError) {
    return (
      <EntryShell>
        <EntryCard icon={AlertCircle} tone="bad" title={t("join.linkBadTitle")}
                   lead={apiErrorMessage(t, loadError, { 404: "join.linkBadBody" })}>
          <p className="lw-entry__note">{t("join.linkBadHint")}</p>
        </EntryCard>
      </EntryShell>
    );
  }

  if (!preview) return <EntryLoading label={t("join.loading")} />;

  if (done) {
    return (
      <EntryShell>
        <EntryCard icon={CheckCircle2} tone="good" title={t("join.requestSentTitle")}
                   lead={t("join.requestSentBody", { workspace: isolate(preview.workspaceName), email: isolate(email.trim()) })}>
          {statusLink && (
            <p className="lw-entry__note">
              {t("join.checkStatusHint")} <a className="lw-entry__link" href={statusLink}>{t("join.checkStatusLink")}</a>
            </p>
          )}
          <div className="lw-entry__actions">{signIn}</div>
        </EntryCard>
      </EntryShell>
    );
  }

  // BA-005: accepting requests is off by default. A workspace that hasn't
  // opted in is a normal, expected state — not an error.
  if (!preview.acceptingRequests) {
    return (
      <EntryShell>
        <EntryCard icon={Building2} title={preview.workspaceName} titleDir="auto" lead={t("join.notAcceptingLead")}>
          <p className="lw-entry__note">{t("join.notAcceptingHint")}</p>
          <div className="lw-entry__actions">{signIn}</div>
        </EntryCard>
      </EntryShell>
    );
  }

  return (
    <EntryShell>
      <EntryCard icon={Building2} eyebrow={t("join.eyebrow")} title={preview.workspaceName} titleDir="auto"
                 lead={preview.description} leadDir="auto">

        <form className="lw-entry__form" onSubmit={handleSubmit} noValidate>
          {error && <div className="lw-entry__alert lw-entry__alert--bad" role="alert">{error}</div>}

          <EntryField label={<>{t("join.nameLabel")}<RequiredMark /></>}>
            <input type="text" autoComplete="name" required autoFocus dir="auto"
                   value={fullName} onChange={(e) => { setFullName(e.target.value); setError(null); }}
                   placeholder={t("join.namePlaceholder")} disabled={submitting}
                   aria-invalid={attempted && !fullName.trim() ? "true" : undefined} />
          </EntryField>

          <EntryField label={<>{t("join.emailLabel")}<RequiredMark /></>}>
            <input type="email" autoComplete="email" required dir="auto"
                   value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                   placeholder={t("join.emailPlaceholder")} disabled={submitting}
                   aria-invalid={attempted && !email.trim() ? "true" : undefined} />
          </EntryField>

          <EntryField label={t("join.messageLabel")}>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} dir="auto"
                      placeholder={t("join.messagePlaceholder")} disabled={submitting} />
          </EntryField>

          <button type="submit" className="lw-btn lw-btn--accent" disabled={submitting}>
            {submitting
              ? (<><LoaderCircle size={16} className="lw-entry__spin" aria-hidden="true" /> {t("join.sending")}</>)
              : (<>{t("join.sendRequest")} <ArrowRight size={16} className="lw-flip" aria-hidden="true" /></>)}
          </button>
        </form>

        <p className="lw-entry__note"><Clock size={13} aria-hidden="true" /> {t("join.footerNote")}</p>
      </EntryCard>
    </EntryShell>
  );
}
