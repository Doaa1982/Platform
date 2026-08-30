import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, ArrowLeft, Zap } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import Modal, { MODAL_CSS } from "../components/Modal";
import SplitStepModal, { SPLIT_STEP_MODAL_CSS } from "../components/SplitStepModal";
import PlanPickerCards, { PLAN_PICKER_CARDS_CSS } from "../components/PlanPickerCards";
import CurrentPlanCard, { CURRENT_PLAN_CARD_CSS } from "../components/CurrentPlanCard";
import {
  levelLabel, aiLabel, domainLabel, LEVEL_ORDER, ENTITLEMENT_DOMAINS, planProfileForDomain, parseRequirement, fmtDate, FREE_PLAN_CODE,
  packGrants, aiLevelForProfile,
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

const PURCHASE_STATUS_KEY = { Pending: "subscription.purchasePending", Paid: "subscription.purchasePaid", Voided: "subscription.purchaseVoided" };
const purchaseStatusLabel = (t, v) => t(PURCHASE_STATUS_KEY[v] ?? "") || v;

/** Solo Free enforces a hard capacity ceiling (ConfigurationService.ResolveAsync)
 * that a capacity-adding pack carried over from a paid plan will almost always
 * blow past — so a downgrade that lands on Free drops every pack rather than
 * resubmitting ones the target plan structurally can't support. */
const packsForDowngrade = (planCode, selectedPackCodes) => (planCode === FREE_PLAN_CODE ? [] : selectedPackCodes);

/** Shared by SubscriptionScreen (Billing overview) and PlansScreen (add-ons +
 * upgrade) — both are separate nav destinations now, not one screen with an
 * internal view toggle, but they read and mutate the same subscription data. */
function useSubscriptionData() {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  const [plans, setPlans] = useState(null);
  const [packs, setPacks] = useState(null);
  const [subscription, setSubscription] = useState(undefined); // undefined = not loaded yet, null = none exists
  const [creditTiers, setCreditTiers] = useState(null);
  const [creditPurchases, setCreditPurchases] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(
    () => Promise.all([
      api.getCommercialPlans(),
      api.getCommercialPacks(),
      api.getSubscription(session.token, slug).catch((e) => (e.status === 404 ? null : Promise.reject(e))),
      api.getCreditPackTiers(),
      api.getCreditPurchases(session.token, slug),
    ]),
    [session.token, slug]);

  const load = useCallback(
    () => fetchAll().then(([p, k, s, ct, cp]) => {
      setPlans(p); setPacks(k); setSubscription(s); setCreditTiers(ct); setCreditPurchases(cp); setError(null);
    }).catch((e) => setError(e.message)),
    [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(([p, k, s, ct, cp]) => {
        if (!cancelled) { setPlans(p); setPacks(k); setSubscription(s); setCreditTiers(ct); setCreditPurchases(cp); setError(null); }
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [fetchAll]);

  async function run(fn, successMessage, onDone) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (successMessage) setSuccess(successMessage);
      await load();
      onDone?.();
      return r;
    }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  return { session, workspace, slug, plans, packs, subscription, creditTiers, creditPurchases, error, success, setSuccess, busy, run };
}

export default function SubscriptionScreen() {
  const { t } = useLanguage();
  const { session, workspace, slug, plans, packs, subscription, error, success, busy, run } = useSubscriptionData();
  // Explicit "I want to pick a new plan" while the old one is Cancelled but
  // still within its paid grace period (SUB-004) — the backend already
  // permits checkout in that state (it only blocks Active/PastDue/Grace/
  // Suspended), so this is purely a frontend view toggle, not a new
  // capability. Reset after every mutating action completes so a stale "yes"
  // can't resurface after a later cancel.
  const [resubscribing, setResubscribing] = useState(false);

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

      {showPicker ? (
        <PlanPicker plans={plans} packs={packs} previous={subscription} busy={busy}
          onBack={isLive ? () => setResubscribing(false) : undefined}
          onSubscribe={(body) => run(() => api.checkoutSubscription(session.token, slug, body),
            t("subscription.toastSubscribed", { plan: plans.find((p) => p.code === body.planCode)?.name ?? body.planCode }),
            () => setResubscribing(false))} />
      ) : (
        <BillingOverview subscription={subscription} plans={plans} packs={packs} busy={busy}
          onResubscribe={subscription.status === "Cancelled" ? () => setResubscribing(true) : undefined}
          onDowngrade={(planCode) => run(() => api.downgradeSubscription(session.token, slug, planCode, packsForDowngrade(planCode, subscription.selectedPackCodes)),
            t("subscription.toastDowngradeScheduled", { plan: plans.find((p) => p.code === planCode)?.name ?? planCode }))}
          onCancelPendingChange={() => run(() => api.cancelPendingSubscriptionChange(session.token, slug), t("subscription.toastPendingChangeCancelled"))}
          onCancelRequestedChange={() => run(() => api.cancelRequestedSubscriptionChange(session.token, slug), t("subscription.toastRequestedChangeCancelled"))}
          onReactivate={() => run(() => api.reactivateSubscription(session.token, slug), t("subscription.toastReactivated"))} />
      )}
    </div>
  );
}

/** The other Billing nav destination — add-ons and plan upgrade, both "get
 * more" actions kept off the read-only overview above. AI credits are a
 * separate one-time top-up rather than a recurring plan/pack change, so they
 * have their own nav item (AiCreditsScreen) rather than living in this tab set. */
export function PlansScreen() {
  const { t } = useLanguage();
  const {
    session, workspace, slug, plans, packs, subscription, error, success, setSuccess, busy, run,
  } = useSubscriptionData();

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

  const isLive = subscription && subscription.licenseStatus !== "Expired";
  const currentPlan = subscription ? plans.find((p) => p.code === subscription.planCode) : null;

  return (
    <div className="lw-page lw-page--wide">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{t("subscription.plansPageEyebrow")}</div>
      <h1>{t("subscription.plansPageTitle")}</h1>
      <p className="lw-sub">{t("subscription.plansPageLead", { workspace: workspace?.name ?? "" })}</p>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {!isLive || !currentPlan ? (
        <p className="lw-bill__changenote">{t("subscription.noActivePlanNote")}</p>
      ) : (
        <PlansAndAddOns subscription={subscription} plan={currentPlan} plans={plans} packs={packs} busy={busy}
          token={session.token} slug={slug}
          onCancelRequestedChange={() => run(() => api.cancelRequestedSubscriptionChange(session.token, slug), t("subscription.toastRequestedChangeCancelled"))}
          onUpgrade={(planCode) => run(() => api.upgradeSubscription(session.token, slug, planCode, subscription.selectedPackCodes))
            .then((r) => {
              if (r) {
                setSuccess(t("subscription.toastChangeRequested", {
                  plan: plans.find((p) => p.code === planCode)?.name ?? planCode,
                  amount: r.currentInvoiceAmount ?? 0, currency: r.currentInvoiceCurrency ?? "",
                }));
              }
              return r;
            })}
          onDowngrade={(planCode) => run(() => api.downgradeSubscription(session.token, slug, planCode, packsForDowngrade(planCode, subscription.selectedPackCodes)),
            t("subscription.toastDowngradeScheduled", { plan: plans.find((p) => p.code === planCode)?.name ?? planCode }))}
          onManagePacks={(packCodes) => {
            const isAnnual = subscription.billingCycle === "Annual";
            const packPrice = (pack) => (isAnnual ? pack.monthlyPrice * 10 : pack.monthlyPrice);
            const basePrice = (isAnnual ? currentPlan?.annualPrice : currentPlan?.monthlyPrice) ?? 0;
            const priceFor = (codes) => basePrice + packs.filter((p) => codes.includes(p.code)).reduce((sum, p) => sum + packPrice(p), 0);
            const isUpgrade = priceFor(packCodes) > priceFor(subscription.selectedPackCodes ?? []);
            return run(
              () => (isUpgrade
                ? api.upgradeSubscription(session.token, slug, subscription.planCode, packCodes)
                : api.downgradeSubscription(session.token, slug, subscription.planCode, packCodes)),
              t(isUpgrade ? "subscription.toastAddOnsRequested" : "subscription.toastAddOnsUpdatedScheduled"));
          }} />
      )}
    </div>
  );
}

/** AI credits' own nav destination — a credit top-up isn't the same kind of
 * purchase as a Capability Pack: it's a one-time consumable balance, not a
 * recurring plan/pack change, so it gets its own sidebar item and its own
 * history rather than living inside Add-ons or Add-on history (HistoryModal
 * stays config-change-only; this page's own purchase list is the credits
 * equivalent). */
export function AiCreditsScreen() {
  const { t } = useLanguage();
  const {
    session, slug, subscription, creditTiers, creditPurchases, error, success, busy, run,
  } = useSubscriptionData();
  const [buyingCredits, setBuyingCredits] = useState(null); // the CreditPackTier being confirmed
  const [showHistory, setShowHistory] = useState(false);

  if (error && subscription === undefined) {
    return <div className="lw-page"><Message type="error">{error}</Message></div>;
  }
  if (subscription === undefined || !creditTiers || !creditPurchases) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <div className="lw-bill__loading"><LoaderCircle size={18} className="lw-bill__spin" /> {t("subscription.loading")}</div>
      </div>
    );
  }

  const hasAiDomain = subscription ? hasAnyAiDomain(subscription) : false;
  // Mirrors Add-ons' hasPendingRequest gate — one outstanding request at a
  // time, withdrawable before a Platform Operator acts on it, same mental
  // model as a plan/pack change request even though the underlying object
  // (a CreditPurchaseOrder, not a Subscription snapshot) is unrelated.
  const pendingOrder = creditPurchases.find((p) => p.status === "Pending");
  const onRequestCreditPurchase = (creditPackCode) => run(
    () => api.requestCreditPurchase(session.token, slug, creditPackCode), t("subscription.toastPurchaseRequested"));
  const onCancelPurchase = () => run(
    () => api.cancelCreditPurchase(session.token, slug, pendingOrder.id), t("subscription.toastRequestedChangeCancelled"));

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-bill__tabsrow">
        <div>
          <div className="lw-eyebrow">{t("subscription.aiCreditsPageEyebrow")}</div>
          <h1>{t("subscription.aiCreditsPageTitle")}</h1>
        </div>
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setShowHistory(true)}>
          {t("subscription.viewHistory")}
        </button>
      </div>
      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {pendingOrder && (
        <div className="lw-bill__notice lw-bill__cancellednotice">
          <p>{t("subscription.creditsRequestedNotice", { amount: Number(pendingOrder.creditAmount).toLocaleString() })}</p>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onCancelPurchase}>
            {t("subscription.withdrawRequestAction")}
          </button>
        </div>
      )}

      {/* Only shown when actually blocking the list below — otherwise the
          catalog needs no preamble, same as Add-ons' pack list. */}
      {!hasAiDomain && (
        <p className="lw-bill__changenote">{t("subscription.buyCreditsBlockedNote")}</p>
      )}

      {/* Same lw-bill__pack row styling Add-ons uses for its catalog list —
          the buying mechanism is a one-shot request+confirm, not a persistent
          multi-select like packs, but the catalog should read the same way. */}
      <div className="lw-bill__packlist">
        {creditTiers.map((tier) => (
          <button key={tier.code} type="button"
                  className={`lw-bill__pack lw-bill__pack--credit ${(!hasAiDomain || pendingOrder) ? "is-disabled" : ""}`}
                  disabled={busy || !hasAiDomain || !!pendingOrder} onClick={() => setBuyingCredits(tier)}>
            <Zap size={15} aria-hidden="true" />
            <span className="lw-bill__packname">{Number(tier.creditAmount).toLocaleString()} {t("subscription.aiCreditsUnit")}</span>
            <span className="lw-bill__packprice">{tier.price} {tier.currency}</span>
          </button>
        ))}
      </div>

      {buyingCredits && (
        <BuyCreditsConfirmModal tier={buyingCredits} busy={busy}
          onClose={() => setBuyingCredits(null)}
          onConfirm={() => onRequestCreditPurchase(buyingCredits.code).then((r) => { if (r) setBuyingCredits(null); })} />
      )}

      {showHistory && (
        <CreditHistoryModal purchases={creditPurchases} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

/** Same lw-bill__historytable structure as Add-on history (HistoryModal) —
 * request date included per row, alongside amount/price/status, so this
 * reads the same way as the config-change history table it sits next to. */
function CreditHistoryModal({ purchases, onClose }) {
  const { t } = useLanguage();
  return (
    <Modal onClose={onClose} closeLabel={t("subscription.close")}>
      <div className="lw-eyebrow">{t("subscription.creditsHistoryTitle")}</div>
      <h2 className="lw-modal__title">{t("subscription.creditsHistoryTitle")}</h2>

      {purchases.length === 0 ? (
        <p className="lw-bill__changenote">{t("subscription.creditsHistoryEmpty")}</p>
      ) : (
        <div className="lw-bill__historywrap">
          <table className="lw-bill__historytable">
            <thead>
              <tr>
                <th>{t("subscription.creditsColAmount")}</th>
                <th>{t("subscription.creditsColPrice")}</th>
                <th>{t("subscription.creditsColDate")}</th>
                <th>{t("subscription.creditsColStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>{Number(p.creditAmount).toLocaleString()} {t("subscription.aiCreditsUnit")}</td>
                  <td>{p.priceAmount} {p.priceCurrency}</td>
                  <td>{fmtDate(p.createdAt)}</td>
                  <td><span className={`lw-bill__pill is-${p.status.toLowerCase()}`}>{purchaseStatusLabel(t, p.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
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
        plans={plans} packs={packs} disabled={busy} layout="carousel"
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
        <strong>
          {total === 0
            ? t("subscription.free")
            : <>{total} {plan.currency} {billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}</>}
        </strong>
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

/** Shared by BillingOverview and the Add-ons tab — true once any capability
 * domain resolves above Manual, i.e. an AI credit balance is actually
 * spendable. Checked against an explicit Assist/CoPilot value, not just
 * "isn't Manual" — a Pending subscription (invoice unconfirmed) has no
 * entitlement rows at all yet, and "missing" must read as "no AI", not as
 * "AI is enabled". */
function subscriptionEntitlement(subscription, key, domain) {
  return subscription.entitlements.find((e) => e.key === key && (domain === undefined || e.domain === domain));
}
function hasAnyAiDomain(subscription) {
  return ENTITLEMENT_DOMAINS.some((d) => {
    const level = subscriptionEntitlement(subscription, `ai:${d}`, d)?.value;
    return level === "Assist" || level === "CoPilot";
  });
}

/** "{used}/{total} GB" when the API resolved a usedAmount for this entitlement
 * (tutor/learner seats, video/resource storage) — just the total otherwise. */
function capacityCell(ent, unit = "") {
  if (!ent?.value) return "—";
  const suffix = unit ? ` ${unit}` : "";
  return ent.usedAmount != null ? `${ent.usedAmount}/${ent.value}${suffix}` : `${ent.value}${suffix}`;
}

/** What a pack actually grants, as plain-text pieces — "Learning: AI+ (Co-Pilot)",
 * "+1 tutors" — so a tutor can see what they'd get before checking the box,
 * not just what it costs. */
function packBenefits(t, pack) {
  const parts = packGrants(pack).map(({ domain, level }) =>
    `${domainLabel(t, domain)}: ${levelLabel(t, level)} (${aiLabel(t, aiLevelForProfile(level))})`);
  if (pack.extraTutorCapacity > 0) parts.push(`+${pack.extraTutorCapacity} ${t("subscription.tutorCapacity")}`);
  if (pack.extraLearnerCapacity > 0) parts.push(`+${pack.extraLearnerCapacity} ${t("subscription.learnerCapacity")}`);
  if (pack.extraVideoStorageGb > 0) parts.push(`+${pack.extraVideoStorageGb}GB ${t("subscription.videoStorage")}`);
  if (pack.extraResourceStorageGb > 0) parts.push(`+${pack.extraResourceStorageGb}GB ${t("subscription.resourceStorage")}`);
  return parts;
}

function BillingOverview({
  subscription, plans, packs, busy, onResubscribe, onDowngrade, onCancelPendingChange, onCancelRequestedChange, onReactivate,
}) {
  const { t } = useLanguage();
  const [downgradeTarget, setDowngradeTarget] = useState(null);

  const plan = plans.find((p) => p.code === subscription.planCode);
  const freePlan = plans.find((p) => p.code === FREE_PLAN_CODE);

  // A pending request always carries a plan code, even one add-ons-only —
  // the config snapshot it points to has to name some plan. Falling back to
  // pendingPacksNote when that plan hasn't actually changed keeps this from
  // reading "You've requested Solo Essential" for a request that only adds
  // a pack on the plan already in place.
  const requestedPlanName = subscription.requestedPlanCode && subscription.requestedPlanCode !== subscription.planCode
    ? (plans.find((p) => p.code === subscription.requestedPlanCode)?.name ?? subscription.requestedPlanCode)
    : null;
  const requestedPackNames = (subscription.requestedPackCodes ?? [])
    .map((code) => packs.find((p) => p.code === code)?.name).filter(Boolean);

  // SUB-004: a Cancelled subscription keeps its License Active until
  // cancellationEffectiveDate — Licensing's licenseStatus is the
  // authoritative "is access still live right now", not the raw status.
  const isLive = subscription.licenseStatus !== "Expired";

  const isAnnual = subscription.billingCycle === "Annual";

  const entitlement = (key, domain) => subscriptionEntitlement(subscription, key, domain);
  const hasAiDomain = hasAnyAiDomain(subscription);

  const tutorCapacityEnt = entitlement("capacity:tutors");
  const learnerCapacityEnt = entitlement("capacity:learners");
  const videoStorageEnt = entitlement("capacity:video-storage-gb");
  const resourceStorageEnt = entitlement("capacity:resource-storage-gb");
  const aiCredits = entitlement("credits:ai")?.value;

  const invoiceNeedsConfirmation = subscription.currentInvoiceStatus === "Issued" || subscription.currentInvoiceStatus === "Overdue";

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

      {subscription.requestedPlanCode && (
        <div className="lw-bill__notice lw-bill__cancellednotice">
          <p>
            {requestedPlanName
              ? t("subscription.requestedChangeNotice", { plan: requestedPlanName })
              : t("subscription.pendingPacksNote", { packs: requestedPackNames.join(", ") })}
          </p>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onCancelRequestedChange}>
            {t("subscription.withdrawRequestAction")}
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
              <td>{capacityCell(tutorCapacityEnt)}</td>
            </tr>
            <tr>
              <th scope="row">{t("subscription.learnerCapacity")}</th>
              <td>{capacityCell(learnerCapacityEnt)}</td>
            </tr>
            <tr>
              <th scope="row">{t("subscription.videoStorage")}</th>
              <td>{capacityCell(videoStorageEnt, "GB")}</td>
            </tr>
            <tr>
              <th scope="row">{t("subscription.resourceStorage")}</th>
              <td>{capacityCell(resourceStorageEnt, "GB")}</td>
            </tr>
            <tr>
              <th scope="row">{t("subscription.aiCredits")}</th>
              <td>{aiCredits ? Number(aiCredits).toLocaleString() : "—"}</td>
            </tr>
            <tr>
              <th scope="row">{t("subscription.aiCreditsRemaining")}</th>
              <td>
                {Number(subscription.aiCreditsRemaining ?? 0).toLocaleString()}
                {!hasAiDomain && subscription.aiCreditsRemaining > 0 && (
                  <span className="lw-bill__creditsunusable"> — {t("subscription.creditsUnusableInline")}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* The platform has no separate "cancel" concept anymore — every workspace
          always has a subscription, Solo Free at minimum. Backing out of a paid
          plan is just a downgrade to Free, using the exact same scheduled-change
          mechanism (and "never mind" undo) as switching to any other cheaper plan. */}
      {subscription.status === "Active" && subscription.planCode !== FREE_PLAN_CODE && freePlan && (
        <div className="lw-bill__actions">
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setDowngradeTarget(freePlan)}>
            {t("subscription.downgradeToFreeAction")}
          </button>
        </div>
      )}

      {downgradeTarget && (
        <DowngradeConfirmModal plan={downgradeTarget} currentPlan={plan} subscription={subscription} packs={packs} busy={busy} isAnnual={isAnnual}
          onClose={() => setDowngradeTarget(null)}
          onConfirm={() => onDowngrade(downgradeTarget.code).then((r) => { if (r) setDowngradeTarget(null); })} />
      )}
    </div>
  );
}

function PlansAndAddOns({
  subscription, plan, plans, packs, busy, token, slug, onCancelRequestedChange, onUpgrade, onDowngrade, onManagePacks,
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState("addons"); // "addons" | "plans"
  const [upgradeTarget, setUpgradeTarget] = useState(null);
  const [downgradeTarget, setDowngradeTarget] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const isAnnual = subscription.billingCycle === "Annual";

  // A second Upgrade/Save while one request is already awaiting confirmation
  // silently supersedes it (the backend voids the stale invoice and replaces
  // it) — surfaced here instead of leaving that invisible, and blocked until
  // withdrawn so a tutor can't accidentally swap out what they already asked for.
  const hasPendingRequest = !!subscription.requestedPlanCode;
  const requestedPlanName = subscription.requestedPlanCode !== subscription.planCode
    ? (plans.find((p) => p.code === subscription.requestedPlanCode)?.name ?? subscription.requestedPlanCode)
    : null;
  const requestedPackNames = (subscription.requestedPackCodes ?? [])
    .map((code) => packs.find((p) => p.code === code)?.name).filter(Boolean);

  return (
    <div>
      <div className="lw-bill__tabsrow">
        <div className="lw-bill__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "addons"} className={tab === "addons" ? "is-active" : ""}
                  onClick={() => setTab("addons")}>
            {t("subscription.manageAddOnsTitle")}
          </button>
          <button type="button" role="tab" aria-selected={tab === "plans"} className={tab === "plans" ? "is-active" : ""}
                  onClick={() => setTab("plans")}>
            {t("subscription.plansTabLabel")}
          </button>
        </div>
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setShowHistory(true)}>
          {t("subscription.viewHistory")}
        </button>
      </div>

      {hasPendingRequest && (
        <div className="lw-bill__notice lw-bill__cancellednotice">
          <p>
            {requestedPlanName
              ? t("subscription.requestedChangeNotice", { plan: requestedPlanName })
              : t("subscription.pendingPacksNote", { packs: requestedPackNames.join(", ") })}
            {" "}{t("subscription.pendingBlocksNewRequest")}
          </p>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onCancelRequestedChange}>
            {t("subscription.withdrawRequestAction")}
          </button>
        </div>
      )}

      {tab === "addons" && (
        <AddOnsTab plan={plan} packs={packs} billingCycle={subscription.billingCycle}
          currentPackCodes={subscription.selectedPackCodes ?? []} busy={busy} disabled={hasPendingRequest}
          onSave={onManagePacks} />
      )}

      {tab === "plans" && (
        <PlansTab plans={plans} currentPlanCode={subscription.planCode} requestedPlanCode={subscription.requestedPlanCode}
          busy={busy} disabled={hasPendingRequest}
          billingCycle={subscription.billingCycle} onUpgrade={setUpgradeTarget} onDowngrade={setDowngradeTarget} />
      )}

      {upgradeTarget && (
        <UpgradeConfirmModal plan={upgradeTarget} currentPlan={plan} busy={busy} isAnnual={isAnnual}
          onClose={() => setUpgradeTarget(null)}
          onConfirm={() => onUpgrade(upgradeTarget.code).then((r) => { if (r) setUpgradeTarget(null); })} />
      )}

      {downgradeTarget && (
        <DowngradeConfirmModal plan={downgradeTarget} currentPlan={plan} subscription={subscription} packs={packs} busy={busy} isAnnual={isAnnual}
          onClose={() => setDowngradeTarget(null)}
          onConfirm={() => onDowngrade(downgradeTarget.code).then((r) => { if (r) setDowngradeTarget(null); })} />
      )}

      {showHistory && (
        <HistoryModal token={token} slug={slug} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

function AddOnsTab({ plan, packs, billingCycle, currentPackCodes, busy, disabled, onSave }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(currentPackCodes);

  const togglePack = (code) => setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));
  const packPrice = (pack) => (billingCycle === "Annual" ? pack.monthlyPrice * 10 : pack.monthlyPrice);

  const basePrice = billingCycle === "Annual" ? plan.annualPrice : plan.monthlyPrice;
  const addOnsPriceFor = (codes) => packs.filter((p) => codes.includes(p.code)).reduce((sum, p) => sum + packPrice(p), 0);
  const priceFor = (codes) => basePrice + addOnsPriceFor(codes);
  const addOnsPrice = addOnsPriceFor(selected);
  const total = priceFor(selected);
  const changed = selected.length !== currentPackCodes.length || selected.some((c) => !currentPackCodes.includes(c));
  const isUpgrade = total > priceFor(currentPackCodes);

  return (
    <div className="lw-bill__tabpanel">
      <p className="lw-bill__changenote">{t("subscription.manageAddOnsNote")}</p>

      <div className="lw-bill__packlist">
        {packs.map((pack) => {
          const req = parseRequirement(pack.requiresMinProfile);
          const unmet = req && LEVEL_ORDER[planProfileForDomain(plan, req.domain)] < LEVEL_ORDER[req.level];
          const benefits = packBenefits(t, pack);
          return (
            <label key={pack.code} className={`lw-bill__pack ${unmet ? "is-disabled" : ""}`}>
              <input type="checkbox" checked={selected.includes(pack.code)} disabled={busy || disabled || unmet}
                     onChange={() => togglePack(pack.code)} />
              <span className="lw-bill__packname">{pack.name}</span>
              <span className="lw-bill__packprice">+{packPrice(pack)} {pack.currency}</span>
              {benefits.length > 0 && (
                <span className="lw-bill__packbenefits">{t("subscription.packBenefitsLabel")}: {benefits.join(" · ")}</span>
              )}
              {req && (
                <span className="lw-bill__packnote">
                  {t("subscription.packRequires", { domain: domainLabel(t, req.domain), level: levelLabel(t, req.level) })}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* Broken into plan + add-ons rather than one bare "Total" — a tutor
          landing here with no add-ons selected was seeing their plan's own
          price under "Total" and reasonably reading it as an add-ons charge. */}
      <div className="lw-bill__totalbreakdown">
        <div className="lw-bill__total lw-bill__total--line">
          <span>{t("subscription.planLabel")}</span>
          <span>{basePrice === 0 ? t("subscription.free") : <>{basePrice} {plan.currency} {billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}</>}</span>
        </div>
        <div className="lw-bill__total lw-bill__total--line">
          <span>{t("subscription.addOns")}</span>
          <span>{addOnsPrice === 0 ? t("subscription.addOnsNone") : <>+{addOnsPrice} {plan.currency}</>}</span>
        </div>
        <div className="lw-bill__total">
          <span>{t("subscription.totalPrice")}</span>
          <strong>
            {total === 0
              ? t("subscription.free")
              : <>{total} {plan.currency} {billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}</>}
          </strong>
        </div>
      </div>

      {changed && (
        <p className="lw-bill__changenote">
          {t(isUpgrade ? "subscription.addOnsAppliedImmediately" : "subscription.addOnsScheduled")}
        </p>
      )}

      <div className="lw-bill__tabpanelactions">
        <button type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || disabled || !changed} onClick={() => onSave(selected)}>
          {busy ? <LoaderCircle size={14} className="lw-bill__spin" /> : t(isUpgrade ? "subscription.saveAddOnsRequest" : "subscription.saveAddOnsConfirm")}
        </button>
      </div>

    </div>
  );
}

function PlansTab({ plans, currentPlanCode, requestedPlanCode, busy, disabled, billingCycle, onUpgrade, onDowngrade }) {
  const { t } = useLanguage();

  if (plans.length === 0) {
    return <p className="lw-bill__changenote lw-bill__tabpanel">{t("subscription.noPlansAvailable")}</p>;
  }

  return (
    <div className="lw-bill__tabpanel lw-bill__tabpanel--wide">
      {/* All plans in one carousel — current plan badged, cheaper ones offer
          Downgrade, pricier ones Upgrade — so switching either direction
          lives here instead of downgrade being reachable only via Cancel.
          Unlike the Add-ons tab's text rows, this wants the full page width
          rather than the shared 640px reading-column cap. */}
      <PlanPickerCards plans={plans} packs={null} disabled={busy || disabled} layout="carousel"
        billingCycle={billingCycle} mode="manage" currentPlanCode={currentPlanCode} requestedPlanCode={requestedPlanCode}
        onChoosePlan={onUpgrade} onDowngrade={onDowngrade} />
    </div>
  );
}

/** One row's "what changed" — only the fields that actually differ, so a
 * pack that only touches storage doesn't show five unchanged numbers. */
function historyChangeSummary(t, e) {
  const parts = [];
  if (e.tutorCapacityBefore !== e.tutorCapacityAfter)
    parts.push(`${t("subscription.tutorCapacity")}: ${e.tutorCapacityBefore} → ${e.tutorCapacityAfter}`);
  if (e.learnerCapacityBefore !== e.learnerCapacityAfter)
    parts.push(`${t("subscription.learnerCapacity")}: ${e.learnerCapacityBefore} → ${e.learnerCapacityAfter}`);
  if (e.videoStorageGbBefore !== e.videoStorageGbAfter)
    parts.push(`${t("subscription.videoStorage")}: ${e.videoStorageGbBefore}GB → ${e.videoStorageGbAfter}GB`);
  if (e.resourceStorageGbBefore !== e.resourceStorageGbAfter)
    parts.push(`${t("subscription.resourceStorage")}: ${e.resourceStorageGbBefore}GB → ${e.resourceStorageGbAfter}GB`);
  if (e.aiCreditsIncludedBefore !== e.aiCreditsIncludedAfter)
    parts.push(`${t("subscription.aiCredits")}: ${e.aiCreditsIncludedBefore} → ${e.aiCreditsIncludedAfter}`);
  return parts.join(" · ");
}

function HistoryModal({ token, slug, onClose }) {
  const { t } = useLanguage();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getSubscriptionHistory(token, slug)
      .then((rows) => { if (!cancelled) setEntries(rows); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token, slug]);

  return (
    <Modal onClose={onClose} closeLabel={t("subscription.close")}>
      <div className="lw-eyebrow">{t("subscription.historyTitle")}</div>
      <h2 className="lw-modal__title">{t("subscription.historyTitle")}</h2>

      {error && <Message type="error">{error}</Message>}
      {!entries && !error && (
        <div className="lw-bill__loading"><LoaderCircle size={16} className="lw-bill__spin" /> {t("subscription.loading")}</div>
      )}
      {entries && entries.length === 0 && <p className="lw-bill__changenote">{t("subscription.historyEmpty")}</p>}

      {entries && entries.length > 0 && (
        <div className="lw-bill__historywrap">
          <table className="lw-bill__historytable">
            <thead>
              <tr>
                <th>{t("subscription.historyAddOn")}</th>
                <th>{t("subscription.historyChange")}</th>
                <th>{t("subscription.historyDate")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td>
                    {e.addedPackNames.map((n) => <div key={`+${n}`}>+{n}</div>)}
                    {e.removedPackNames.map((n) => <div key={`-${n}`}>−{n}</div>)}
                  </td>
                  <td>{historyChangeSummary(t, e)}</td>
                  <td>{fmtDate(e.confirmedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="lw-modal__actions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onClose}>{t("subscription.close")}</button>
      </div>
    </Modal>
  );
}

function BuyCreditsConfirmModal({ tier, busy, onClose, onConfirm }) {
  const { t } = useLanguage();
  return (
    <Modal onClose={onClose} closeLabel={t("subscription.close")}>
      <div className="lw-eyebrow">{t("subscription.buyCreditsTitle")}</div>
      <h2 className="lw-modal__title">{Number(tier.creditAmount).toLocaleString()} {t("subscription.aiCreditsUnit")}</h2>
      <p className="lw-bill__changenote">{t("subscription.buyCreditsConfirmNote")}</p>

      <div className="lw-bill__total">
        <span>{t("subscription.totalPrice")}</span>
        <strong>{tier.price} {tier.currency}</strong>
      </div>

      <div className="lw-modal__actions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onClose} disabled={busy}>{t("subscription.close")}</button>
        <button type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={onConfirm}>
          {busy ? <LoaderCircle size={14} className="lw-bill__spin" /> : t("subscription.confirmBuyCredits")}
        </button>
      </div>
    </Modal>
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

function DowngradeConfirmModal({ plan, currentPlan, subscription, packs, busy, isAnnual, onClose, onConfirm }) {
  const { t } = useLanguage();
  const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
  const lost = currentPlan
    ? ENTITLEMENT_DOMAINS.filter((d) => LEVEL_ORDER[planProfileForDomain(currentPlan, d)] > LEVEL_ORDER[planProfileForDomain(plan, d)])
    : [];
  // Solo Free enforces a hard capacity ceiling that a carried-over pack would
  // almost always exceed, so packsForDowngrade() drops every pack once the
  // target is Free — surfaced here so that isn't a silent surprise.
  const droppedPackNames = plan.code === FREE_PLAN_CODE
    ? (subscription.selectedPackCodes ?? []).map((code) => packs?.find((p) => p.code === code)?.name).filter(Boolean)
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
      {droppedPackNames.length > 0 && (
        <p className="lw-bill__changenote">{t("subscription.downgradeDropsAddOns", { packs: droppedPackNames.join(", ") })}</p>
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
  .lw-bill__packbenefits { grid-column: 2 / -1; font-size: 0.76rem; color: var(--ink-soft); }
  .lw-bill__packnote { grid-column: 2 / -1; font-size: 0.76rem; color: var(--danger); }

  .lw-bill__total {
    display: flex; justify-content: space-between; align-items: baseline;
    border-top: 1px solid var(--line); padding-top: 12px; margin-bottom: 6px; font-size: 0.9rem;
  }
  .lw-bill__totalbreakdown { border-top: 1px solid var(--line); padding-top: 4px; margin-bottom: 6px; }
  .lw-bill__totalbreakdown .lw-bill__total { border-top: none; padding-top: 8px; margin-bottom: 0; }
  .lw-bill__total--line { font-size: 0.78rem; color: var(--ink-soft); }

  .lw-bill__pill {
    font-family: var(--font-mono); font-size: 11px; border-radius: 20px; padding: 4px 11px;
    background: var(--surface-2); color: var(--ink-soft); display: inline-block; margin-bottom: 14px;
  }
  .lw-bill__pill.is-active { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2); }
  .lw-bill__pill.is-pastdue, .lw-bill__pill.is-grace { background: color-mix(in srgb, #E0A83E 20%, transparent); color: #A67519; }
  .lw-bill__pill.is-suspended { background: color-mix(in srgb, var(--danger) 16%, transparent); color: var(--danger); }
  .lw-bill__pill.is-paid { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2); }
  .lw-bill__pill.is-pending { background: color-mix(in srgb, #E0A83E 20%, transparent); color: #A67519; }
  .lw-bill__pill.is-voided { background: color-mix(in srgb, var(--danger) 16%, transparent); color: var(--danger); }
  .lw-bill__pill--warn { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); margin-inline-start: 8px; }

  .lw-bill__creditsunusable { font-size: 0.76rem; color: var(--ink-soft); }
  .lw-bill__pack--credit {
    width: 100%; background: var(--surface); color: var(--ink); font-family: inherit;
  }
  .lw-bill__pack--credit .lw-bill__packprice { color: var(--accent); font-weight: 600; }

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

  .lw-bill__tabsrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  .lw-bill__tabs {
    display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 3px;
  }
  .lw-bill__tabs button {
    border: 1px solid transparent; background: transparent; padding: 7px 18px; border-radius: 999px;
    font-family: var(--font-body); font-size: 0.84rem; font-weight: 600; color: var(--ink-soft); cursor: pointer;
  }
  .lw-bill__tabs button.is-active { background: var(--accent); color: #fff; }
  .lw-bill__tabs button:hover:not(.is-active), .lw-bill__tabs button:focus-visible:not(.is-active) { background: var(--surface-2, rgba(0,0,0,0.05)); }
  .lw-bill__tabpanel { max-width: 640px; }
  .lw-bill__tabpanel--wide { max-width: none; width: 100%; }
  .lw-bill__tabpanelactions { display: flex; justify-content: flex-end; margin-bottom: 6px; }

  /* Plans & add-ons only: the plan carousel wants the full content width
     rather than the shared 880px reading-column cap every other .lw-page uses. */
  .lw-page--wide { max-width: 1180px; }
  @media (max-width: 900px) { .lw-page--wide { max-width: 100%; } }

  .lw-bill__historywrap { overflow-x: auto; max-width: min(90vw, 640px); }
  .lw-bill__historytable { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .lw-bill__historytable th, .lw-bill__historytable td { padding: 8px 10px; text-align: start; vertical-align: top; }
  .lw-bill__historytable thead th { color: var(--ink-soft); font-weight: 600; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .lw-bill__historytable tbody tr { border-top: 1px solid var(--line); }
  .lw-bill__historytable tbody td:first-child { white-space: nowrap; }
  .lw-bill__historytable .lw-bill__pill { margin-bottom: 0; }

  .lw-bill__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-bill__spin { animation: lwBillSpin 0.9s linear infinite; }
  @keyframes lwBillSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-bill__spin { animation: none; } }

  ${PLAN_PICKER_CARDS_CSS}
  ${CURRENT_PLAN_CARD_CSS}
  ${MODAL_CSS}
  ${SPLIT_STEP_MODAL_CSS}
`;
