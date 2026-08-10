import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import * as api from "../api/client";
import {
  levelLabel, aiLabel, domainLabel, ENTITLEMENT_DOMAINS, planProfileForDomain,
  aiLevelForProfile, parseRequirement, packGrants,
} from "../i18n/subscriptionLabels";

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
  useFonts();
  const { t } = useLanguage();
  const [claim, setClaim] = useState(0);
  const [entered, setEntered] = useState(false);

  /* The rotating proof line. Concrete tutor outcomes, not platform features —
     the page is a pitch, not a description. */
  const CLAIMS = [t("landing.claim0"), t("landing.claim1"), t("landing.claim2"), t("landing.claim3")];

  // The public Solo plan catalog — no auth required, same source the
  // subscribed-tutor Billing screen reads. A stranger deciding whether to
  // apply should be able to see what it costs without signing in first.
  const [plans, setPlans] = useState(null);
  const [packs, setPacks] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.getCommercialPlans().then((p) => { if (!cancelled) setPlans(p); }).catch(() => {});
    api.getCommercialPacks().then((p) => { if (!cancelled) setPacks(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Entrance transition, run once after mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Rotate the proof line. Paused entirely for reduced-motion users, who get
  // the first claim as static text rather than a stuttering carousel.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setClaim((c) => (c + 1) % 4), 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`pl-land ${entered ? "is-in" : ""}`}>
      <style>{CSS}</style>

      {/* Decorative only — never announced, never interactive */}
      <div className="pl-land__aurora" aria-hidden="true">
        <span className="pl-land__blob pl-land__blob--a" />
        <span className="pl-land__blob pl-land__blob--b" />
        <span className="pl-land__blob pl-land__blob--c" />
        <span className="pl-land__grid" />
      </div>

      <header className="pl-land__nav">
        <div className="pl-land__brand">
          <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true">
            <rect width="40" height="40" rx="10" fill="url(#plg)" />
            <path d="M11 26 L20 12 L29 26" fill="none" stroke="#fff" strokeWidth="2.6"
                  strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15.5 22 L24.5 22" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <defs>
              <linearGradient id="plg" x1="0" y1="0" x2="40" y2="40">
                <stop offset="0%" stopColor="#5B8DEF" />
                <stop offset="100%" stopColor="#2D5BD1" />
              </linearGradient>
            </defs>
          </svg>
          <span>Platform</span>
        </div>

        <div className="pl-land__navactions">
          <LanguageToggle />
          {/* Navigation, not a call to action — for people who already have an account */}
          <button className="pl-land__signin" onClick={onSignIn}>{t("landing.logIn")}</button>
        </div>
      </header>

      <main className="pl-land__hero">
        <p className="pl-land__eyebrow">{t("landing.eyebrow")}</p>

        <h1 className="pl-land__title">
          {t("landing.titleLine1")}<br />
          <span className="pl-land__accent">{t("landing.titleAccent")}</span>
        </h1>

        <div className="pl-land__claims" aria-live="off">
          {CLAIMS.map((text, i) => (
            <span key={text} className={`pl-land__claim ${i === claim ? "is-active" : ""}`}>
              {text}
            </span>
          ))}
          {/* Reserves the line's height so the layout never jumps as claims rotate */}
          <span className="pl-land__claim is-ghost" aria-hidden="true">{CLAIMS[0]}</span>
        </div>

        {/* ADR-EA-002: exactly one call to action */}
        <button className="pl-land__cta" onClick={onBecomeTutor}>
          {t("landing.cta")} <ArrowRight size={18} aria-hidden="true" />
        </button>

        <ul className="pl-land__points">
          <li><Check size={14} aria-hidden="true" /> {t("landing.pointBranded")}</li>
          <li><Check size={14} aria-hidden="true" /> {t("landing.pointInvite")}</li>
          <li><Check size={14} aria-hidden="true" /> {t("landing.pointCommission")}</li>
        </ul>
      </main>

      <section className="pl-land__stage" aria-hidden="true">
        <WorkspacePreview />
      </section>

      {plans && plans.length > 0 && <PlansSection plans={plans} packs={packs} onBecomeTutor={onBecomeTutor} />}

      <footer className="pl-land__foot">
        <span>{t("landing.footer")}</span>
      </footer>
    </div>
  );
}

/* A suggestion of the product, not a screenshot of it. Decorative and
   aria-hidden: it illustrates the pitch without claiming to be real data. */
function WorkspacePreview() {
  return (
    <div className="pl-prev">
      <div className="pl-prev__bar">
        <span /><span /><span />
      </div>
      <div className="pl-prev__body">
        <div className="pl-prev__side">
          <div className="pl-prev__mark" />
          <div className="pl-prev__line is-w70" />
          <div className="pl-prev__line is-w50" />
          <div className="pl-prev__nav">
            <span className="is-active" /><span /><span /><span />
          </div>
        </div>
        <div className="pl-prev__main">
          <div className="pl-prev__head">
            <div className="pl-prev__line is-w40 is-tall" />
          </div>
          <div className="pl-prev__cards">
            <div className="pl-prev__card"><div className="pl-prev__cover" /><div className="pl-prev__line is-w80" /><div className="pl-prev__bar-fill"><i style={{ width: "64%" }} /></div></div>
            <div className="pl-prev__card"><div className="pl-prev__cover is-alt" /><div className="pl-prev__line is-w60" /><div className="pl-prev__bar-fill"><i style={{ width: "38%" }} /></div></div>
            <div className="pl-prev__card"><div className="pl-prev__cover is-alt2" /><div className="pl-prev__line is-w70" /><div className="pl-prev__bar-fill"><i style={{ width: "82%" }} /></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Shopify-style pricing teaser. Every card's button is the SAME call to
   action as the hero (onBecomeTutor) — ADR-EA-002 permits exactly one CTA
   on this page, so pricing here sells the plan, it doesn't open a second
   funnel. There is no checkout to send a stranger into: only a Workspace
   Owner with a real Workspace can subscribe, on the Billing screen. */
function PlansSection({ plans, packs, onBecomeTutor }) {
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState("Monthly");

  return (
    <section className="pl-plans">
      <h2 className="pl-plans__title">{t("landing.plansTitle")}</h2>
      <p className="pl-plans__lead">{t("landing.plansLead")}</p>

      <div className="pl-plans__cycle" role="tablist">
        <button type="button" role="tab" aria-selected={billingCycle === "Monthly"}
                className={billingCycle === "Monthly" ? "is-active" : ""} onClick={() => setBillingCycle("Monthly")}>
          {t("subscription.billingMonthly")}
        </button>
        <button type="button" role="tab" aria-selected={billingCycle === "Annual"}
                className={billingCycle === "Annual" ? "is-active" : ""} onClick={() => setBillingCycle("Annual")}>
          {t("subscription.billingAnnual")}
        </button>
      </div>

      <div className="pl-plans__grid">
        {plans.map((plan) => (
          <div className="pl-plans__card" key={plan.code}>
            <div className="pl-plans__name">{plan.name}</div>
            <div className="pl-plans__price">
              {billingCycle === "Annual" ? plan.annualPrice : plan.monthlyPrice} {plan.currency}
              <span>{billingCycle === "Annual" ? t("subscription.perYear") : t("subscription.perMonth")}</span>
            </div>

            <ul className="pl-plans__features">
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
                      <em className="pl-plans__aitag">{aiLabel(t, aiLevelForProfile(level))}</em>
                    </strong>
                  </li>
                );
              })}
            </ul>

            <button className="pl-plans__cta" onClick={onBecomeTutor}>
              {t("landing.cta")} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {/* Add-ons are the same catalog regardless of plan (only AI Assessment
          carries a dependency) — one shared list under the grid rather than
          repeating it per card. Still no second CTA: same onBecomeTutor. */}
      {packs && packs.length > 0 && (
        <div className="pl-plans__addons">
          <h3 className="pl-plans__addonstitle">{t("subscription.addOns")}</h3>
          <ul className="pl-plans__addonlist">
            {packs.map((pack) => {
              const req = parseRequirement(pack.requiresMinProfile);
              return (
                <li className="pl-plans__addon" key={pack.code}>
                  <div className="pl-plans__addonhead">
                    <span className="pl-plans__addonname">{pack.name}</span>
                    <span className="pl-plans__addonprice">
                      +{pack.monthlyPrice} {pack.currency}<span>{t("subscription.perMonth")}</span>
                    </span>
                  </div>
                  <ul className="pl-plans__addongrants">
                    {packGrants(pack).map(({ domain, level }) => (
                      <li key={domain}>
                        <span>{domainLabel(t, domain)}</span>
                        <strong>
                          {levelLabel(t, level)}
                          <em className="pl-plans__aitag">{aiLabel(t, aiLevelForProfile(level))}</em>
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
                    <span className="pl-plans__addonnote">
                      {t("subscription.packRequires", { domain: domainLabel(t, req.domain), level: levelLabel(t, req.level) })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

const CSS = `
  .pl-land {
    --ink: #F2F5FA; --ink-soft: #98A2B5; --accent: #5B8DEF; --deep: #0B0F16;
    position: relative; min-height: 100vh; overflow: hidden;
    background: var(--deep); color: var(--ink);
    font-family: 'Karla', system-ui, sans-serif;
    display: flex; flex-direction: column;
  }
  .pl-land *, .pl-land *::before, .pl-land *::after { box-sizing: border-box; }

  /* ── Background ─────────────────────────────────────────────────────── */
  .pl-land__aurora { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .pl-land__blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.5; }
  .pl-land__blob--a { width: 46vw; height: 46vw; background: #2D5BD1; top: -14vw; inset-inline-start: -8vw; animation: plDrift 26s ease-in-out infinite; }
  .pl-land__blob--b { width: 38vw; height: 38vw; background: #1E7F63; bottom: -12vw; inset-inline-end: -6vw; animation: plDrift 32s ease-in-out infinite reverse; }
  .pl-land__blob--c { width: 30vw; height: 30vw; background: #6D3FC4; top: 32%; inset-inline-end: 22%; opacity: 0.35; animation: plDrift 38s ease-in-out infinite; }
  .pl-land__grid {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 40%, transparent 100%);
  }
  @keyframes plDrift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(4vw, 3vw) scale(1.12); }
  }

  /* ── Nav ────────────────────────────────────────────────────────────── */
  .pl-land__nav {
    position: relative; z-index: 2;
    display: flex; align-items: center; justify-content: space-between;
    padding: 22px clamp(20px, 5vw, 56px);
  }
  .pl-land__brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -0.01em; }
  .pl-land__navactions { display: flex; align-items: center; gap: 10px; }
  .pl-land .lw-langtoggle { background: rgba(255,255,255,0.06); }
  .pl-land .lw-langtoggle__btn.is-active { background: var(--accent); }
  .pl-land__signin {
    font-family: inherit; font-size: 0.88rem; color: var(--ink);
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
    border-radius: 9px; padding: 8px 16px; cursor: pointer;
    transition: background .18s, border-color .18s;
  }
  .pl-land__signin:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.28); }
  .pl-land__signin:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* ── Hero ───────────────────────────────────────────────────────────── */
  .pl-land__hero {
    position: relative; z-index: 2; flex: 1;
    display: flex; flex-direction: column; align-items: center; text-align: center;
    padding: clamp(28px, 6vw, 64px) 24px 0;
  }
  .pl-land__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11.5px;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent);
    margin: 0 0 18px; opacity: 0; transform: translateY(10px);
    transition: opacity .6s ease .05s, transform .6s ease .05s;
  }
  .pl-land__title {
    /* index.css's global "h1, h2 { color: var(--text-h) }" (leftover
       template default) otherwise wins over this element's inherited
       .pl-land color, since it sets the h1's color explicitly. */
    color: var(--ink);
    font-family: 'Fraunces', Georgia, serif; font-weight: 600;
    font-size: clamp(2.6rem, 8vw, 5.2rem); line-height: 1.02;
    letter-spacing: -0.025em; margin: 0 0 20px;
    opacity: 0; transform: translateY(16px);
    transition: opacity .7s ease .12s, transform .7s ease .12s;
  }
  .pl-land__accent {
    background: linear-gradient(100deg, #5B8DEF, #7FD3B8 60%, #E0A83E);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }

  .pl-land__claims { position: relative; height: 1.7em; margin-bottom: 30px; opacity: 0; transition: opacity .7s ease .2s; }
  .pl-land__claim {
    position: absolute; left: 50%; top: 0; transform: translate(-50%, 8px);
    white-space: nowrap; font-size: clamp(0.95rem, 2.2vw, 1.12rem);
    color: var(--ink-soft); opacity: 0; transition: opacity .5s, transform .5s;
  }
  .pl-land__claim.is-active { opacity: 1; transform: translate(-50%, 0); }
  .pl-land__claim.is-ghost { position: static; visibility: hidden; opacity: 0; transform: none; }

  .pl-land__cta {
    display: inline-flex; align-items: center; gap: 10px;
    font-family: inherit; font-size: 1.02rem; font-weight: 700; color: #08111F;
    background: linear-gradient(100deg, #7FB0FF, #5B8DEF);
    border: none; border-radius: 12px; padding: 15px 30px; cursor: pointer;
    box-shadow: 0 10px 34px rgba(91,141,239,0.36);
    opacity: 0; transform: translateY(12px);
    transition: opacity .7s ease .28s, transform .22s, box-shadow .22s;
  }
  .pl-land__cta:hover { transform: translateY(-2px); box-shadow: 0 16px 44px rgba(91,141,239,0.5); }
  .pl-land__cta:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

  .pl-land__points {
    list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 26px;
    padding: 0; margin: 24px 0 0; font-size: 0.86rem; color: var(--ink-soft);
    opacity: 0; transition: opacity .7s ease .36s;
  }
  .pl-land__points li { display: flex; align-items: center; gap: 7px; }
  .pl-land__points svg { color: #7FD3B8; }

  .is-in .pl-land__eyebrow, .is-in .pl-land__title, .is-in .pl-land__cta { opacity: 1; transform: translateY(0); }
  .is-in .pl-land__claims, .is-in .pl-land__points { opacity: 1; }

  /* ── Product suggestion ─────────────────────────────────────────────── */
  .pl-land__stage {
    position: relative; z-index: 2;
    margin: clamp(38px, 7vw, 72px) auto -8vh; padding: 0 24px;
    width: min(940px, 94vw);
    perspective: 1600px;
  }
  .pl-prev {
    border-radius: 14px 14px 0 0; overflow: hidden;
    background: #12171F; border: 1px solid rgba(255,255,255,0.1); border-bottom: none;
    box-shadow: 0 -10px 80px rgba(0,0,0,0.6);
    transform: rotateX(9deg) translateY(14px); transform-origin: top center;
    opacity: 0; transition: opacity .9s ease .42s, transform .9s ease .42s;
  }
  .is-in .pl-prev { opacity: 1; transform: rotateX(5deg) translateY(0); }

  .pl-prev__bar { display: flex; gap: 6px; padding: 11px 14px; background: #0E1218; border-bottom: 1px solid rgba(255,255,255,0.07); }
  .pl-prev__bar span { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,0.16); }
  .pl-prev__body { display: flex; min-height: 260px; }
  .pl-prev__side { width: 180px; flex-shrink: 0; padding: 18px 14px; background: #0E1218; border-inline-end: 1px solid rgba(255,255,255,0.07); }
  .pl-prev__mark { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, #5B8DEF, #2D5BD1); margin-bottom: 14px; }
  .pl-prev__line { height: 7px; border-radius: 4px; background: rgba(255,255,255,0.1); margin-bottom: 8px; }
  .pl-prev__line.is-tall { height: 13px; }
  .is-w40 { width: 40%; } .is-w50 { width: 50%; } .is-w60 { width: 60%; }
  .is-w70 { width: 70%; } .is-w80 { width: 80%; }
  .pl-prev__nav { margin-top: 20px; display: flex; flex-direction: column; gap: 7px; }
  .pl-prev__nav span { height: 9px; border-radius: 4px; background: rgba(255,255,255,0.07); width: 86%; }
  .pl-prev__nav span.is-active { background: rgba(91,141,239,0.55); width: 94%; }

  .pl-prev__main { flex: 1; padding: 20px; }
  .pl-prev__head { margin-bottom: 18px; }
  .pl-prev__cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .pl-prev__card { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07); border-radius: 9px; padding: 10px; }
  .pl-prev__cover { height: 52px; border-radius: 6px; margin-bottom: 9px; background: linear-gradient(120deg, #2D5BD1, #6D3FC4); opacity: 0.75; }
  .pl-prev__cover.is-alt { background: linear-gradient(120deg, #1E7F63, #5B8DEF); }
  .pl-prev__cover.is-alt2 { background: linear-gradient(120deg, #E0A83E, #C4533F); }
  .pl-prev__bar-fill { height: 5px; border-radius: 3px; background: rgba(255,255,255,0.09); margin-top: 9px; overflow: hidden; }
  .pl-prev__bar-fill i { display: block; height: 100%; background: #7FD3B8; border-radius: 3px; }

  /* ── Plans ──────────────────────────────────────────────────────────── */
  .pl-plans {
    /* .pl-land__stage ends in a negative bottom margin (-8vh) that pulls
       whatever follows up underneath it — compensate so this section clears
       the preview mockup instead of sliding under it. */
    position: relative; z-index: 2;
    margin: calc(8vh + clamp(48px, 7vw, 88px)) auto 0; padding: 0 24px;
    width: min(1040px, 94vw); text-align: center;
  }
  .pl-plans__title {
    color: var(--ink);
    font-family: 'Fraunces', Georgia, serif; font-weight: 600;
    font-size: clamp(1.7rem, 3.4vw, 2.3rem); margin: 0 0 10px;
  }
  .pl-plans__lead { color: var(--ink-soft); font-size: 0.94rem; margin: 0 0 22px; }

  .pl-plans__cycle {
    display: inline-flex; border: 1px solid rgba(255,255,255,0.14); border-radius: 999px;
    padding: 3px; margin-bottom: 28px;
  }
  .pl-plans__cycle button {
    border: none; background: transparent; padding: 7px 18px; border-radius: 999px;
    font-family: inherit; font-size: 0.82rem; font-weight: 600; color: var(--ink-soft); cursor: pointer;
  }
  .pl-plans__cycle button.is-active { background: var(--accent); color: #08111F; }

  .pl-plans__grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 18px;
    text-align: start;
  }
  .pl-plans__card {
    display: flex; flex-direction: column; gap: 14px;
    background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px; padding: 22px;
  }
  .pl-plans__name { font-weight: 700; font-size: 1.02rem; }
  .pl-plans__price { font-family: 'Fraunces', Georgia, serif; font-size: 1.7rem; color: var(--accent); }
  .pl-plans__price span { font-family: inherit; font-size: 0.78rem; color: var(--ink-soft); margin-inline-start: 5px; }

  .pl-plans__features { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.84rem; }
  .pl-plans__features li { display: flex; justify-content: space-between; gap: 10px; }
  .pl-plans__features li span { color: var(--ink-soft); }
  .pl-plans__features li strong { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
  .pl-plans__aitag { font-style: normal; font-size: 0.68rem; font-weight: 600; color: var(--ink-soft); }

  .pl-plans__cta {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.88rem; font-weight: 700; color: #08111F;
    background: linear-gradient(100deg, #7FB0FF, #5B8DEF);
    border: none; border-radius: 10px; padding: 11px 18px; cursor: pointer;
    margin-top: auto; transition: transform .18s, box-shadow .18s;
  }
  .pl-plans__cta:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(91,141,239,0.4); }
  .pl-plans__cta:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

  .pl-plans__addons { margin-top: 34px; text-align: start; }
  .pl-plans__addonstitle { color: var(--ink); font-size: 1rem; font-weight: 700; margin: 0 0 14px; }
  .pl-plans__addonlist {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;
  }
  .pl-plans__addon {
    background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;
  }
  .pl-plans__addonhead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .pl-plans__addonname { font-weight: 700; font-size: 0.88rem; }
  .pl-plans__addonprice { font-size: 0.78rem; color: var(--ink-soft); white-space: nowrap; }
  .pl-plans__addongrants { list-style: none; margin: 2px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; }
  .pl-plans__addongrants li { display: flex; justify-content: space-between; gap: 10px; }
  .pl-plans__addongrants li span { color: var(--ink-soft); }
  .pl-plans__addongrants li strong { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
  .pl-plans__addonnote { font-size: 0.72rem; color: #E0A83E; }

  /* ── Foot ───────────────────────────────────────────────────────────── */
  .pl-land__foot {
    position: relative; z-index: 2; text-align: center;
    padding: 26px 24px 22px; font-size: 0.8rem; color: rgba(152,162,181,0.75);
  }

  @media (max-width: 720px) {
    .pl-land__stage { display: none; }
    .pl-land__claim { white-space: normal; width: min(92vw, 30ch); }
  }

  @media (prefers-reduced-motion: reduce) {
    .pl-land__blob { animation: none; }
    .pl-land *, .pl-land *::before { transition: none !important; }
    .pl-land__eyebrow, .pl-land__title, .pl-land__cta, .pl-land__claims, .pl-land__points, .pl-prev {
      opacity: 1 !important; transform: none !important;
    }
    .pl-land__claim { opacity: 0; }
    .pl-land__claim.is-active { opacity: 1; }
  }

  ${LANGUAGE_TOGGLE_CSS}
`;
