import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell from "../components/EntryShell";
import * as api from "../api/client";
import PlanPickerCards, { PLAN_PICKER_CARDS_CSS } from "../components/PlanPickerCards";

/* =========================================================================
   LANDING — https://platform.com/

   Governed by ExperienceArchitecture ADR-EA-002, which is unusually
   prescriptive about *structure* and explicitly silent on visual design:

     · exactly ONE call to action — Become a Tutor — plus minimal copy
       pitched at that tutor. Never a second, discovery-oriented one.
     · never a Workspace directory, search or "browse academies". This is a
       permanent product decision, not a deferred feature: providing discovery
       would put the platform in competition with its own paying customers for
       their students' attention (Business Model Note; Join Request BA-007).
     · never a Platform Administrator entry point — advertising that surface
       invites exactly the probing it should avoid.

   So there is no "I'm learning" button here, deliberately. Learners never
   begin at the platform root; they arrive through a Workspace's own link
   (ADR-WE-001, Workspace-First Entry). The header's sign-in is navigation for
   people who already have an account, not a second call to action.
   ========================================================================= */

export default function LandingScreen({ onBecomeTutor, onSignIn }) {
  const { t } = useLanguage();
  const [claim, setClaim] = useState(0);

  /* The rotating proof line. Concrete tutor outcomes, not platform features —
     the page is a pitch, not a description. */
  const CLAIMS = [t("landing.claim0"), t("landing.claim1"), t("landing.claim2"), t("landing.claim3")];

  // The public Solo plan catalog — no auth required, same source the
  // subscribed-tutor Billing screen reads. A stranger deciding whether to
  // apply should be able to see what it costs without signing in first.
  // Add-ons are deliberately not fetched/shown here — this page sells the
  // base plan; capability packs are an in-app upsell once someone's a tutor.
  const [plans, setPlans] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.getCommercialPlans().then((p) => { if (!cancelled) setPlans(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Rotate the proof line. Paused entirely for reduced-motion users, who get
  // the first claim as static text rather than a stuttering carousel.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setClaim((c) => (c + 1) % 4), 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <EntryShell wide actions={
      // Navigation, not a call to action — for people who already have an account
      <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onSignIn}>{t("landing.logIn")}</button>
    }>
      <div className="lw-land">
        <style>{CSS}</style>
        <section className="lw-land__hero">
          <div className="lw-eyebrow">{t("landing.eyebrow")}</div>
          <h1 className="lw-land__title">
            {t("landing.titleLine1")}<br />
            <span className="lw-land__accent">{t("landing.titleAccent")}</span>
          </h1>

          <div className="lw-land__claims" aria-live="off">
            {CLAIMS.map((text, i) => (
              <span key={text} className={`lw-land__claim ${i === claim ? "is-active" : ""}`}>{text}</span>
            ))}
            {/* Reserves the line's height so the layout never jumps as claims rotate */}
            <span className="lw-land__claim is-ghost" aria-hidden="true">{CLAIMS[0]}</span>
          </div>

          {/* ADR-EA-002: exactly one call to action */}
          <button type="button" className="lw-btn lw-btn--accent lw-btn--lg" onClick={onBecomeTutor}>
            {t("landing.cta")} <ArrowRight size={18} className="lw-flip" aria-hidden="true" />
          </button>

          <ul className="lw-land__points">
            <li><Check size={14} aria-hidden="true" /> {t("landing.pointBranded")}</li>
            <li><Check size={14} aria-hidden="true" /> {t("landing.pointInvite")}</li>
            <li><Check size={14} aria-hidden="true" /> {t("landing.pointCommission")}</li>
          </ul>
        </section>

        <section className="lw-land__stage" aria-hidden="true"><WorkspacePreview /></section>

        {plans && plans.length > 0 && <PlansSection plans={plans} onBecomeTutor={onBecomeTutor} />}

        <footer className="lw-land__foot">{t("landing.footer")}</footer>
      </div>
    </EntryShell>
  );
}

/* A suggestion of the product, not a screenshot of it. Decorative and
   aria-hidden: it illustrates the pitch without claiming to be real data.
   Drawn in the app's own tokens, so it previews the real look in light and dark. */
function WorkspacePreview() {
  return (
    <div className="lw-prev">
      <div className="lw-prev__bar"><span /><span /><span /></div>
      <div className="lw-prev__body">
        <div className="lw-prev__side">
          <div className="lw-prev__mark" />
          <div className="lw-prev__line is-w70" />
          <div className="lw-prev__line is-w50" />
          <div className="lw-prev__nav"><span className="is-active" /><span /><span /><span /></div>
        </div>
        <div className="lw-prev__main">
          <div className="lw-prev__line is-w40 is-tall" />
          <div className="lw-prev__cards">
            {[64, 38, 82].map((pct, i) => (
              <div className="lw-prev__card" key={pct}>
                <div className={`lw-prev__cover is-c${i}`} />
                <div className="lw-prev__line is-w70" />
                <div className="lw-prev__progress"><i style={{ width: `${pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Shopify-style pricing teaser, rendered by the shared PlanPickerCards
   component (same one Billing uses) in its carousel layout. Every card's
   button is still the SAME call to action as the hero (onBecomeTutor) —
   ADR-EA-002 permits exactly one CTA on this page. */
function PlansSection({ plans, onBecomeTutor }) {
  const { t } = useLanguage();
  return (
    <section className="lw-land__plans">
      <h2 className="lw-land__plantitle">{t("landing.plansTitle")}</h2>
      <p className="lw-sub">{t("landing.plansLead")}</p>
      <PlanPickerCards plans={plans} layout="carousel" ctaLabel={t("landing.cta")} onChoosePlan={() => onBecomeTutor()} />
    </section>
  );
}

const CSS = `
  .lw-land { display: flex; flex-direction: column; gap: 48px; }
  .lw-land__hero { text-align: center; display: flex; flex-direction: column; align-items: center; padding-top: 24px; }
  .lw-land__title { font-family: var(--font-display); font-size: clamp(2rem, 5vw, 3.1rem); line-height: 1.15; margin: 6px 0 18px; }
  .lw-land__accent { color: var(--accent); }
  .lw-land__claims { display: grid; min-height: 1.6em; margin-bottom: 8px; color: var(--ink-soft); font-size: 1.05rem; }
  .lw-land__claim { grid-area: 1 / 1; opacity: 0; transition: opacity .4s ease; }
  .lw-land__claim.is-active { opacity: 1; }
  .lw-land__claim.is-ghost { visibility: hidden; }
  .lw-land__points { list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 22px; padding: 0; margin: 22px 0 0; color: var(--ink-soft); font-size: 0.9rem; }
  .lw-land__points li { display: inline-flex; align-items: center; gap: 6px; }
  .lw-land__points svg { color: var(--success); }
  .lw-land__plans { text-align: center; }
  .lw-land__plantitle { font-family: var(--font-display); font-size: 1.6rem; margin: 0 0 8px; }
  .lw-land__foot { text-align: center; color: var(--ink-soft); font-size: 0.82rem; padding-bottom: 8px; }

  .lw-prev { max-width: 760px; margin: 0 auto; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--surface); box-shadow: 0 18px 40px color-mix(in srgb, var(--ink) 12%, transparent); }
  .lw-prev__bar { display: flex; gap: 6px; padding: 10px 12px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
  .lw-prev__bar span { width: 9px; height: 9px; border-radius: 50%; background: var(--line); }
  .lw-prev__body { display: grid; grid-template-columns: 170px 1fr; min-height: 230px; }
  .lw-prev__side { background: var(--nav-bg); padding: 16px 14px; display: flex; flex-direction: column; gap: 8px; }
  .lw-prev__mark { width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--accent); margin-bottom: 6px; }
  .lw-prev__side .lw-prev__line { background: color-mix(in srgb, var(--nav-text) 30%, transparent); }
  .lw-prev__nav { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .lw-prev__nav span { height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--nav-text) 18%, transparent); }
  .lw-prev__nav span.is-active { background: var(--accent); }
  .lw-prev__main { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
  .lw-prev__line { height: 8px; border-radius: 4px; background: var(--surface-2); }
  .lw-prev__line.is-tall { height: 14px; }
  .is-w40 { width: 40%; } .is-w50 { width: 50%; } .is-w70 { width: 70%; }
  .lw-prev__cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .lw-prev__card { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px; display: flex; flex-direction: column; gap: 8px; }
  .lw-prev__cover { height: 54px; border-radius: 6px; background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .lw-prev__cover.is-c1 { background: color-mix(in srgb, var(--accent-2) 24%, var(--surface)); }
  .lw-prev__cover.is-c2 { background: color-mix(in srgb, var(--success) 22%, var(--surface)); }
  .lw-prev__progress { height: 5px; border-radius: 3px; background: var(--surface-2); overflow: hidden; }
  .lw-prev__progress i { display: block; height: 100%; background: var(--accent); }
  @media (max-width: 640px) { .lw-prev__body { grid-template-columns: 1fr; } .lw-prev__side { display: none; } .lw-prev__cards { grid-template-columns: 1fr 1fr; } }
  @media (prefers-reduced-motion: reduce) { .lw-land__claim { transition: none; } }
  ${PLAN_PICKER_CARDS_CSS}
`;
