import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import {
  levelLabel, aiLabel, domainLabel, ENTITLEMENT_DOMAINS, planProfileForDomain,
  aiLevelForProfile, parseRequirement, packGrants, capacityValue, capacityUncapped,
} from "../i18n/subscriptionLabels";

/* Cycled by plan index so an N-plan catalog never runs out of colors — same
   gradient a given index gets in the grid layout too, so a plan's color stays
   stable when a caller flips between layout="grid" and layout="carousel". */
const CAROUSEL_GRADIENTS = [
  ["#F7971E", "#F857A6"],
  ["#36D1DC", "#1E5FFF"],
  ["#8E2DE2", "#4A00E0"],
  ["#11998E", "#38EF7D"],
  ["#F953C6", "#B91D73"],
];

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
export default function PlanPickerCards({
  plans, packs, title, lead, onChoosePlan, disabled,
  billingCycle: fixedCycle, mode = "choose", requestedPlanCode,
  layout = "grid", ctaLabel, currentPlanCode, onDowngrade,
}) {
  const { t } = useLanguage();
  const [cycleState, setCycleState] = useState("Monthly");
  // A caller showing an existing subscription's upgrade options already has a
  // committed billing cycle (Upgrade never changes it) — passing one in fixes
  // the display and hides the toggle instead of letting it drift from reality.
  const billingCycle = fixedCycle ?? cycleState;

  return (
    <div className="lw-plancards">
      <div className="lw-plancards__head">
        {(title || lead) && (
          <div>
            {title && <h2 className="lw-sectiontitle">{title}</h2>}
            {lead && <p className="lw-plancards__lead">{lead}</p>}
          </div>
        )}
        {!fixedCycle && (
          <div className="lw-plancards__cycle" role="tablist">
            <button type="button" role="tab" aria-selected={billingCycle === "Monthly"}
                    className={billingCycle === "Monthly" ? "is-active" : ""} onClick={() => setCycleState("Monthly")}>
              {t("subscription.billingMonthly")}
            </button>
            <button type="button" role="tab" aria-selected={billingCycle === "Annual"}
                    className={billingCycle === "Annual" ? "is-active" : ""} onClick={() => setCycleState("Annual")}>
              {t("subscription.billingAnnual")}
            </button>
          </div>
        )}
      </div>

      {layout === "carousel" ? (
        <PlanCarouselGrid plans={plans} mode={mode} requestedPlanCode={requestedPlanCode} disabled={disabled}
                          billingCycle={billingCycle} onChoosePlan={onChoosePlan} ctaLabel={ctaLabel} t={t}
                          currentPlanCode={currentPlanCode} onDowngrade={onDowngrade} />
      ) : (
        <div className="lw-plancards__grid">
          {plans.map((plan) => (
            <div className="lw-plancards__card" key={plan.code}>
              <div className="lw-plancards__name">{plan.name}</div>
              <div className="lw-plancards__price">
                {(billingCycle === "Annual" ? plan.annualPrice : plan.monthlyPrice) === 0
                  ? t("subscription.free")
                  : <>{billingCycle === "Annual" ? plan.annualPrice : plan.monthlyPrice} {plan.currency}
                      <span>{billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}</span>
                    </>}
              </div>

              <ul className="lw-plancards__features">
                <li><span>{t("subscription.tutorCapacity")}</span>
                  <strong>
                    {capacityValue(plan, plan.tutorCapacityBase, plan.tutorCapacityMax)}
                    {capacityUncapped(plan) && <em className="lw-plancards__aitag">{t("subscription.capacityUncapped")}</em>}
                  </strong>
                </li>
                <li><span>{t("subscription.learnerCapacity")}</span>
                  <strong>
                    {capacityValue(plan, plan.learnerCapacityBase, plan.learnerCapacityMax)}
                    {capacityUncapped(plan) && <em className="lw-plancards__aitag">{t("subscription.capacityUncapped")}</em>}
                  </strong>
                </li>
                <li><span>{t("subscription.videoStorage")}</span>
                  <strong>
                    {capacityValue(plan, plan.videoStorageGbBase, plan.videoStorageGbMax, "GB")}
                    {capacityUncapped(plan) && <em className="lw-plancards__aitag">{t("subscription.capacityUncapped")}</em>}
                  </strong>
                </li>
                <li><span>{t("subscription.resourceStorage")}</span>
                  <strong>
                    {capacityValue(plan, plan.resourceStorageGbBase, plan.resourceStorageGbMax, "GB")}
                    {capacityUncapped(plan) && <em className="lw-plancards__aitag">{t("subscription.capacityUncapped")}</em>}
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

              {mode === "upgrade" && plan.code === requestedPlanCode ? (
                <span className="lw-plancards__pending">{t("subscription.pendingBadge")}</span>
              ) : (
                <button className="lw-btn lw-btn--sm lw-btn--accent" disabled={disabled}
                        onClick={() => onChoosePlan(plan, billingCycle)}>
                  {ctaLabel ?? t(mode === "upgrade" ? "subscription.upgradeAction" : "subscription.choosePlan")} <ArrowRight size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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

/* =========================================================================
   PLAN CAROUSEL — layout="carousel": one plan centered and "near" (scaled
   up, full opacity), the rest fanning out to either side "far" (scaled
   down, faded), with drag/swipe, arrow buttons and dot nav to shift focus.
   A separate component (not a branch inline in PlanPickerCards' render) so
   its scroll-tracking hooks stay unconditional regardless of which layout
   the caller picked. ========================================================================= */
function PlanCarouselGrid({
  plans, mode, requestedPlanCode, currentPlanCode, disabled, billingCycle, onChoosePlan, onDowngrade, ctaLabel, t,
}) {
  const trackRef = useRef(null);
  const cardRefs = useRef([]);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  // Requested plan starts focused when one's pending; otherwise the tutor's
  // current plan (mode="manage" shows the whole catalog, so opening on
  // "where you are" beats an arbitrary middle index); otherwise the middle
  // plan, so the carousel never opens on an edge card with nothing to one side.
  const initialIndex = useMemo(() => {
    const requested = plans.findIndex((p) => p.code === requestedPlanCode);
    if (requested >= 0) return requested;
    const current = plans.findIndex((p) => p.code === currentPlanCode);
    if (current >= 0) return current;
    return Math.floor((plans.length - 1) / 2);
  }, [plans, requestedPlanCode, currentPlanCode]);

  const currentPlan = mode === "manage" ? plans.find((p) => p.code === currentPlanCode) : null;
  const currentPrice = currentPlan ? (billingCycle === "Annual" ? currentPlan.annualPrice : currentPlan.monthlyPrice) : null;

  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  // Tracks the initialIndex a render last settled on, so a change to it (e.g.
  // the requested/current plan resolving, or the cycle toggle reshuffling
  // which plans are "pricier") resets focus synchronously during render —
  // same "adjust state during render" pattern usePagination uses — rather
  // than via a setState-in-effect, which would cost an extra render pass.
  const [settledIndex, setSettledIndex] = useState(initialIndex);
  let effectiveFocusedIndex = focusedIndex;
  if (initialIndex !== settledIndex) {
    setSettledIndex(initialIndex);
    setFocusedIndex(initialIndex);
    effectiveFocusedIndex = initialIndex;
  }

  // scrollIntoView only works once the card refs exist post-mount, so this
  // can't be done during render — an imperative DOM action, not derived state.
  useEffect(() => {
    cardRefs.current[initialIndex]?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, [initialIndex]);

  const scrollToIndex = (i) => {
    const clamped = Math.max(0, Math.min(plans.length - 1, i));
    cardRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setFocusedIndex(clamped);
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const dist = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    setFocusedIndex((prev) => (prev === closest ? prev : closest));
  };

  const onMouseDown = (e) => {
    if (!trackRef.current) return;
    drag.current = { active: true, startX: e.clientX, startScroll: trackRef.current.scrollLeft, moved: false };
  };
  const onMouseMove = (e) => {
    if (!drag.current.active || !trackRef.current) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    trackRef.current.scrollLeft = drag.current.startScroll - dx;
  };
  const endDrag = () => { drag.current.active = false; };

  const onCardClick = (i) => {
    if (drag.current.moved) { drag.current.moved = false; return; }
    if (i !== effectiveFocusedIndex) scrollToIndex(i);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); scrollToIndex(effectiveFocusedIndex - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); scrollToIndex(effectiveFocusedIndex + 1); }
  };

  return (
    <div className="lw-plancards__carowrap">
      <button type="button" className="lw-plancards__caronav lw-plancards__caronav--prev" disabled={effectiveFocusedIndex === 0}
              onClick={() => scrollToIndex(effectiveFocusedIndex - 1)} aria-label={t("subscription.carouselPrev")}>
        <ChevronLeft size={18} aria-hidden="true" />
      </button>

      <div className="lw-plancards__carotrack" ref={trackRef} role="listbox" tabIndex={0}
           aria-label={t("subscription.pickTitle")} onKeyDown={onKeyDown} onScroll={handleScroll}
           onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={endDrag} onMouseLeave={endDrag}>
        {plans.map((plan, i) => {
          const focused = i === effectiveFocusedIndex;
          const dist = Math.min(3, Math.abs(i - effectiveFocusedIndex));
          const [gradA, gradB] = CAROUSEL_GRADIENTS[i % CAROUSEL_GRADIENTS.length];
          const price = billingCycle === "Annual" ? plan.annualPrice : plan.monthlyPrice;
          const isFree = price === 0;
          return (
            <div key={plan.code} ref={(el) => { cardRefs.current[i] = el; }}
                 className={`lw-plancards__carocard${focused ? " is-focused" : ""}`}
                 style={{ "--caro-a": gradA, "--caro-b": gradB, "--caro-dist": dist }}
                 role="option" aria-selected={focused} onClick={() => onCardClick(i)}>
              <div className="lw-plancards__carobadge">
                {isFree ? (
                  <span className="lw-plancards__carobadgefree">{t("subscription.free")}</span>
                ) : (
                  <>
                    <span className="lw-plancards__carobadgeprice">{price}<small>{plan.currency}</small></span>
                    <span className="lw-plancards__carobadgeperiod">
                      {billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}
                    </span>
                  </>
                )}
              </div>

              <div className="lw-plancards__carobody">
                <div className="lw-plancards__caroname">{plan.name}</div>
                <div className="lw-plancards__carodivider" />

                <ul className="lw-plancards__carofeatures">
                  <li><span className="lw-plancards__carocheck"><Check size={11} aria-hidden="true" /></span>
                    <span>{t("subscription.tutorCapacity")}: <strong>
                      {capacityValue(plan, plan.tutorCapacityBase, plan.tutorCapacityMax)}
                      {capacityUncapped(plan) ? ` · ${t("subscription.capacityUncapped")}` : ""}
                    </strong></span>
                  </li>
                  <li><span className="lw-plancards__carocheck"><Check size={11} aria-hidden="true" /></span>
                    <span>{t("subscription.learnerCapacity")}: <strong>
                      {capacityValue(plan, plan.learnerCapacityBase, plan.learnerCapacityMax)}
                    </strong></span>
                  </li>
                  <li><span className="lw-plancards__carocheck"><Check size={11} aria-hidden="true" /></span>
                    <span>{t("subscription.videoStorage")}: <strong>
                      {capacityValue(plan, plan.videoStorageGbBase, plan.videoStorageGbMax, "GB")}
                    </strong></span>
                  </li>
                  <li><span className="lw-plancards__carocheck"><Check size={11} aria-hidden="true" /></span>
                    <span>{t("subscription.resourceStorage")}: <strong>
                      {capacityValue(plan, plan.resourceStorageGbBase, plan.resourceStorageGbMax, "GB")}
                    </strong></span>
                  </li>
                  <li><span className="lw-plancards__carocheck"><Check size={11} aria-hidden="true" /></span>
                    <span>{t("subscription.aiCredits")}: <strong>{plan.aiCreditsIncluded.toLocaleString()}</strong></span>
                  </li>
                  {ENTITLEMENT_DOMAINS.map((domain) => {
                    const level = planProfileForDomain(plan, domain);
                    return (
                      <li key={domain}><span className="lw-plancards__carocheck"><Check size={11} aria-hidden="true" /></span>
                        <span>{domainLabel(t, domain)}: <strong>{levelLabel(t, level)} · {aiLabel(t, aiLevelForProfile(level))}</strong></span>
                      </li>
                    );
                  })}
                </ul>

                {mode === "manage" && plan.code === currentPlanCode ? (
                  <span className="lw-plancards__carocurrent">{t("subscription.currentPlanBadge")}</span>
                ) : (mode === "upgrade" || mode === "manage") && plan.code === requestedPlanCode ? (
                  <span className="lw-plancards__caropending">{t("subscription.pendingBadge")}</span>
                ) : mode === "manage" && price < currentPrice ? (
                  <button type="button" className="lw-plancards__carocta lw-plancards__carocta--down" disabled={disabled}
                          onClick={(e) => { e.stopPropagation(); onDowngrade(plan, billingCycle); }}>
                    {t("subscription.downgradeAction")}
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                ) : (
                  <button type="button" className="lw-plancards__carocta" disabled={disabled}
                          onClick={(e) => { e.stopPropagation(); onChoosePlan(plan, billingCycle); }}>
                    {ctaLabel ?? t(mode === "choose" ? "subscription.choosePlan" : "subscription.upgradeAction")}
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="lw-plancards__carofoot" />
            </div>
          );
        })}
      </div>

      <button type="button" className="lw-plancards__caronav lw-plancards__caronav--next"
              disabled={effectiveFocusedIndex === plans.length - 1} onClick={() => scrollToIndex(effectiveFocusedIndex + 1)}
              aria-label={t("subscription.carouselNext")}>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      {plans.length > 1 && (
        <div className="lw-plancards__carodots">
          {plans.map((plan, i) => (
            <button type="button" key={plan.code} className={`lw-plancards__carodot${i === effectiveFocusedIndex ? " is-active" : ""}`}
                    onClick={() => scrollToIndex(i)} aria-label={t("subscription.carouselGoTo", { n: i + 1 })} />
          ))}
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
    border: 1px solid var(--line); background: transparent; padding: 6px 16px; border-radius: 999px;
    font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; color: var(--ink-soft); cursor: pointer;
  }
  .lw-plancards__cycle button.is-active { background: var(--accent); color: #fff; }
  .lw-plancards__cycle button:hover:not(.is-active), .lw-plancards__cycle button:focus-visible:not(.is-active) { background: var(--surface-2, rgba(0,0,0,0.05)); }

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
  .lw-plancards__pending {
    align-self: center; margin-top: 4px; font-family: var(--font-mono); font-size: 11px;
    border-radius: 20px; padding: 6px 14px; text-align: center;
    background: color-mix(in srgb, #E0A83E 20%, transparent); color: #A67519;
  }

  /* Carousel layout — one card centered/"near" (scaled up, full opacity),
     the rest fanning out to either side "far" (scaled down, faded). */
  .lw-plancards__carowrap { display: flex; align-items: center; gap: 6px; width: 100%; }
  .lw-plancards__carotrack {
    display: flex; align-items: center; gap: clamp(16px, 2.4vw, 30px); flex: 1; min-width: 0;
    overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth;
    padding: 46px 6vw 26px; cursor: grab; -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .lw-plancards__carotrack:active { cursor: grabbing; }
  .lw-plancards__carotrack::-webkit-scrollbar { display: none; }
  .lw-plancards__carotrack:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }

  .lw-plancards__carocard {
    scroll-snap-align: center; flex: 0 0 auto; width: clamp(210px, 22vw, 300px);
    display: flex; flex-direction: column; align-items: center;
    border-radius: var(--radius); overflow: visible; user-select: none; cursor: pointer;
    transform: scale(calc(1 - var(--caro-dist) * 0.12)); opacity: calc(1 - var(--caro-dist) * 0.3);
    filter: saturate(calc(1 - var(--caro-dist) * 0.35));
    transition: transform 0.25s ease, opacity 0.25s ease, filter 0.25s ease, box-shadow 0.25s ease;
  }
  .lw-plancards__carocard.is-focused { cursor: default; z-index: 2; }

  .lw-plancards__carobadge {
    width: 92px; height: 92px; border-radius: 50%; flex-shrink: 0; margin-bottom: -38px; z-index: 1;
    background: linear-gradient(135deg, var(--caro-a), var(--caro-b));
    border: 5px solid var(--surface);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    box-shadow: 0 8px 20px -6px rgba(0,0,0,0.35);
    color: #fff; font-family: var(--font-display);
  }
  .lw-plancards__carobadgeprice { font-size: 1.5rem; font-weight: 700; line-height: 1; }
  .lw-plancards__carobadgeprice small { font-family: var(--font-body); font-size: 0.62rem; font-weight: 600; margin-inline-start: 2px; }
  .lw-plancards__carobadgeperiod { font-family: var(--font-body); font-size: 0.66rem; opacity: 0.9; margin-top: 2px; }
  .lw-plancards__carobadgefree { font-family: var(--font-body); font-size: 0.92rem; font-weight: 700; }

  .lw-plancards__carobody {
    width: 100%; background: var(--surface); border: 1px solid var(--line); border-top: none;
    border-radius: 0 0 var(--radius) var(--radius); padding: 46px 16px 18px;
    display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-sm, 0 2px 10px rgba(0,0,0,0.06));
  }
  .lw-plancards__carocard.is-focused .lw-plancards__carobody { box-shadow: 0 18px 34px -14px rgba(0,0,0,0.28); }
  .lw-plancards__caroname { text-align: center; font-weight: 700; font-size: 1.02rem; letter-spacing: 0.02em; }
  .lw-plancards__carodivider { height: 2px; width: 34px; margin: 0 auto; background: var(--line); border-radius: 2px; }

  .lw-plancards__carofeatures { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.76rem; }
  .lw-plancards__carofeatures li { display: flex; align-items: flex-start; gap: 8px; }
  .lw-plancards__carocheck {
    flex-shrink: 0; width: 17px; height: 17px; border-radius: 50%; margin-top: 1px;
    background: linear-gradient(135deg, var(--caro-a), var(--caro-b)); color: #fff;
    display: flex; align-items: center; justify-content: center;
  }
  .lw-plancards__carofeatures strong { font-weight: 600; }

  .lw-plancards__carocta {
    margin-top: 4px; align-self: center; border: none; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 22px; border-radius: 999px; font-family: var(--font-body); font-size: 0.82rem; font-weight: 700;
    color: #fff; background: linear-gradient(135deg, var(--caro-a), var(--caro-b));
    box-shadow: 0 8px 18px -8px color-mix(in srgb, var(--caro-b) 70%, transparent);
  }
  .lw-plancards__carocta:hover:not(:disabled) { transform: translateY(-1px); }
  .lw-plancards__carocta:disabled { opacity: 0.55; cursor: not-allowed; }
  .lw-plancards__carocta--down {
    color: var(--ink); background: var(--surface);
    border: 1px solid var(--line); box-shadow: none;
  }
  .lw-plancards__caropending {
    align-self: center; font-family: var(--font-mono); font-size: 11px;
    border-radius: 20px; padding: 6px 14px; text-align: center;
    background: color-mix(in srgb, #E0A83E 20%, transparent); color: #A67519;
  }
  .lw-plancards__carocurrent {
    align-self: center; font-family: var(--font-mono); font-size: 11px;
    border-radius: 20px; padding: 6px 14px; text-align: center;
    background: color-mix(in srgb, var(--caro-a) 18%, transparent); color: var(--ink);
  }

  .lw-plancards__carofoot { height: 10px; width: 88%; margin-top: -4px; border-radius: 0 0 10px 10px; background: var(--ink); opacity: 0.85; }

  .lw-plancards__caronav {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line);
    background: var(--surface); color: var(--ink); display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .lw-plancards__caronav:hover:not(:disabled) { background: var(--surface-2, rgba(0,0,0,0.05)); }
  .lw-plancards__caronav:disabled { opacity: 0.35; cursor: not-allowed; }

  .lw-plancards__carodots { display: flex; justify-content: center; gap: 7px; margin-top: 10px; }
  .lw-plancards__carodot {
    width: 8px; height: 8px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
    background: var(--line);
  }
  .lw-plancards__carodot.is-active { background: var(--accent); width: 20px; border-radius: 4px; }

  @media (max-width: 640px) {
    .lw-plancards__carotrack { padding: 40px 10vw 22px; gap: 14px; }
    .lw-plancards__carocard { width: 200px; }
  }

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
