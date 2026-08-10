import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, ArrowLeft } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import Modal, { MODAL_CSS } from "../components/Modal";
import PlanPickerCards, { PLAN_PICKER_CARDS_CSS } from "../components/PlanPickerCards";
import CurrentPlanCard, { CURRENT_PLAN_CARD_CSS } from "../components/CurrentPlanCard";
import {
  levelLabel, aiLabel, domainLabel, LEVEL_ORDER, ENTITLEMENT_DOMAINS, planProfileForDomain, parseRequirement, fmtDate,
} from "../i18n/subscriptionLabels";

/* =========================================================================
   SUBSCRIPTION & BILLING — what this Workspace pays the platform.

   Distinct from the Workspace's own (still unbuilt) commerce capability —
   what this tutor charges *their* students. This screen is the other side:
   a Solo plan, optional Capability Packs, and the resulting Entitlements.

   This platform does not collect payment (2026-08-09 correction to the
   Commercial Domain design). Checkout only issues an Invoice; a Platform
   Operator confirms it was settled outside this platform. There is no "Pay
   now" button here because there is nothing this screen could honestly do —
   showing one would misrepresent what actually happens.
   ========================================================================= */

const STATUS_KEY = {
  Pending: "subscription.statusPending", Active: "subscription.statusActive", PastDue: "subscription.statusPastDue",
  Grace: "subscription.statusGrace", Suspended: "subscription.statusSuspended",
  Cancelled: "subscription.statusCancelled", Expired: "subscription.statusExpired",
};
const statusLabel = (t, v) => t(STATUS_KEY[v] ?? "") || v;

/* Optional, skippable — a churn signal for Product Advisory (Product Advisory
   Architecture §72-73), never required to complete cancellation. Stable codes
   are sent to the API (not localized text) so reporting isn't split by language. */
const CANCEL_REASONS = ["TooExpensive", "NotUsingEnough", "MissingFeature", "SwitchingTools", "TakingBreak", "Other"];

export default function SubscriptionScreen() {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [plans, setPlans] = useState(null);
  const [packs, setPacks] = useState(null);
  const [subscription, setSubscription] = useState(undefined); // undefined = not loaded yet, null = none exists
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  // Explicit "I want to pick a new plan" while the old one is Cancelled but
  // still within its paid grace period (SUB-004) — the backend already
  // permits checkout in that state (it only blocks Active/PastDue/Grace/
  // Suspended), so this is purely a frontend view toggle, not a new
  // capability. Reset after every mutating action completes (see run(),
  // below) so a stale "yes" can't resurface after a later cancel.
  const [resubscribing, setResubscribing] = useState(false);

  const fetchAll = useCallback(
    () => Promise.all([
      api.getCommercialPlans(),
      api.getCommercialPacks(),
      api.getSubscription(session.token, slug).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
    ]),
    [session.token, slug]);

  const load = useCallback(
    () => fetchAll().then(([p, k, s]) => { setPlans(p); setPacks(k); setSubscription(s); setError(null); })
      .catch((e) => setError(e.message)),
    [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(([p, k, s]) => { if (!cancelled) { setPlans(p); setPacks(k); setSubscription(s); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [fetchAll]);

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (successMessage) setSuccess(successMessage);
      await load();
      setResubscribing(false);
      return r;
    }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  if (error && !plans) {
    return <div className="lw-page"><Message type="error">{error}</Message></div>;
  }
  if (!plans || !packs || subscription === undefined) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <div className="lw-bill__loading"><LoaderCircle size={18} className="lw-bill__spin" /> {t("subscription.loading")}</div>
      </div>
    );
  }

  // A Cancelled subscription still has access until cancellationEffectiveDate
  // (SUB-004) — licenseStatus is Licensing's own authoritative answer to
  // "is access still live right now", so this defers to it rather than
  // re-deriving the date math here and risking drift from the source of truth.
  const isLive = subscription && subscription.licenseStatus !== "Expired";
  const showPicker = !isLive || (subscription.status === "Cancelled" && resubscribing);
  const currentPlan = subscription ? plans.find((p) => p.code === subscription.planCode) : null;

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{t("subscription.eyebrow")}</div>
      <h1>{showPicker ? t("subscription.title") : (currentPlan?.name ?? subscription.planCode)}</h1>
      <p className="lw-sub">
        {t(showPicker ? "subscription.pickLead" : "subscription.lead", { workspace: workspace?.name ?? "" })}
      </p>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {showPicker
        ? <PlanPicker plans={plans} packs={packs} previous={subscription} busy={busy}
            onBack={isLive ? () => setResubscribing(false) : undefined}
            onSubscribe={(body) => run(() => api.checkoutSubscription(session.token, slug, body),
              t("subscription.toastSubscribed", { plan: plans.find((p) => p.code === body.planCode)?.name ?? body.planCode }))} />
        : <SubscriptionStatus subscription={subscription} plans={plans} packs={packs} busy={busy}
            onCancel={(reason) => run(() => api.cancelSubscription(session.token, slug, reason), t("subscription.toastCancelled"))}
            onResubscribe={subscription.status === "Cancelled" ? () => setResubscribing(true) : undefined} />}
    </div>
  );
}

function PlanPicker({ plans, packs, previous, busy, onSubscribe, onBack }) {
  const { t } = useLanguage();
  const [configuring, setConfiguring] = useState(null); // { plan, billingCycle }

  // A Cancelled subscription can still be within its paid grace period
  // (SUB-004) — say so accurately instead of always claiming it "ended".
  const previousStillActive = previous && previous.licenseStatus !== "Expired";

  return (
    <div>
      {onBack && (
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm lw-bill__backbtn" onClick={onBack}>
          <ArrowLeft size={13} /> {t("subscription.backToCurrentPlan")}
        </button>
      )}

      {previous && (
        <div className="lw-bill__notice">
          {t(previousStillActive ? "subscription.previousActiveNote" : "subscription.previousEndedNote", {
            plan: plans.find((p) => p.code === previous.planCode)?.name ?? previous.planCode,
            date: fmtDate(previous.cancellationEffectiveDate ?? previous.currentPeriodEnd),
          })}
        </div>
      )}

      <PlanPickerCards
        plans={plans} packs={packs} disabled={busy}
        onChoosePlan={(plan, billingCycle) => setConfiguring({ plan, billingCycle })}
      />

      {configuring && (
        <ConfigureModal
          plan={configuring.plan} packs={packs} billingCycle={configuring.billingCycle} busy={busy}
          onClose={() => setConfiguring(null)}
          onConfirm={(packCodes) => onSubscribe({ planCode: configuring.plan.code, packCodes, billingCycle: configuring.billingCycle })
            .then((r) => { if (r) setConfiguring(null); })}
        />
      )}
    </div>
  );
}

function ConfigureModal({ plan, packs, billingCycle, busy, onClose, onConfirm }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState([]);

  const togglePack = (code) => setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));
  const packPrice = (pack) => (billingCycle === "Annual" ? pack.monthlyPrice * 10 : pack.monthlyPrice);

  const basePrice = billingCycle === "Annual" ? plan.annualPrice : plan.monthlyPrice;
  const total = basePrice + packs.filter((p) => selected.includes(p.code)).reduce((sum, p) => sum + packPrice(p), 0);

  return (
    <Modal onClose={onClose} closeLabel={t("subscription.close")}>
      <div className="lw-eyebrow">{t("subscription.configureTitle", { plan: plan.name })}</div>
      <h2 className="lw-modal__title">{plan.name}</h2>

      <div className="lw-bill__packlist">
        {packs.map((pack) => {
          const req = parseRequirement(pack.requiresMinProfile);
          const unmet = req && LEVEL_ORDER[planProfileForDomain(plan, req.domain)] < LEVEL_ORDER[req.level];
          return (
            <label key={pack.code} className={`lw-bill__pack ${unmet ? "is-disabled" : ""}`}>
              <input type="checkbox" checked={selected.includes(pack.code)} disabled={busy || unmet}
                     onChange={() => togglePack(pack.code)} />
              <span className="lw-bill__packname">{pack.name}</span>
              <span className="lw-bill__packprice">+{packPrice(pack)} {pack.currency}</span>
              {req && (
                <span className="lw-bill__packnote">
                  {t("subscription.packRequires", { domain: domainLabel(t, req.domain), level: levelLabel(t, req.level) })}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="lw-bill__total">
        <span>{t("subscription.totalPrice")}</span>
        <strong>{total} {plan.currency} {billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}</strong>
      </div>

      <div className="lw-modal__actions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onClose} disabled={busy}>{t("subscription.close")}</button>
        <button type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={() => onConfirm(selected)}>
          {busy ? <LoaderCircle size={14} className="lw-bill__spin" /> : t("subscription.confirmSubscribe")}
        </button>
      </div>
    </Modal>
  );
}

function SubscriptionStatus({ subscription, plans, packs, busy, onCancel, onResubscribe }) {
  const { t } = useLanguage();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const plan = plans.find((p) => p.code === subscription.planCode);

  const entitlement = (key, domain) =>
    subscription.entitlements.find((e) => e.key === key && (domain === undefined || e.domain === domain));

  const tutorCapacity = entitlement("capacity:tutors")?.value;
  const aiCredits = entitlement("credits:ai")?.value;

  const invoiceNeedsConfirmation = subscription.currentInvoiceStatus === "Issued" || subscription.currentInvoiceStatus === "Overdue";

  return (
    <div>
      <span className={`lw-bill__pill is-${subscription.status.toLowerCase()}`}>{statusLabel(t, subscription.status)}</span>

      {subscription.status === "Cancelled" && (
        <div className="lw-bill__notice lw-bill__cancellednotice">
          <p>{t("subscription.accessContinuesUntil", { date: fmtDate(subscription.cancellationEffectiveDate) })}</p>
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={onResubscribe}>
            {t("subscription.chooseNewPlan")}
          </button>
        </div>
      )}

      {invoiceNeedsConfirmation && (
        <div className={`lw-bill__notice ${subscription.currentInvoiceStatus === "Overdue" ? "is-overdue" : ""}`}>
          {subscription.currentInvoiceStatus === "Overdue"
            ? t("subscription.invoiceOverdue", { date: fmtDate(subscription.currentInvoiceDueDate) })
            : t("subscription.invoiceAwaiting", {
                amount: subscription.currentInvoiceAmount ?? "",
                currency: subscription.currentInvoiceCurrency ?? "",
                date: fmtDate(subscription.currentInvoiceDueDate),
              })}
        </div>
      )}

      <CurrentPlanCard plan={plan} packs={packs} subscription={subscription} />

      <h2 className="lw-bill__sectiontitle">{t("subscription.entitlementsTitle")}</h2>
      <div className="lw-bill__entgrid">
        <div className="lw-bill__enthead" />
        <div className="lw-bill__enthead">{t("subscription.capabilityProfileLabel")}</div>
        <div className="lw-bill__enthead">{t("subscription.aiAssistanceLabel")}</div>
        {ENTITLEMENT_DOMAINS.flatMap((domain) => {
          const profile = entitlement(`profile:${domain}`, domain);
          const ai = entitlement(`ai:${domain}`, domain);
          return [
            <div className="lw-bill__entdomain" key={`${domain}-d`}>{domainLabel(t, domain)}</div>,
            <div key={`${domain}-p`}>{profile ? levelLabel(t, profile.value) : "—"}</div>,
            <div key={`${domain}-a`}>{ai ? aiLabel(t, ai.value) : "—"}</div>,
          ];
        })}
      </div>
      <div className="lw-bill__proplist">
        <span className="lw-bill__proplabel">{t("subscription.tutorCapacity")}</span>
        <span className="lw-bill__propvalue">{tutorCapacity ?? "—"}</span>
        <span className="lw-bill__proplabel">{t("subscription.aiCredits")}</span>
        <span className="lw-bill__propvalue">{aiCredits ? Number(aiCredits).toLocaleString() : "—"}</span>
      </div>

      {subscription.status === "Active" && (
        <div className="lw-bill__actions">
          <p className="lw-bill__changenote">{t("subscription.changeNote")}</p>
          <div className="lw-bill__cancelbar">
            {confirmingCancel ? (
              <div className="lw-bill__cancelpanel">
                <p className="lw-bill__cancelprompt">
                  {t("subscription.cancelConfirmPrompt", { date: fmtDate(subscription.currentPeriodEnd) })}
                </p>

                <label className="lw-bill__reasonlabel" htmlFor="cancel-reason">
                  {t("subscription.cancelReasonLabel")}
                </label>
                <select id="cancel-reason" className="lw-bill__reasonselect" disabled={busy}
                        value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}>
                  <option value="">{t("subscription.cancelReasonSkip")}</option>
                  {CANCEL_REASONS.map((code) => (
                    <option key={code} value={code}>{t(`subscription.cancelReason${code}`)}</option>
                  ))}
                </select>

                <div className="lw-bill__cancelpanelactions">
                  <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                          onClick={() => { setConfirmingCancel(false); setCancelReason(""); }}>
                    {t("subscription.neverMind")}
                  </button>
                  <button className="lw-btn lw-btn--sm lw-bill__dangerbtn" disabled={busy}
                          onClick={() => { const reason = cancelReason; setConfirmingCancel(false); setCancelReason(""); onCancel(reason); }}>
                    {t("subscription.confirmCancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setConfirmingCancel(true)}>
                {t("subscription.cancelSubscription")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
  .lw-bill__notice {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: var(--radius-sm); padding: 11px 14px; margin-bottom: 16px;
    font-size: 0.86rem; color: var(--ink);
  }
  .lw-bill__notice.is-overdue {
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  }
  .lw-bill__cancellednotice { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .lw-bill__cancellednotice p { margin: 0; }

  .lw-bill__backbtn { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 14px; }

  .lw-bill__proplist {
    display: grid; grid-template-columns: max-content 1fr;
    row-gap: 7px; column-gap: 12px; font-size: 0.84rem; margin-bottom: 16px;
  }
  .lw-bill__proplabel { color: var(--ink-soft); white-space: nowrap; }
  .lw-bill__propvalue { color: var(--ink); text-align: end; }

  .lw-bill__packlist { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
  .lw-bill__pack {
    display: grid; grid-template-columns: auto 1fr auto; align-items: center; column-gap: 10px;
    border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px; cursor: pointer;
  }
  .lw-bill__pack.is-disabled { opacity: 0.5; cursor: not-allowed; }
  .lw-bill__packname { font-weight: 600; font-size: 0.88rem; }
  .lw-bill__packprice { font-size: 0.82rem; color: var(--ink-soft); }
  .lw-bill__packnote { grid-column: 2 / -1; font-size: 0.76rem; color: var(--danger); }

  .lw-bill__total {
    display: flex; justify-content: space-between; align-items: baseline;
    border-top: 1px solid var(--line); padding-top: 12px; margin-bottom: 6px; font-size: 0.9rem;
  }

  .lw-bill__pill {
    font-family: var(--font-mono); font-size: 11px; border-radius: 20px; padding: 4px 11px;
    background: var(--surface-2); color: var(--ink-soft); display: inline-block; margin-bottom: 14px;
  }
  .lw-bill__pill.is-active { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2); }
  .lw-bill__pill.is-pastdue, .lw-bill__pill.is-grace { background: color-mix(in srgb, #E0A83E 20%, transparent); color: #A67519; }
  .lw-bill__pill.is-suspended { background: color-mix(in srgb, var(--danger) 16%, transparent); color: var(--danger); }

  .lw-bill__sectiontitle { font-size: 0.98rem; margin: 22px 0 10px; }
  .lw-bill__entgrid {
    display: grid; grid-template-columns: max-content 1fr 1fr; gap: 8px 14px;
    font-size: 0.84rem; align-items: center; margin-bottom: 16px;
  }
  .lw-bill__enthead { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-soft); }
  .lw-bill__entdomain { font-weight: 600; }

  .lw-bill__actions { margin-top: 18px; }
  .lw-bill__changenote { font-size: 0.8rem; color: var(--ink-soft); margin: 0 0 10px; max-width: 60ch; }
  .lw-bill__cancelbar { font-size: 0.84rem; color: var(--ink-soft); }
  .lw-bill__dangerbtn { background: var(--danger); border-color: var(--danger); color: #fff; }

  .lw-bill__cancelpanel {
    display: flex; flex-direction: column; gap: 9px; align-items: flex-start;
    border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 14px; max-width: 46ch;
  }
  .lw-bill__cancelprompt { margin: 0; color: var(--ink); }
  .lw-bill__reasonlabel { font-size: 0.78rem; color: var(--ink-soft); }
  .lw-bill__reasonselect {
    width: 100%; padding: 7px 9px; border: 1px solid var(--line); border-radius: var(--radius-sm);
    background: var(--surface); color: var(--ink); font-size: 0.84rem;
  }
  .lw-bill__cancelpanelactions { display: flex; gap: 10px; align-self: flex-end; }

  .lw-bill__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-bill__spin { animation: lwBillSpin 0.9s linear infinite; }
  @keyframes lwBillSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-bill__spin { animation: none; } }

  ${PLAN_PICKER_CARDS_CSS}
  ${CURRENT_PLAN_CARD_CSS}
  ${MODAL_CSS}
`;
