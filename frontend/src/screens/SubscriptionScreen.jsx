import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, ArrowLeft, Check } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import Modal, { MODAL_CSS } from "../components/Modal";
import SplitStepModal, { SPLIT_STEP_MODAL_CSS } from "../components/SplitStepModal";
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
            onResubscribe={subscription.status === "Cancelled" ? () => setResubscribing(true) : undefined}
            onDowngrade={(planCode) => run(() => api.downgradeSubscription(session.token, slug, planCode, subscription.selectedPackCodes),
              t("subscription.toastDowngradeScheduled", { plan: plans.find((p) => p.code === planCode)?.name ?? planCode }))}
            onCancelPendingChange={() => run(() => api.cancelPendingSubscriptionChange(session.token, slug), t("subscription.toastPendingChangeCancelled"))}
            onReactivate={() => run(() => api.reactivateSubscription(session.token, slug), t("subscription.toastReactivated"))}
            onUpgrade={(planCode) => run(() => api.upgradeSubscription(session.token, slug, planCode, subscription.selectedPackCodes))
              .then((r) => {
                if (r) {
                  setSuccess(t("subscription.toastUpgraded", {
                    plan: plans.find((p) => p.code === planCode)?.name ?? planCode,
                    amount: r.currentInvoiceAmount ?? 0, currency: r.currentInvoiceCurrency ?? "",
                  }));
                }
                return r;
              })} />}
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

function SubscriptionStatus({ subscription, plans, packs, busy, onCancel, onResubscribe, onDowngrade, onCancelPendingChange, onReactivate, onUpgrade }) {
  const { t } = useLanguage();
  const [cancelStep, setCancelStep] = useState(0); // 0 = closed, 1-4 = wizard step
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonNote, setCancelReasonNote] = useState("");
  const [upgradeTarget, setUpgradeTarget] = useState(null);
  const [downgradeTarget, setDowngradeTarget] = useState(null);

  const plan = plans.find((p) => p.code === subscription.planCode);

  // SUB-004: a Cancelled subscription keeps its License Active until
  // cancellationEffectiveDate — Licensing's licenseStatus is the
  // authoritative "is access still live right now", not the raw status.
  const isLive = subscription.licenseStatus !== "Expired";

  // Both lists are plain buttons, not the full PlanPickerCards grid — Upgrade
  // is a deliberate, considered action next to Cancel, and Downgrade sits
  // inside the cancel wizard's first step — a second modal/cycle toggle in
  // either place would add friction exactly where it should be lowest.
  // Neither changes billing cycle (see Upgrade/DowngradeRequest).
  const isAnnual = subscription.billingCycle === "Annual";
  const currentPrice = isAnnual ? plan?.annualPrice : plan?.monthlyPrice;
  const cheaperPlans = plans
    .filter((p) => p.code !== subscription.planCode && (isAnnual ? p.annualPrice : p.monthlyPrice) < (currentPrice ?? Infinity));
  const pricierPlans = plans
    .filter((p) => p.code !== subscription.planCode && (isAnnual ? p.annualPrice : p.monthlyPrice) > (currentPrice ?? -Infinity));

  const entitlement = (key, domain) =>
    subscription.entitlements.find((e) => e.key === key && (domain === undefined || e.domain === domain));

  const tutorCapacity = entitlement("capacity:tutors")?.value;
  const aiCredits = entitlement("credits:ai")?.value;

  const invoiceNeedsConfirmation = subscription.currentInvoiceStatus === "Issued" || subscription.currentInvoiceStatus === "Overdue";

  const closeCancelWizard = () => { setCancelStep(0); setCancelReason(""); setCancelReasonNote(""); };

  const partingWithDomains = plan ? ENTITLEMENT_DOMAINS.filter((d) => planProfileForDomain(plan, d) !== "Foundation") : [];
  const ownedPackNames = (subscription.selectedPackCodes ?? [])
    .map((code) => packs.find((p) => p.code === code)?.name).filter(Boolean);

  return (
    <div>
      <span className={`lw-bill__pill is-${subscription.status.toLowerCase()}`}>{statusLabel(t, subscription.status)}</span>
      {subscription.status === "Cancelled" && isLive && (
        <span className="lw-bill__pill lw-bill__pill--warn">
          {t("subscription.cancellationEffectiveOn", { date: fmtDate(subscription.cancellationEffectiveDate) })}
        </span>
      )}

      {subscription.status === "Cancelled" && (isLive ? (
        <div className="lw-bill__reactivatebanner">
          <div>
            <strong>{t("subscription.reactivateBannerTitle")}</strong>
            <p>{t("subscription.reactivateBannerNote", { date: fmtDate(subscription.cancellationEffectiveDate) })}</p>
          </div>
          <div className="lw-bill__reactivatebanneractions">
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onResubscribe}>
              {t("subscription.chooseNewPlan")}
            </button>
            <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={onReactivate}>
              {t("subscription.reactivatePlan")}
            </button>
          </div>
        </div>
      ) : (
        <div className="lw-bill__notice lw-bill__cancellednotice">
          <p>{t("subscription.accessContinuesUntil", { date: fmtDate(subscription.cancellationEffectiveDate) })}</p>
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={onResubscribe}>
            {t("subscription.chooseNewPlan")}
          </button>
        </div>
      ))}

      {subscription.pendingPlanCode && (
        <div className="lw-bill__notice lw-bill__cancellednotice">
          <p>
            {t("subscription.pendingChangeNotice", {
              plan: plans.find((p) => p.code === subscription.pendingPlanCode)?.name ?? subscription.pendingPlanCode,
              date: fmtDate(subscription.pendingChangeEffectiveDate),
            })}
          </p>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onCancelPendingChange}>
            {t("subscription.neverMind")}
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

      <div className="lw-bill__entcard">
        <h2 className="lw-bill__sectiontitle">{t("subscription.entitlementsTitle")}</h2>
        <table className="lw-bill__enttable">
          <tbody>
            {ENTITLEMENT_DOMAINS.flatMap((domain) => {
              const profile = entitlement(`profile:${domain}`, domain);
              const ai = entitlement(`ai:${domain}`, domain);
              return [
                <tr key={`${domain}-p`}>
                  <th scope="row">{domainLabel(t, domain)} — {t("subscription.capabilityProfileLabel")}</th>
                  <td>{profile ? levelLabel(t, profile.value) : "—"}</td>
                </tr>,
                <tr key={`${domain}-a`}>
                  <th scope="row">{domainLabel(t, domain)} — {t("subscription.aiAssistanceLabel")}</th>
                  <td>{ai ? aiLabel(t, ai.value) : "—"}</td>
                </tr>,
              ];
            })}
            <tr>
              <th scope="row">{t("subscription.tutorCapacity")}</th>
              <td>{tutorCapacity ?? "—"}</td>
            </tr>
            <tr>
              <th scope="row">{t("subscription.aiCredits")}</th>
              <td>{aiCredits ? Number(aiCredits).toLocaleString() : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {subscription.status === "Active" && pricierPlans.length > 0 && (
        <div className="lw-bill__upgradeblock">
          <h2 className="lw-bill__sectiontitle">{t("subscription.upgradePlanTitle")}</h2>
          <p className="lw-bill__changenote">{t("subscription.upgradeNote")}</p>
          <div className="lw-bill__downgradelist">
            {pricierPlans.map((p) => (
              <button key={p.code} type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}
                      onClick={() => setUpgradeTarget(p)}>
                {t("subscription.upgradeToPlan", { plan: p.name, price: isAnnual ? p.annualPrice : p.monthlyPrice, currency: p.currency })}
              </button>
            ))}
          </div>
        </div>
      )}

      {subscription.status === "Active" && (
        <div className="lw-bill__actions">
          <p className="lw-bill__changenote">{t("subscription.changeNote")}</p>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setCancelStep(1)}>
            {t("subscription.cancelSubscription")}
          </button>
        </div>
      )}

      {cancelStep > 0 && plan && (
        <CancelWizard
          step={cancelStep} setStep={setCancelStep} onClose={closeCancelWizard}
          plan={plan} subscription={subscription} busy={busy}
          partingWithDomains={partingWithDomains} ownedPackNames={ownedPackNames}
          cheaperPlans={cheaperPlans} isAnnual={isAnnual}
          cancelReason={cancelReason} setCancelReason={setCancelReason}
          cancelReasonNote={cancelReasonNote} setCancelReasonNote={setCancelReasonNote}
          onDowngradeInstead={(p) => { closeCancelWizard(); setDowngradeTarget(p); }}
          onCancel={onCancel}
        />
      )}

      {upgradeTarget && (
        <UpgradeConfirmModal plan={upgradeTarget} currentPlan={plan} busy={busy} isAnnual={isAnnual}
          onClose={() => setUpgradeTarget(null)}
          onConfirm={() => onUpgrade(upgradeTarget.code).then((r) => { if (r) setUpgradeTarget(null); })} />
      )}

      {downgradeTarget && (
        <DowngradeConfirmModal plan={downgradeTarget} currentPlan={plan} subscription={subscription} busy={busy} isAnnual={isAnnual}
          onClose={() => setDowngradeTarget(null)}
          onConfirm={() => onDowngrade(downgradeTarget.code).then((r) => { if (r) setDowngradeTarget(null); })} />
      )}
    </div>
  );
}

function CancelWizard({
  step, setStep, onClose, plan, subscription, busy,
  partingWithDomains, ownedPackNames, cheaperPlans, isAnnual,
  cancelReason, setCancelReason, cancelReasonNote, setCancelReasonNote,
  onDowngradeInstead, onCancel,
}) {
  const { t } = useLanguage();

  if (step === 1) {
    return (
      <SplitStepModal eyebrow={t("subscription.cancelWizardEyebrow")} onClose={onClose} closeLabel={t("subscription.close")}
        headline={t("subscription.cancelStep1Headline")} description={t("subscription.cancelStep1Sub")}>
        <p className="lw-bill__wizardlabel">{t("subscription.cancelStep1PartingWith")}</p>
        <ul className="lw-bill__partinglist">
          {partingWithDomains.map((d) => (
            <li key={d}>{domainLabel(t, d)}: {levelLabel(t, planProfileForDomain(plan, d))}</li>
          ))}
          {ownedPackNames.map((name) => <li key={name}>{name}</li>)}
          <li>{t("subscription.tutorCapacity")}</li>
          <li>{t("subscription.aiCredits")}</li>
        </ul>

        {cheaperPlans.length > 0 && (
          <div className="lw-bill__downgradeoffer">
            <p className="lw-bill__downgradelabel">{t("subscription.downgradeInsteadLabel")}</p>
            <div className="lw-bill__downgradelist">
              {cheaperPlans.map((p) => (
                <button key={p.code} type="button" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                        onClick={() => onDowngradeInstead(p)}>
                  {t("subscription.downgradeToPlan", { plan: p.name, price: isAnnual ? p.annualPrice : p.monthlyPrice, currency: p.currency })}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="lw-bill__wizardactions lw-bill__wizardactions--col">
          <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={onClose}>
            {t("subscription.keepCurrentPlan")}
          </button>
          <button type="button" className="lw-bill__textlink" disabled={busy} onClick={() => setStep(2)}>
            {t("subscription.continueToCancel")}
          </button>
        </div>
      </SplitStepModal>
    );
  }

  if (step === 2) {
    return (
      <SplitStepModal eyebrow={t("subscription.cancelWizardEyebrow")} onClose={onClose} closeLabel={t("subscription.close")}
        headline={t("subscription.cancelStep2Headline")} description={t("subscription.cancelStep2Sub")}>
        <p className="lw-bill__wizardlabel">{t("subscription.cancelStep2Overview")}</p>
        <ul className="lw-bill__reflectlist">
          <li>{t("subscription.cancelStep2ValidUntil", { date: fmtDate(subscription.currentPeriodEnd) })}</li>
          <li>
            {t("subscription.cancelStep2AccessEnds", { date: fmtDate(subscription.currentPeriodEnd) })}{" "}
            {t("subscription.cancelStep2ExportNote")}
          </li>
          <li>{t("subscription.cancelStep2ReactivationNote")}</li>
        </ul>
        <div className="lw-bill__wizardactions">
          <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={() => setStep(3)}>
            {t("subscription.continueToCancel")}
          </button>
        </div>
      </SplitStepModal>
    );
  }

  if (step === 3) {
    return (
      <SplitStepModal eyebrow={t("subscription.cancelWizardEyebrow")} onClose={onClose} closeLabel={t("subscription.close")}
        headline={t("subscription.cancelStep3Headline")} description={t("subscription.cancelStep3Sub", { plan: plan.name })}>
        <p className="lw-bill__wizardlabel">{t("subscription.cancelStep3Note")}</p>
        <div className="lw-bill__reasonoptions">
          {CANCEL_REASONS.map((code) => (
            <label key={code} className="lw-bill__reasonoption">
              <input type="radio" name="cancel-reason" checked={cancelReason === code} disabled={busy}
                     onChange={() => setCancelReason(code)} />
              {t(`subscription.cancelReason${code}`)}
            </label>
          ))}
        </div>
        {cancelReason === "Other" && (
          <textarea className="lw-bill__reasonnote" disabled={busy} rows={3}
                    value={cancelReasonNote} onChange={(e) => setCancelReasonNote(e.target.value)}
                    placeholder={t("subscription.cancelReasonOtherPlaceholder")} />
        )}
        <div className="lw-bill__wizardactions">
          <button className="lw-btn lw-btn--sm lw-bill__dangerbtn" disabled={busy}
                  onClick={() => {
                    const reason = cancelReason === "Other" && cancelReasonNote.trim() ? cancelReasonNote.trim() : (cancelReason || null);
                    onCancel(reason).then((r) => { if (r) setStep(4); });
                  }}>
            {busy ? <LoaderCircle size={14} className="lw-bill__spin" /> : t("subscription.confirmToCancel")}
          </button>
        </div>
      </SplitStepModal>
    );
  }

  return (
    <SplitStepModal eyebrow={t("subscription.cancelWizardEyebrow")} onClose={onClose} closeLabel={t("subscription.close")}
      headline={t("subscription.cancelStep4Headline")} description={t("subscription.cancelStep4Sub")}>
      <div className="lw-bill__successmark"><Check size={20} /></div>
      <p className="lw-bill__successlabel">{t("subscription.cancelStep4Confirmed")}</p>
      <ul className="lw-bill__reflectlist">
        <li>{t("subscription.cancelStep4Note1", { date: fmtDate(subscription.cancellationEffectiveDate ?? subscription.currentPeriodEnd) })}</li>
        <li>{t("subscription.cancelStep4Note2")}</li>
      </ul>
      <div className="lw-bill__wizardactions">
        <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={onClose}>{t("subscription.goToBilling")}</button>
      </div>
    </SplitStepModal>
  );
}

function UpgradeConfirmModal({ plan, currentPlan, busy, isAnnual, onClose, onConfirm }) {
  const { t } = useLanguage();
  const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
  const gained = currentPlan
    ? ENTITLEMENT_DOMAINS.filter((d) => LEVEL_ORDER[planProfileForDomain(plan, d)] > LEVEL_ORDER[planProfileForDomain(currentPlan, d)])
    : ENTITLEMENT_DOMAINS;

  return (
    <SplitStepModal eyebrow={t("subscription.upgradeWizardEyebrow")} onClose={onClose} closeLabel={t("subscription.close")}
      headline={t("subscription.upgradeConfirmHeadline", { plan: plan.name })} description={t("subscription.upgradeConfirmSub")}>
      {gained.length > 0 && (
        <>
          <p className="lw-bill__wizardlabel">{t("subscription.upgradeGain")}</p>
          <ul className="lw-bill__partinglist">
            {gained.map((d) => <li key={d}>{domainLabel(t, d)}: {levelLabel(t, planProfileForDomain(plan, d))}</li>)}
          </ul>
        </>
      )}
      <div className="lw-bill__total">
        <span>{t("subscription.totalPrice")}</span>
        <strong>{price} {plan.currency} {isAnnual ? t("subscription.perYear") : t("subscription.perMonth")}</strong>
      </div>
      <div className="lw-bill__wizardactions">
        <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onClose}>{t("subscription.notNow")}</button>
        <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={onConfirm}>
          {busy ? <LoaderCircle size={14} className="lw-bill__spin" /> : t("subscription.confirmUpgrade")}
        </button>
      </div>
    </SplitStepModal>
  );
}

function DowngradeConfirmModal({ plan, currentPlan, subscription, busy, isAnnual, onClose, onConfirm }) {
  const { t } = useLanguage();
  const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
  const lost = currentPlan
    ? ENTITLEMENT_DOMAINS.filter((d) => LEVEL_ORDER[planProfileForDomain(currentPlan, d)] > LEVEL_ORDER[planProfileForDomain(plan, d)])
    : [];

  return (
    <SplitStepModal eyebrow={t("subscription.downgradeWizardEyebrow")} onClose={onClose} closeLabel={t("subscription.close")}
      headline={t("subscription.downgradeConfirmHeadline", { plan: plan.name })} description={t("subscription.downgradeConfirmSub")}>
      {lost.length > 0 && (
        <>
          <p className="lw-bill__wizardlabel">{t("subscription.downgradeLose")}</p>
          <ul className="lw-bill__partinglist">
            {lost.map((d) => (
              <li key={d}>{domainLabel(t, d)}: {levelLabel(t, planProfileForDomain(currentPlan, d))} → {levelLabel(t, planProfileForDomain(plan, d))}</li>
            ))}
          </ul>
        </>
      )}
      <p className="lw-bill__changenote">{t("subscription.downgradeEffective", { date: fmtDate(subscription.currentPeriodEnd) })}</p>
      <div className="lw-bill__total">
        <span>{t("subscription.totalPrice")}</span>
        <strong>{price} {plan.currency} {isAnnual ? t("subscription.perYear") : t("subscription.perMonth")}</strong>
      </div>
      <div className="lw-bill__wizardactions">
        <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onClose}>{t("subscription.keepCurrentPlan")}</button>
        <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={onConfirm}>
          {busy ? <LoaderCircle size={14} className="lw-bill__spin" /> : t("subscription.confirmDowngrade")}
        </button>
      </div>
    </SplitStepModal>
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

  .lw-bill__entcard {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px;
    margin-bottom: 16px;
    position: relative;
  }
  /* Notebook theme: dog-eared page corner (2026-08-15). */
  .lw-bill__entcard::after {
    content: ""; position: absolute; top: 0; inset-inline-end: 0; width: 0; height: 0;
    border-style: solid; border-width: 0 14px 14px 0;
    border-color: transparent var(--surface-2) transparent transparent;
    filter: drop-shadow(-1px 1px 1.5px rgba(0,0,0,0.18));
    pointer-events: none;
  }
  [dir="rtl"] .lw-bill__entcard::after { transform: scaleX(-1); }
  .lw-bill__entcard .lw-bill__sectiontitle { margin-top: 0; }
  .lw-bill__enttable { width: 100%; border-collapse: collapse; font-size: 0.84rem; margin-bottom: 0; }
  .lw-bill__enttable tr { border-top: 1px solid var(--line); }
  .lw-bill__enttable tr:first-child { border-top: none; }
  .lw-bill__enttable th, .lw-bill__enttable td { padding: 7px 0; text-align: start; font-weight: 400; }
  .lw-bill__enttable th { color: var(--ink-soft); white-space: nowrap; padding-inline-end: 14px; }
  .lw-bill__enttable td { color: var(--ink); width: 100%; }

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
  .lw-bill__pill--warn { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); margin-inline-start: 8px; }

  .lw-bill__reactivatebanner {
    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    background: color-mix(in srgb, var(--accent-2) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-2) 30%, transparent);
    border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 16px;
  }
  .lw-bill__reactivatebanner strong { display: block; font-size: 0.92rem; margin-bottom: 2px; }
  .lw-bill__reactivatebanner p { margin: 0; font-size: 0.82rem; color: var(--ink-soft); }
  .lw-bill__reactivatebanneractions { display: flex; gap: 8px; flex-shrink: 0; }

  .lw-bill__sectiontitle { font-size: 0.98rem; margin: 22px 0 10px; }

  .lw-bill__actions { margin-top: 18px; }
  .lw-bill__changenote { font-size: 0.8rem; color: var(--ink-soft); margin: 0 0 10px; max-width: 60ch; }
  .lw-bill__dangerbtn { background: var(--danger); border-color: var(--danger); color: #fff; }

  .lw-bill__wizardlabel { font-size: 0.8rem; color: var(--ink-soft); margin: 0; }
  .lw-bill__partinglist, .lw-bill__reflectlist {
    margin: 0; padding-inline-start: 20px; font-size: 0.86rem; color: var(--ink);
    display: flex; flex-direction: column; gap: 6px;
  }
  .lw-bill__wizardactions { display: flex; gap: 10px; align-items: center; margin-top: auto; padding-top: 4px; }
  .lw-bill__wizardactions--col { flex-direction: column; align-items: stretch; }
  .lw-bill__textlink {
    background: none; border: none; color: var(--ink-soft); font-size: 0.82rem;
    cursor: pointer; text-decoration: underline; padding: 2px 0; align-self: center;
  }

  .lw-bill__reasonoptions { display: flex; flex-direction: column; gap: 8px; }
  .lw-bill__reasonoption { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; }
  .lw-bill__reasonnote {
    width: 100%; min-height: 70px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm);
    background: var(--surface); color: var(--ink); font-family: var(--font-body); font-size: 0.84rem; resize: vertical;
  }

  .lw-bill__successmark {
    width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--accent-2) 18%, transparent); color: var(--accent-2);
  }
  .lw-bill__successlabel {
    font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--accent-2); font-weight: 700; margin: 0;
  }

  .lw-bill__downgradeoffer {
    width: 100%; border: 1px dashed var(--line); border-radius: var(--radius-sm); padding: 10px;
  }
  .lw-bill__downgradelabel { margin: 0 0 8px; font-size: 0.8rem; color: var(--ink-soft); }
  .lw-bill__downgradelist { display: flex; flex-wrap: wrap; gap: 8px; }
  .lw-bill__upgradeblock { margin-top: 22px; }

  .lw-bill__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-bill__spin { animation: lwBillSpin 0.9s linear infinite; }
  @keyframes lwBillSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-bill__spin { animation: none; } }

  ${PLAN_PICKER_CARDS_CSS}
  ${CURRENT_PLAN_CARD_CSS}
  ${MODAL_CSS}
  ${SPLIT_STEP_MODAL_CSS}
`;
