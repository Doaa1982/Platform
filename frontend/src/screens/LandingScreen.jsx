import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
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
  // Add-ons are deliberately not fetched/shown here — this page sells the
  // base plan; capability packs are an in-app upsell once someone's a tutor.
  const [plans, setPlans] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.getCommercialPlans().then((p) => { if (!cancelled) setPlans(p); }).catch(() => {});
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
            <path d="M11 26 L20 12 L29 26" fill="none" stroke="#F3ECD8" strokeWidth="2.6"
                  strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15.5 22 L24.5 22" stroke="#F3ECD8" strokeWidth="2.6" strokeLinecap="round" />
            <defs>
              {/* Notebook theme (2026-08-15): leather-ledger gold-to-maroon,
                  matching TUTOR_LIGHT's accent/accent-2 in App.jsx. */}
              <linearGradient id="plg" x1="0" y1="0" x2="40" y2="40">
                <stop offset="0%" stopColor="#D4AF6A" />
                <stop offset="100%" stopColor="#7A2E2E" />
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

      {plans && plans.length > 0 && <PlansSection plans={plans} onBecomeTutor={onBecomeTutor} />}

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

/* Shopify-style pricing teaser, rendered by the shared PlanPickerCards
   component (same one Billing uses) in its carousel layout — one plan
   centered and "near", the rest fading out to either side, drag/swipe or
   arrow-button to bring another into focus. Every card's button is still the
   SAME call to action as the hero (onBecomeTutor) — ADR-EA-002 permits
   exactly one CTA on this page, so pricing here sells the plan, it doesn't
   open a second funnel. There is no checkout to send a stranger into: only a
   Workspace Owner with a real Workspace can subscribe, on the Billing screen. */
function PlansSection({ plans, onBecomeTutor }) {
  const { t } = useLanguage();

  return (
    <section className="pl-plans">
      <h2 className="pl-plans__title">{t("landing.plansTitle")}</h2>
      <p className="pl-plans__lead">{t("landing.plansLead")}</p>

      <PlanPickerCards plans={plans} layout="carousel"
        ctaLabel={t("landing.cta")} onChoosePlan={() => onBecomeTutor()} />
    </section>
  );
}

const CSS = `
  /* Notebook theme (2026-08-15): Tutor "leather ledger" palette — this is
     the only public page pitched at tutors (ADR-EA-002: one CTA, no learner
     entry point here), so it gets the full script-font treatment. Recolored
     from the old generic SaaS blue/teal/purple to the warm dark-leather
     tones of TUTOR_DARK in App.jsx; the aurora blobs become a candlelit
     glow instead of a tech-product gradient, and the grid becomes ruled
     page lines. */
  .pl-land {
    --ink: #F1EAD9; --ink-soft: #B3A48A; --accent: #D4AF6A; --deep: #1C1712;
    position: relative; min-height: 100vh; overflow: hidden;
    background: var(--deep); color: var(--ink);
    font-family: 'Lora', Georgia, serif;
    display: flex; flex-direction: column;
  }
  .pl-land *, .pl-land *::before, .pl-land *::after { box-sizing: border-box; }

  /* ── Background ─────────────────────────────────────────────────────── */
  .pl-land__aurora { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .pl-land__blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.5; }
  .pl-land__blob--a { width: 46vw; height: 46vw; background: #7A2E2E; top: -14vw; inset-inline-start: -8vw; animation: plDrift 26s ease-in-out infinite; }
  .pl-land__blob--b { width: 38vw; height: 38vw; background: #A9772F; bottom: -12vw; inset-inline-end: -6vw; animation: plDrift 32s ease-in-out infinite reverse; }
  .pl-land__blob--c { width: 30vw; height: 30vw; background: #4A3520; top: 32%; inset-inline-end: 22%; opacity: 0.35; animation: plDrift 38s ease-in-out infinite; }
  .pl-land__grid {
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(to bottom, transparent 0 44px, rgba(212,175,106,0.07) 44px 45px);
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
    /* Fixed marketing copy (not arbitrary Workspace/user content), so the
       script font is safe here — the notebook theme's clearest signal. */
    font-family: 'Caveat', cursive; font-weight: 600;
    font-size: clamp(3.1rem, 9vw, 6rem); line-height: 1;
    letter-spacing: -0.01em; margin: 0 0 20px;
    opacity: 0; transform: translateY(16px);
    transition: opacity .7s ease .12s, transform .7s ease .12s;
  }
  .pl-land__accent {
    /* Third stop swapped 2026-08-15 (WCAG pass) — the original #7A2E2E
       maroon end (tuned for light backgrounds) only cleared 1.91:1 against
       this deep bg even at large-text size (needs 3:1). #C2655E (the
       WCAG-corrected TUTOR_DARK accent-2, dark-mode-appropriate rust)
       clears 4.50:1 and keeps the warm-to-rust gradient feel. */
    background: linear-gradient(100deg, #D4AF6A, #C1615A 60%, #C2655E);
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
    font-family: 'Lora', Georgia, serif; font-size: 1.02rem; font-weight: 700; color: #241A10;
    background: linear-gradient(100deg, #E8C787, #D4AF6A);
    border: none; border-radius: 12px; padding: 15px 30px; cursor: pointer;
    box-shadow: 0 10px 34px rgba(212,175,106,0.32);
    opacity: 0; transform: translateY(12px);
    transition: opacity .7s ease .28s, transform .22s, box-shadow .22s;
  }
  .pl-land__cta:hover { transform: translateY(-2px); box-shadow: 0 16px 44px rgba(212,175,106,0.46); }
  .pl-land__cta:focus-visible { outline: 2px solid #F3ECD8; outline-offset: 3px; }

  .pl-land__points {
    list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 26px;
    padding: 0; margin: 24px 0 0; font-size: 0.86rem; color: var(--ink-soft);
    opacity: 0; transition: opacity .7s ease .36s;
  }
  .pl-land__points li { display: flex; align-items: center; gap: 7px; }
  .pl-land__points svg { color: #D4AF6A; }

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
    background: #241D16; border: 1px solid rgba(241,234,217,0.12); border-bottom: none;
    box-shadow: 0 -10px 80px rgba(0,0,0,0.6);
    transform: rotateX(9deg) translateY(14px); transform-origin: top center;
    opacity: 0; transition: opacity .9s ease .42s, transform .9s ease .42s;
    position: relative;
  }
  .is-in .pl-prev { opacity: 1; transform: rotateX(5deg) translateY(0); }
  /* Leather-ledger stitched seam along the mockup's top edge, echoing the
     same treatment used on the real in-app sidebar. */
  .pl-prev::before {
    content: ""; position: absolute; top: 0; left: 14px; right: 14px; height: 1px;
    background-image: repeating-linear-gradient(to right, rgba(212,175,106,0.5) 0 5px, transparent 5px 10px);
    z-index: 1;
  }

  .pl-prev__bar { display: flex; gap: 6px; padding: 11px 14px; background: #17130D; border-bottom: 1px solid rgba(241,234,217,0.08); }
  .pl-prev__bar span { width: 9px; height: 9px; border-radius: 50%; background: rgba(241,234,217,0.18); }
  .pl-prev__body { display: flex; min-height: 260px; }
  .pl-prev__side { width: 180px; flex-shrink: 0; padding: 18px 14px; background: #17130D; border-inline-end: 1px solid rgba(241,234,217,0.08); }
  .pl-prev__mark { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, #D4AF6A, #7A2E2E); margin-bottom: 14px; }
  .pl-prev__line { height: 7px; border-radius: 4px; background: rgba(241,234,217,0.1); margin-bottom: 8px; }
  .pl-prev__line.is-tall { height: 13px; }
  .is-w40 { width: 40%; } .is-w50 { width: 50%; } .is-w60 { width: 60%; }
  .is-w70 { width: 70%; } .is-w80 { width: 80%; }
  .pl-prev__nav { margin-top: 20px; display: flex; flex-direction: column; gap: 7px; }
  .pl-prev__nav span { height: 9px; border-radius: 4px; background: rgba(241,234,217,0.07); width: 86%; }
  .pl-prev__nav span.is-active { background: rgba(212,175,106,0.55); width: 94%; }

  .pl-prev__main { flex: 1; padding: 20px; }
  .pl-prev__head { margin-bottom: 18px; }
  .pl-prev__cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .pl-prev__card { background: rgba(241,234,217,0.035); border: 1px solid rgba(241,234,217,0.08); border-radius: 9px; padding: 10px; }
  .pl-prev__cover { height: 52px; border-radius: 6px; margin-bottom: 9px; background: linear-gradient(120deg, #7A2E2E, #A9772F); opacity: 0.8; }
  .pl-prev__cover.is-alt { background: linear-gradient(120deg, #4A3520, #D4AF6A); }
  .pl-prev__cover.is-alt2 { background: linear-gradient(120deg, #C1615A, #A9772F); }
  .pl-prev__bar-fill { height: 5px; border-radius: 3px; background: rgba(241,234,217,0.09); margin-top: 9px; overflow: hidden; }
  .pl-prev__bar-fill i { display: block; height: 100%; background: #D4AF6A; border-radius: 3px; }

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
    /* Fixed section heading, not arbitrary content — safe for the script font. */
    font-family: 'Caveat', cursive; font-weight: 600;
    font-size: clamp(2.1rem, 4.2vw, 2.8rem); margin: 0 0 6px;
  }
  .pl-plans__lead { color: var(--ink-soft); font-size: 0.94rem; margin: 0 0 22px; }

  /* Card/cycle/add-on styling for this section now lives in PLAN_PICKER_CARDS_CSS
     (layout="carousel") — the .lw-plancards__* rules pulled in below. */

  /* ── Foot ───────────────────────────────────────────────────────────── */
  .pl-land__foot {
    position: relative; z-index: 2; text-align: center;
    padding: 26px 24px 22px; font-size: 0.8rem; color: rgba(179,164,138,0.75);
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
  ${PLAN_PICKER_CARDS_CSS}
`;
