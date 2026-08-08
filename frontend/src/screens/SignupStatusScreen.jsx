import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, Clock, CheckCircle2, CreditCard, XCircle, RotateCcw } from "lucide-react";
import * as api from "../api/client";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";

/* =========================================================================
   SIGNUP STATUS — /apply/status/{token}

   The Signup Status Link (BA-008). An applicant has no Identity yet, so there
   is nothing to log in to — this token is their only way back to their own
   application.

   Every message here comes from §7.1's "What the Prospective Tutor Sees",
   supplied by the API rather than assembled in the client, so the wording that
   reaches an applicant lives in one place. In particular Rejected and Expired
   read very differently (BA-007): one is a decision about them, the other is
   only a clock that ran out.
   ========================================================================= */

const LOOK = {
  Submitted:               { icon: Clock,        tone: "wait" },
  UnderReview:             { icon: Clock,        tone: "wait" },
  ApprovedAwaitingPayment: { icon: CreditCard,   tone: "act"  },
  PaymentFailed:           { icon: RotateCcw,    tone: "warn" },
  Paid:                    { icon: CheckCircle2, tone: "good" },
  Rejected:                { icon: XCircle,      tone: "done" },
  Expired:                 { icon: XCircle,      tone: "done" },
};

export default function SignupStatusScreen({ token, onApplyAgain }) {
  useFonts();
  const { t } = useLanguage();

  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getSignupStatus(token)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token]);

  async function pay(succeeded) {
    setPaying(true);
    setError(null);
    try {
      setStatus(await api.recordSignupPayment(token, succeeded));
    } catch (e) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  }

  if (error && !status) {
    return (
      <Shell>
        <div className="pl-stat__card is-done">
          <AlertCircle size={26} aria-hidden="true" />
          <h1>{t("signupStatus.invalidTitle")}</h1>
          <p>{error}</p>
        </div>
      </Shell>
    );
  }

  if (!status) {
    return (
      <Shell>
        <div className="pl-stat__card">
          <LoaderCircle size={22} className="pl-stat__spin" aria-hidden="true" />
          <p className="pl-stat__muted">{t("signupStatus.checking")}</p>
        </div>
      </Shell>
    );
  }

  const look = LOOK[status.status] ?? { icon: Clock, tone: "wait" };
  const Icon = look.icon;
  const deadline = status.paymentWindowEndsAt
    ? new Date(status.paymentWindowEndsAt).toLocaleDateString(undefined, { day: "numeric", month: "long" })
    : null;

  return (
    <Shell>
      <div className={`pl-stat__card is-${look.tone}`}>
        <div className="pl-stat__mark" aria-hidden="true"><Icon size={22} /></div>
        <div className="pl-stat__eyebrow">{t("signupStatus.eyebrow")}</div>
        <h1>{status.headline}</h1>
        <p className="pl-stat__lead">{status.detail}</p>

        {error && (
          <div className="pl-stat__alert" role="alert">
            <AlertCircle size={15} aria-hidden="true" /> <span>{error}</span>
          </div>
        )}

        {status.canPay && (
          <div className="pl-stat__pay">
            {deadline && <p className="pl-stat__deadline">{t("signupStatus.completeBy", { date: deadline })}</p>}
            <button className="pl-stat__primary" disabled={paying} onClick={() => pay(true)}>
              {paying
                ? <><LoaderCircle size={15} className="pl-stat__spin" /> {t("signupStatus.processing")}</>
                : <><CreditCard size={15} /> {t("signupStatus.completePayment")}</>}
            </button>
            {/* No payment processor is integrated yet — BA-006 leaves the
                processor call itself as the one genuinely external step. This
                stands in for it so the flow can be exercised end to end. */}
            <button className="pl-stat__ghost" disabled={paying} onClick={() => pay(false)}>
              {t("signupStatus.simulateFailed")}
            </button>
            <p className="pl-stat__note">{t("signupStatus.simulateNote")}</p>
          </div>
        )}

        {status.status === "Expired" && (
          <button className="pl-stat__primary" onClick={onApplyAgain}>{t("signupStatus.applyAgain")}</button>
        )}

        <dl className="pl-stat__meta">
          <div><dt>{t("signupStatus.name")}</dt><dd>{status.fullName}</dd></div>
          <div><dt>{t("signupStatus.email")}</dt><dd>{status.email}</dd></div>
          <div><dt>{t("signupStatus.applied")}</dt><dd>{new Date(status.submittedAt).toLocaleDateString()}</dd></div>
        </dl>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="pl-stat">
      <style>{CSS}</style>
      <div className="pl-stat__langtoggle"><LanguageToggle /></div>
      {children}
    </div>
  );
}

const CSS = `
  .pl-stat {
    --ink: #F2F5FA; --ink-soft: #98A2B5; --accent: #5B8DEF;
    font-family: 'Karla', system-ui, sans-serif; color: var(--ink);
    background: #0B0F16; min-height: 100vh; position: relative;
    display: flex; align-items: center; justify-content: center; padding: 40px 22px;
  }
  .pl-stat *, .pl-stat *::before, .pl-stat *::after { box-sizing: border-box; }
  .pl-stat__langtoggle { position: absolute; top: 20px; inset-inline-end: 20px; }

  .pl-stat__card {
    width: 100%; max-width: 440px; text-align: center;
    background: #12171F; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px; padding: 34px 30px;
  }
  .pl-stat__mark {
    width: 48px; height: 48px; border-radius: 13px; margin: 0 auto 16px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(91,141,239,0.16); color: var(--accent);
  }
  .is-good .pl-stat__mark { background: rgba(127,211,184,0.16); color: #7FD3B8; }
  .is-warn .pl-stat__mark { background: rgba(224,168,62,0.16); color: #E0A83E; }
  .is-done .pl-stat__mark { background: rgba(255,255,255,0.07); color: var(--ink-soft); }
  .is-act  .pl-stat__mark { background: rgba(91,141,239,0.2); }

  .pl-stat__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 8px;
  }
  .pl-stat h1 { font-family: 'Fraunces', Georgia, serif; font-size: 1.4rem; font-weight: 600; margin: 0 0 10px; line-height: 1.25; }
  .pl-stat__lead { color: var(--ink-soft); font-size: 0.9rem; line-height: 1.65; margin: 0; }

  .pl-stat__pay { margin-top: 24px; display: flex; flex-direction: column; gap: 9px; }
  .pl-stat__deadline { font-size: 0.83rem; color: #E0A83E; margin: 0 0 4px; }
  .pl-stat__primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.93rem; font-weight: 600;
    color: #08111F; background: linear-gradient(100deg, #7FB0FF, #5B8DEF);
    border: none; border-radius: 10px; padding: 12px 18px; cursor: pointer;
  }
  .pl-stat__primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .pl-stat__ghost {
    font-family: inherit; font-size: 0.84rem; color: var(--ink-soft);
    background: transparent; border: 1px solid rgba(255,255,255,0.14);
    border-radius: 9px; padding: 9px 14px; cursor: pointer;
  }
  .pl-stat__ghost:hover:not(:disabled) { color: var(--ink); }
  .pl-stat__note { font-size: 0.75rem; color: var(--ink-soft); margin: 2px 0 0; opacity: 0.8; }

  .pl-stat__alert {
    display: flex; align-items: flex-start; gap: 8px; text-align: start;
    background: rgba(224,97,90,0.12); border: 1px solid rgba(224,97,90,0.4);
    color: #E0615A; border-radius: 9px; padding: 9px 11px; margin-top: 16px; font-size: 0.84rem;
  }

  .pl-stat__meta {
    display: flex; justify-content: center; gap: 22px; flex-wrap: wrap;
    margin: 26px 0 0; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.08);
  }
  .pl-stat__meta div { text-align: start; }
  .pl-stat__meta dt {
    font-family: 'IBM Plex Mono', monospace; font-size: 9.5px;
    letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 3px;
  }
  .pl-stat__meta dd { margin: 0; font-size: 0.84rem; }

  .pl-stat__muted { color: var(--ink-soft); font-size: 0.88rem; margin: 12px 0 0; }
  .pl-stat__spin { animation: plStatSpin 0.9s linear infinite; }
  @keyframes plStatSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pl-stat__spin { animation: none; } }

  ${LANGUAGE_TOGGLE_CSS}
`;
