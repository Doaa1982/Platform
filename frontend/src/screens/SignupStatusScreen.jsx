import { useEffect, useState } from "react";
import { AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import * as api from "../api/client";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryFacts, EntryLoading } from "../components/EntryShell";
import { apiErrorMessage } from "../i18n/apiErrors";
import { formatDate } from "../i18n/format";

/* =========================================================================
   SIGNUP STATUS — /apply/status/{token}

   The Signup Status Link (BA-008). An applicant has no Identity yet, so there
   is nothing to log in to — this token is their only way back to their own
   application.

   Wording follows §7.1's "What the Prospective Tutor Sees", but is chosen here
   from the status (and WorkspaceReady) and rendered through translations: the
   API's Headline/Detail are English-only, so showing them left an Arabic page
   with English text in it. A reviewer's own rejection reason is shown as
   written. No payment step lives on this
   screen at all (2026-08-24 correction) — an approved application is
   immediately ready for a Platform Operator to provision a Workspace for;
   which plan (free or paid) that Workspace ends up on is a separate decision
   made later, at Billing.
   ========================================================================= */

function lookFor(status) {
  if (status.status === "Approved") {
    return status.workspaceReady
      ? { icon: CheckCircle2, tone: "good", key: "ready" }
      : { icon: CheckCircle2, tone: "good", key: "approved" };
  }
  if (status.status === "Rejected") return { icon: XCircle, tone: "muted", key: "rejected" };
  return { icon: Clock, tone: "info", key: "underReview" };
}

export default function SignupStatusScreen({ token }) {
  const { t, lang } = useLanguage();

  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getSignupStatus(token)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((e) => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
  }, [token]);

  if (error && !status) {
    return (
      <EntryShell>
        <EntryCard icon={AlertCircle} tone="bad" title={t("signupStatus.invalidTitle")}
                   lead={apiErrorMessage(t, error, { 404: "signupStatus.invalidBody" })} />
      </EntryShell>
    );
  }

  if (!status) return <EntryLoading label={t("signupStatus.checking")} />;

  const look = lookFor(status);
  const detail = look.key === "rejected" && status.rejectionReason ? null : t(`signupStatus.${look.key}Body`);

  return (
    <EntryShell>
      <EntryCard icon={look.icon} tone={look.tone} eyebrow={t("signupStatus.eyebrow")}
                 title={t(`signupStatus.${look.key}Title`)} lead={detail}>
        {look.key === "rejected" && status.rejectionReason && (
          <p className="lw-entry__lead" dir="auto">{status.rejectionReason}</p>
        )}
        <EntryFacts items={[
          { label: t("signupStatus.name"), value: status.fullName },
          { label: t("signupStatus.email"), value: status.email },
          { label: t("signupStatus.applied"), value: formatDate(lang, status.submittedAt) },
        ]} />
      </EntryCard>
    </EntryShell>
  );
}
