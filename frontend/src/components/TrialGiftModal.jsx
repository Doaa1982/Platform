import Modal from "./Modal";
import { useLanguage } from "../i18n/useLanguage";

/* =========================================================================
   TRIAL GIFT MODAL — the one-time "you got 200 free AI credits" announcement.
   Shown by App.jsx (gated on useDismissedTip, the same shown-once-then-never
   pattern TutorTip already uses) the first time a tutor's workspace still has
   an unspent trial-credit balance — not tied to "first login" specifically,
   since the trial balance itself is already self-limiting (30 days, or an
   earlier free→paid conversion — Documents/
   AICreditsCommercialContractAndImplementationPlan.md §A4/§A7).
   ========================================================================= */
export default function TrialGiftModal({ trialRemaining, onDismiss }) {
  const { t } = useLanguage();

  return (
    <Modal onClose={onDismiss} closeLabel={t("subscription.trialGiftModalCta")}>
      <h2 className="lw-modal__title">{t("subscription.trialGiftModalTitle")}</h2>
      <p>{t("subscription.trialGiftModalBody", { trial: Number(trialRemaining).toLocaleString() })}</p>
      <div className="lw-modal__actions">
        <button type="button" className="lw-btn lw-btn--accent" onClick={onDismiss}>
          {t("subscription.trialGiftModalCta")}
        </button>
      </div>
    </Modal>
  );
}
