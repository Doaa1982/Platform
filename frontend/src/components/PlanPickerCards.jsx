import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import {
  levelLabel, aiLabel, domainLabel, ENTITLEMENT_DOMAINS, planProfileForDomain,
  aiLevelForProfile, parseRequirement, packGrants,
} from "../i18n/subscriptionLabels";

/* =========================================================================
   PLAN PICKER CARDS — the Shopify-style plan comparison grid, shared by
   every surface that lets someone browse the Solo catalog: the public
   Landing page teaser, the Workspace Home teaser, and Billing's own plan
   picker. One component so all three stay in lock-step instead of
   drifting into three slightly different renderings of the same catalog
   data (which is exactly what started happening before this extraction).

   Deliberately just the grid + cycle toggle + informational add-on
   catalog — never the checkout itself. What happens when a plan is
   chosen (navigate elsewhere, open a pack-configuration step, ...) is
   entirely up to the caller via onChoosePlan(plan, billingCycle).

   title/lead are optional: pass them where this grid needs its own
   section heading (Landing, Workspace Home); omit them where the page
   around it already has one (Billing already has its own <h1>/lead).
   ========================================================================= */
export default function PlanPickerCards({ plans, packs, title, lead, onChoosePlan, disabled }) {
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState("Monthly");

  return (
    <div className="lw-plancards">
      <div className="lw-plancards__head">
        {(title || lead) && (
          <div>
            {title && <h2 className="lw-sectiontitle">{title}</h2>}
            {lead && <p className="lw-plancards__lead">{lead}</p>}
          </div>
        )}
        <div className="lw-plancards__cycle" role="tablist">
          <button type="button" role="tab" aria-selected={billingCycle === "Monthly"}
                  className={billingCycle === "Monthly" ? "is-active" : ""} onClick={() => setBillingCycle("Monthly")}>
            {t("subscription.billingMonthly")}
          </button>
          <button type="button" role="tab" aria-selected={billingCycle === "Annual"}
                  className={billingCycle === "Annual" ? "is-active" : ""} onClick={() => setBillingCycle("Annual")}>
            {t("subscription.billingAnnual")}
          </button>
        </div>
      </div>

      <div className="lw-plancards__grid">
        {plans.map((plan) => (
          <div className="lw-plancards__card" key={plan.code}>
            <div className="lw-plancards__name">{plan.name}</div>
            <div className="lw-plancards__price">
              {billingCycle === "Annual" ? plan.annualPrice : plan.monthlyPrice} {plan.currency}
              <span>{billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}</span>
            </div>

            <ul className="lw-plancards__features">
              <li><span>{t("subscription.tutorCapacity")}</span>
                <strong>
                  {plan.tutorCapacityMax > plan.tutorCapacityBase
                    ? `${plan.tutorCapacityBase}–${plan.tutorCapacityMax}` : plan.tutorCapacityBase}
                </strong>
              </li>
              <li><span>{t("subscription.aiCredits")}</span><strong>{plan.aiCreditsIncluded.toLocaleString()}</strong></li>
              {ENTITLEMENT_DOMAINS.map((domain) => {
                const level = planProfileForDomain(plan, domain);
                return (
                  <li key={domain}>
                    <span>{domainLabel(t, domain)}</span>
                    <strong>
                      {levelLabel(t, level)}
                      <em className="lw-plancards__aitag">{aiLabel(t, aiLevelForProfile(level))}</em>
                    </strong>
                  </li>
                );
              })}
            </ul>

            <button className="lw-btn lw-btn--sm lw-btn--accent" disabled={disabled}
                    onClick={() => onChoosePlan(plan, billingCycle)}>
              {t("subscription.choosePlan")} <ArrowRight size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Same catalog regardless of which plan is chosen (only AI Assessment
          carries a dependency) — shown once under the grid rather than per card. */}
      {packs && packs.length > 0 && (
        <div className="lw-plancards__addons">
          <h3 className="lw-plancards__addonstitle">{t("subscription.addOns")}</h3>
          <ul className="lw-plancards__addonlist">
            {packs.map((pack) => {
              const req = parseRequirement(pack.requiresMinProfile);
              return (
                <li className="lw-plancards__addon" key={pack.code}>
                  <div className="lw-plancards__addonhead">
                    <span className="lw-plancards__addonname">{pack.name}</span>
                    <span className="lw-plancards__addonprice">
                      +{pack.monthlyPrice} {pack.currency}<span>{t("subscription.perMonth")}</span>
                    </span>
                  </div>
                  <ul className="lw-plancards__addongrants">
                    {packGrants(pack).map(({ domain, level }) => (
                      <li key={domain}>
                        <span>{domainLabel(t, domain)}</span>
                        <strong>
                          {levelLabel(t, level)}
                          <em className="lw-plancards__aitag">{aiLabel(t, aiLevelForProfile(level))}</em>
                        </strong>
                      </li>
                    ))}
                    {pack.extraTutorCapacity > 0 && (
                      <li>
                        <span>{t("subscription.tutorCapacity")}</span>
                        <strong>+{pack.extraTutorCapacity}</strong>
                      </li>
                    )}
                  </ul>
                  {req && (
                    <span className="lw-plancards__addonnote">
                      {t("subscription.packRequires", { domain: domainLabel(t, req.domain), level: levelLabel(t, req.level) })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export const PLAN_PICKER_CARDS_CSS = `
  .lw-plancards { margin-bottom: 26px; }
  .lw-plancards__head {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
    flex-wrap: wrap; margin-bottom: 14px;
  }
  .lw-plancards__head .lw-sectiontitle { margin: 0; }
  .lw-plancards__lead { font-size: 0.85rem; color: var(--ink-soft); margin: 4px 0 0; max-width: 60ch; }

  .lw-plancards__cycle {
    display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 3px;
    flex-shrink: 0; margin-inline-start: auto;
  }
  .lw-plancards__cycle button {
    border: none; background: transparent; padding: 6px 16px; border-radius: 999px;
    font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; color: var(--ink-soft); cursor: pointer;
  }
  .lw-plancards__cycle button.is-active { background: var(--accent); color: #fff; }

  .lw-plancards__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .lw-plancards__card {
    display: flex; flex-direction: column; gap: 12px;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px;
  }
  .lw-plancards__name { font-weight: 600; font-size: 1rem; }
  .lw-plancards__price { font-family: var(--font-display); font-size: 1.35rem; color: var(--accent); }
  .lw-plancards__price span { font-family: var(--font-body); font-size: 0.76rem; color: var(--ink-soft); margin-inline-start: 4px; }

  .lw-plancards__features { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.82rem; }
  .lw-plancards__features li { display: flex; justify-content: space-between; gap: 10px; }
  .lw-plancards__features li span { color: var(--ink-soft); }
  .lw-plancards__features li strong { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
  .lw-plancards__aitag { font-style: normal; font-size: 0.68rem; font-weight: 600; color: var(--ink-soft); }

  .lw-plancards__card .lw-btn { justify-content: center; gap: 6px; margin-top: 4px; }

  .lw-plancards__addons { margin-top: 22px; }
  .lw-plancards__addonstitle { font-size: 0.92rem; font-weight: 700; margin: 0 0 12px; }
  .lw-plancards__addonlist {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;
  }
  .lw-plancards__addon {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;
  }
  .lw-plancards__addonhead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .lw-plancards__addonname { font-weight: 600; font-size: 0.84rem; }
  .lw-plancards__addonprice { font-size: 0.74rem; color: var(--ink-soft); white-space: nowrap; }
  .lw-plancards__addongrants { list-style: none; margin: 2px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; font-size: 0.74rem; }
  .lw-plancards__addongrants li { display: flex; justify-content: space-between; gap: 10px; }
  .lw-plancards__addongrants li span { color: var(--ink-soft); }
  .lw-plancards__addongrants li strong { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
  .lw-plancards__addonnote { font-size: 0.7rem; color: var(--danger); }
`;
