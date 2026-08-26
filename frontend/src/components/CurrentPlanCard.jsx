import { useLanguage } from "../i18n/useLanguage";
import { domainLabel, levelLabel, aiLabel, aiLevelForProfile, packGrants, fmtDate } from "../i18n/subscriptionLabels";

/* =========================================================================
   CURRENT PLAN CARD — the measured facts about a Workspace's live
   subscription: which plan, what it costs, which add-on packs are
   actually selected (not just named — what each one grants, reusing the
   same catalog-card styling as PlanPickerCards' own add-on list), and the
   start/renewal (or access-until, once cancelled) dates.

   Shared by Workspace Home (a compact teaser wrapped with a "Manage plan"
   button) and Billing (the full detail, wrapped with its own status pill,
   entitlements grid and cancel action) via the children slot — this
   component only ever shows what's true right now, never an action.
   ========================================================================= */
export default function CurrentPlanCard({ plan, packs, subscription, children }) {
  const { t } = useLanguage();
  const ownedPacks = (subscription.selectedPackCodes ?? [])
    .map((code) => packs?.find((p) => p.code === code))
    .filter(Boolean);

  const isCancelled = subscription.status === "Cancelled";
  const price = subscription.billingCycle === "Annual" ? plan?.annualPrice : plan?.monthlyPrice;

  return (
    <div className="lw-plancards__current">
      <div className="lw-plancards__currenthead">
        <span className="lw-plancards__currentname">{plan?.name ?? subscription.planCode}</span>
        {plan && (
          <span className="lw-plancards__currentprice">
            {price === 0
              ? t("subscription.free")
              : <>{price} {plan.currency}
                  <span>{subscription.billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}</span>
                </>}
          </span>
        )}
        <span className="lw-plancards__currentcycle">
          {subscription.billingCycle === "Annual" ? t("subscription.billingAnnual") : t("subscription.billingMonthly")}
        </span>
      </div>

      {ownedPacks.length > 0 && (
        <ul className="lw-plancards__addonlist">
          {ownedPacks.map((pack) => (
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
                {pack.extraLearnerCapacity > 0 && (
                  <li>
                    <span>{t("subscription.learnerCapacity")}</span>
                    <strong>+{pack.extraLearnerCapacity}</strong>
                  </li>
                )}
                {pack.extraVideoStorageGb > 0 && (
                  <li>
                    <span>{t("subscription.videoStorage")}</span>
                    <strong>+{pack.extraVideoStorageGb} GB</strong>
                  </li>
                )}
                {pack.extraResourceStorageGb > 0 && (
                  <li>
                    <span>{t("subscription.resourceStorage")}</span>
                    <strong>+{pack.extraResourceStorageGb} GB</strong>
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="lw-plancards__currentdates">
        <div className="lw-plancards__currentrow">
          <span className="lw-plancards__currentlabel">{t("subscription.startDateLabel")}</span>
          <span>{fmtDate(subscription.startDate)}</span>
        </div>
        <div className="lw-plancards__currentrow">
          <span className="lw-plancards__currentlabel">
            {isCancelled ? t("subscription.accessUntilLabel") : t("subscription.renewalDateLabel")}
          </span>
          <span>{fmtDate(isCancelled ? subscription.cancellationEffectiveDate : subscription.renewalDate)}</span>
        </div>
      </div>

      {children}
    </div>
  );
}

export const CURRENT_PLAN_CARD_CSS = `
  .lw-plancards__current {
    display: flex; flex-direction: column; gap: 14px; align-items: flex-start;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px;
  }
  .lw-plancards__currenthead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .lw-plancards__currentname { font-family: var(--font-display); font-size: 1.2rem; }
  .lw-plancards__currentprice { font-family: var(--font-display); font-size: 1.1rem; color: var(--accent); }
  .lw-plancards__currentprice span { font-family: var(--font-body); font-size: 0.76rem; color: var(--ink-soft); margin-inline-start: 3px; }
  .lw-plancards__currentcycle {
    font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft);
    background: var(--surface-2); border-radius: 20px; padding: 3px 10px;
  }
  .lw-plancards__currentdates { display: flex; gap: 24px; flex-wrap: wrap; }
  .lw-plancards__currentrow { display: flex; gap: 6px; font-size: 0.84rem; }
  .lw-plancards__currentlabel { color: var(--ink-soft); }
`;
