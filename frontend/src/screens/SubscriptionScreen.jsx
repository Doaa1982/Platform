import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, X } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";

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

const LEVEL_KEY = { Foundation: "subscription.levelFoundation", Professional: "subscription.levelProfessional", AiPlus: "subscription.levelAiPlus" };
const levelLabel = (t, v) => t(LEVEL_KEY[v] ?? "") || v;

const AI_KEY = { Manual: "subscription.aiManual", Assist: "subscription.aiAssist", CoPilot: "subscription.aiCoPilot" };
const aiLabel = (t, v) => t(AI_KEY[v] ?? "") || v;

const DOMAIN_KEY = { Learning: "subscription.domainLearning", Assessment: "subscription.domainAssessment", Analytics: "subscription.domainAnalytics", Branding: "subscription.domainBranding" };
const domainLabel = (t, v) => t(DOMAIN_KEY[v] ?? "") || v;

const STATUS_KEY = {
  Pending: "subscription.statusPending", Active: "subscription.statusActive", PastDue: "subscription.statusPastDue",
  Grace: "subscription.statusGrace", Suspended: "subscription.statusSuspended",
  Cancelled: "subscription.statusCancelled", Expired: "subscription.statusExpired",
};
const statusLabel = (t, v) => t(STATUS_KEY[v] ?? "") || v;

const LEVEL_ORDER = { Foundation: 0, Professional: 1, AiPlus: 2 };
const ENTITLEMENT_DOMAINS = ["Learning", "Assessment", "Analytics", "Branding"];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "");

/** learningProfile / assessmentProfile / analyticsProfile / brandingProfile — the plan's own field naming. */
function planProfileForDomain(plan, domain) {
  return plan[`${domain.charAt(0).toLowerCase()}${domain.slice(1)}Profile`];
}

/** "Assessment >= Professional" → { domain: "Assessment", level: "Professional" } */
function parseRequirement(raw) {
  if (!raw) return null;
  const [domain, level] = raw.split(">=").map((s) => s.trim());
  return domain && level ? { domain, level } : null;
}

export default function SubscriptionScreen() {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [plans, setPlans] = useState(null);
  const [packs, setPacks] = useState(null);
  const [subscription, setSubscription] = useState(undefined); // undefined = not loaded yet, null = none exists
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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

  async function run(fn) {
    setBusy(true);
    setError(null);
    try { const r = await fn(); await load(); return r; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  if (error && !plans) {
    return <div className="lw-page"><div className="lw-prod__alert"><AlertCircle size={16} /> {error}</div></div>;
  }
  if (!plans || !packs || subscription === undefined) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <div className="lw-prod__loading"><LoaderCircle size={18} className="lw-prod__spin" /> {t("subscription.loading")}</div>
      </div>
    );
  }

  const isLive = subscription && !["Cancelled", "Expired"].includes(subscription.status);
  const currentPlan = subscription ? plans.find((p) => p.code === subscription.planCode) : null;

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{t("subscription.eyebrow")}</div>
      <h1>{isLive ? (currentPlan?.name ?? subscription.planCode) : t("subscription.title")}</h1>
      <p className="lw-sub">
        {t(isLive ? "subscription.lead" : "subscription.pickLead", { workspace: workspace?.name ?? "" })}
      </p>

      {error && <div className="lw-prod__alert"><AlertCircle size={16} /> {error}</div>}

      {isLive
        ? <SubscriptionStatus subscription={subscription} plans={plans} packs={packs} busy={busy}
            onCancel={() => run(() => api.cancelSubscription(session.token, slug))} />
        : <PlanPicker plans={plans} packs={packs} previous={subscription} busy={busy}
            onSubscribe={(body) => run(() => api.checkoutSubscription(session.token, slug, body))} />}
    </div>
  );
}

function PlanPicker({ plans, packs, previous, busy, onSubscribe }) {
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState("Monthly");
  const [configuring, setConfiguring] = useState(null);

  return (
    <div>
      {previous && (
        <div className="lw-bill__notice">
          {t("subscription.previousEndedNote", {
            plan: plans.find((p) => p.code === previous.planCode)?.name ?? previous.planCode,
            date: fmtDate(previous.cancellationEffectiveDate ?? previous.currentPeriodEnd),
          })}
        </div>
      )}

      <div className="lw-bill__cycle" role="tablist">
        <button type="button" role="tab" aria-selected={billingCycle === "Monthly"}
                className={billingCycle === "Monthly" ? "is-active" : ""} onClick={() => setBillingCycle("Monthly")}>
          {t("subscription.billingMonthly")}
        </button>
        <button type="button" role="tab" aria-selected={billingCycle === "Annual"}
                className={billingCycle === "Annual" ? "is-active" : ""} onClick={() => setBillingCycle("Annual")}>
          {t("subscription.billingAnnual")}
        </button>
      </div>

      <div className="lw-bill__plans">
        {plans.map((plan) => (
          <div className="lw-bill__card" key={plan.code}>
            <div className="lw-bill__cardhead">
              <div className="lw-bill__planname">{plan.name}</div>
              <div className="lw-bill__price">
                {billingCycle === "Annual" ? plan.annualPrice : plan.monthlyPrice} {plan.currency}
                <span>{billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}</span>
              </div>
            </div>

            <div className="lw-bill__proplist">
              <span className="lw-bill__proplabel">{t("subscription.tutorCapacity")}</span>
              <span className="lw-bill__propvalue">
                {plan.tutorCapacityMax > plan.tutorCapacityBase
                  ? `${plan.tutorCapacityBase}–${plan.tutorCapacityMax}`
                  : plan.tutorCapacityBase}
              </span>
              <span className="lw-bill__proplabel">{t("subscription.aiCredits")}</span>
              <span className="lw-bill__propvalue">{plan.aiCreditsIncluded.toLocaleString()}</span>
              {ENTITLEMENT_DOMAINS.flatMap((domain) => [
                <span className="lw-bill__proplabel" key={`${domain}-l`}>{domainLabel(t, domain)}</span>,
                <span className="lw-bill__propvalue" key={`${domain}-v`}>{levelLabel(t, planProfileForDomain(plan, domain))}</span>,
              ])}
            </div>

            <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={() => setConfiguring(plan)}>
              {t("subscription.choosePlan")}
            </button>
          </div>
        ))}
      </div>

      {configuring && (
        <ConfigureModal
          plan={configuring} packs={packs} billingCycle={billingCycle} busy={busy}
          onClose={() => setConfiguring(null)}
          onConfirm={(packCodes) => onSubscribe({ planCode: configuring.code, packCodes, billingCycle })
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
    <div className="lw-prod__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lw-prod__panel" onClick={(e) => e.stopPropagation()}>
        <button className="lw-prod__panelclose" onClick={onClose} aria-label={t("subscription.close")}><X size={16} /></button>
        <div className="lw-eyebrow">{t("subscription.configureTitle", { plan: plan.name })}</div>
        <h2 className="lw-prod__panelh2">{plan.name}</h2>

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

        <div className="lw-prod__formactions">
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onClose} disabled={busy}>{t("subscription.close")}</button>
          <button type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={() => onConfirm(selected)}>
            {busy ? <LoaderCircle size={14} className="lw-prod__spin" /> : t("subscription.confirmSubscribe")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionStatus({ subscription, plans, packs, busy, onCancel }) {
  const { t } = useLanguage();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const plan = plans.find((p) => p.code === subscription.planCode);
  const packNames = (subscription.selectedPackCodes ?? [])
    .map((code) => packs.find((p) => p.code === code)?.name ?? code);

  const entitlement = (key, domain) =>
    subscription.entitlements.find((e) => e.key === key && (domain === undefined || e.domain === domain));

  const tutorCapacity = entitlement("capacity:tutors")?.value;
  const aiCredits = entitlement("credits:ai")?.value;

  const invoiceNeedsConfirmation = subscription.currentInvoiceStatus === "Issued" || subscription.currentInvoiceStatus === "Overdue";

  return (
    <div>
      <span className={`lw-bill__pill is-${subscription.status.toLowerCase()}`}>{statusLabel(t, subscription.status)}</span>

      {subscription.status === "Cancelled" && (
        <p className="lw-bill__notice">
          {t("subscription.accessContinuesUntil", { date: fmtDate(subscription.cancellationEffectiveDate) })}
        </p>
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

      <div className="lw-bill__proplist">
        <span className="lw-bill__proplabel">{t("subscription.planLabel")}</span>
        <span className="lw-bill__propvalue">{plan?.name ?? subscription.planCode}</span>

        <span className="lw-bill__proplabel">{t("subscription.addOns")}</span>
        <span className="lw-bill__propvalue">{packNames.length ? packNames.join(", ") : t("subscription.addOnsNone")}</span>

        <span className="lw-bill__proplabel">{t("subscription.billingCycleLabel")}</span>
        <span className="lw-bill__propvalue">
          {subscription.billingCycle === "Annual" ? t("subscription.billingAnnual") : t("subscription.billingMonthly")}
        </span>

        <span className="lw-bill__proplabel">{t("subscription.currentPeriodEndLabel")}</span>
        <span className="lw-bill__propvalue">
          {fmtDate(subscription.status === "Cancelled" ? subscription.cancellationEffectiveDate : subscription.currentPeriodEnd)}
        </span>

        {subscription.status !== "Cancelled" && (
          <>
            <span className="lw-bill__proplabel">{t("subscription.renewalDateLabel")}</span>
            <span className="lw-bill__propvalue">{fmtDate(subscription.renewalDate)}</span>
          </>
        )}
      </div>

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
        <div className="lw-bill__cancelbar">
          {confirmingCancel ? (
            <>
              <span>{t("subscription.cancelConfirmPrompt", { date: fmtDate(subscription.currentPeriodEnd) })}</span>
              <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setConfirmingCancel(false)}>
                {t("subscription.neverMind")}
              </button>
              <button className="lw-btn lw-btn--sm lw-bill__dangerbtn" disabled={busy}
                      onClick={() => { setConfirmingCancel(false); onCancel(); }}>
                {t("subscription.confirmCancel")}
              </button>
            </>
          ) : (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setConfirmingCancel(true)}>
              {t("subscription.cancelSubscription")}
            </button>
          )}
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

  .lw-bill__cycle { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 3px; margin-bottom: 18px; }
  .lw-bill__cycle button {
    border: none; background: transparent; padding: 6px 16px; border-radius: 999px;
    font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; color: var(--ink-soft); cursor: pointer;
  }
  .lw-bill__cycle button.is-active { background: var(--accent); color: #fff; }

  .lw-bill__plans { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; margin-bottom: 8px; }
  .lw-bill__card {
    display: flex; flex-direction: column; gap: 12px;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px;
  }
  .lw-bill__planname { font-weight: 600; font-size: 1rem; }
  .lw-bill__price { font-family: var(--font-display); font-size: 1.4rem; color: var(--accent); }
  .lw-bill__price span { font-family: var(--font-body); font-size: 0.78rem; color: var(--ink-soft); margin-inline-start: 4px; }

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

  .lw-bill__cancelbar { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 0.84rem; color: var(--ink-soft); }
  .lw-bill__dangerbtn { background: var(--danger); border-color: var(--danger); color: #fff; }
`;
