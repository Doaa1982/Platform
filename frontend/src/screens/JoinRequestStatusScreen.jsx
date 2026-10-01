import { useEffect, useState } from "react";
import { AlertCircle, Clock, CheckCircle2, XCircle, Undo2 } from "lucide-react";
import * as api from "../api/client";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell, { EntryCard, EntryFacts, EntryLoading } from "../components/EntryShell";
import { apiErrorMessage } from "../i18n/apiErrors";
import { formatDate } from "../i18n/format";

/* =========================================================================
   JOIN REQUEST STATUS — /join-requests/status/{token}

   The Join Request Status Link (§16, "Checking back without an Identity" —
   TD-018). A requester has no Identity and no credential at this stage, so
   this token is their only way back to their own request — same mechanism
   and same screen shape as SignupStatusScreen, plus a Cancel Request action
   this status link uniquely supports (JoinRequest.Cancel existed from
   the start, but nothing ever called it until this screen and its backend
   endpoint were added).
   ========================================================================= */

/* Wording is chosen from the status and rendered through translations — the API's
   Headline/Detail are English-only (same reasoning as SignupStatusScreen). */
const LOOK = {
  Submitted: { icon: Clock,        tone: "info",  key: "submitted" },
  Approved:  { icon: CheckCircle2, tone: "good",  key: "approved" },
  Declined:  { icon: XCircle,      tone: "muted", key: "declined" },
  Cancelled: { icon: Undo2,        tone: "muted", key: "cancelled" },
};

export default function JoinRequestStatusScreen({ token }) {
  const { t, lang } = useLanguage();

  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getJoinRequestStatus(token)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((e) => { if (!cancelled) setLoadError(e); });
    return () => { cancelled = true; };
  }, [token]);

  async function handleCancelRequest() {
    if (!window.confirm(t("joinStatus.confirmCancel"))) return;
    setCancelling(true);
    setError(null);
    try {
      await api.cancelJoinRequest(token);
      setStatus((s) => ({ ...s, status: "Cancelled" }));
    } catch (e) {
      setError(apiErrorMessage(t, e, { 409: "joinStatus.errAlreadyDecided" }));
    } finally {
      setCancelling(false);
    }
  }

  if (loadError && !status) {
    return (
      <EntryShell>
        <EntryCard icon={AlertCircle} tone="bad" title={t("joinStatus.invalidTitle")}
                   lead={apiErrorMessage(t, loadError, { 404: "joinStatus.invalidBody" })} />
      </EntryShell>
    );
  }

  if (!status) return <EntryLoading label={t("joinStatus.checking")} />;

  const look = LOOK[status.status] ?? LOOK.Submitted;

  return (
    <EntryShell>
      <EntryCard icon={look.icon} tone={look.tone} eyebrow={t("joinStatus.eyebrow")}
                 title={t(`joinStatus.${look.key}Title`)} lead={t(`joinStatus.${look.key}Body`)}>
        {error && <div className="lw-entry__alert lw-entry__alert--bad" role="alert">{error}</div>}

        <EntryFacts items={[
          { label: t("joinStatus.name"), value: status.fullName },
          { label: t("joinStatus.email"), value: status.email },
          { label: t("joinStatus.asked"), value: formatDate(lang, status.submittedAt) },
        ]} />

        {status.status === "Submitted" && (
          <div className="lw-entry__actions">
            <button type="button" className="lw-btn" disabled={cancelling} onClick={handleCancelRequest}>
              {cancelling ? t("joinStatus.cancelling") : t("joinStatus.cancel")}
            </button>
          </div>
        )}
      </EntryCard>
    </EntryShell>
  );
}
