import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import * as api from "../api/client";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import Message from "../components/Message";

/* =========================================================================
   SIGNUP STATUS — /apply/status/{token}

   The Signup Status Link (BA-008). An applicant has no Identity yet, so there
   is nothing to log in to — this token is their only way back to their own
   application.

   Every message here comes from §7.1's "What the Prospective Tutor Sees",
   supplied by the API rather than assembled in the client, so the wording that
   reaches an applicant lives in one place. No payment step lives on this
   screen at all (2026-08-24 correction) — an approved application is
   immediately ready for a Platform Operator to provision a Workspace for;
   which plan (free or paid) that Workspace ends up on is a separate decision
   made later, at Billing.
   ========================================================================= */

const LOOK = {
  Submitted:   { icon: Clock,        tone: "wait" },
  UnderReview: { icon: Clock,        tone: "wait" },
  Approved:    { icon: CheckCircle2, tone: "good" },
  Rejected:    { icon: XCircle,      tone: "done" },
};

export default function SignupStatusScreen({ token }) {
  useFonts();
  const { t } = useLanguage();

  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getSignupStatus(token)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token]);

  if (error && !status) {
    return (
      <Shell>
        <div className="pl-stat__card is-bad">
          <div className="pl-stat__mark" aria-hidden="true"><AlertCircle size={22} /></div>
          <h1>{t("signupStatus.invalidTitle")}</h1>
          <p className="pl-stat__lead">{error}</p>
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

  return (
    <Shell>
      <div className={`pl-stat__card is-${look.tone}`}>
        <div className="pl-stat__mark" aria-hidden="true"><Icon size={22} /></div>
        <div className="pl-stat__eyebrow">{t("signupStatus.eyebrow")}</div>
        <h1>{status.headline}</h1>
        <p className="pl-stat__lead">{status.detail}</p>

        {error && <Message type="error">{error}</Message>}

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
  .is-bad .pl-stat__mark { background: rgba(192,57,43,0.16); color: #E0685A; }

  .pl-stat__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 8px;
  }
  .pl-stat h1 { font-family: 'Fraunces', Georgia, serif; font-size: 1.4rem; font-weight: 600; margin: 0 0 10px; line-height: 1.25; }
  .pl-stat__lead { color: var(--ink-soft); font-size: 0.9rem; line-height: 1.65; margin: 0; }

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
