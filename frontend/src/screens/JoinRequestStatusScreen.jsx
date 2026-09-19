import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import * as api from "../api/client";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import Message from "../components/Message";

/* =========================================================================
   JOIN REQUEST STATUS — /join-requests/status/{token}

   The Join Request Status Link (§16, "Checking back without an Identity" —
   TD-018). A requester has no Identity and no credential at this stage, so
   this token is their only way back to their own request — same mechanism
   and same screen shape as SignupStatusScreen, plus a Cancel Request action
   this status link uniquely supports (JoinRequest.Cancel existed from
   the start, but nothing ever called it until this screen and its backend
   endpoint were added).
   ========================================================================= */

const LOOK = {
  Submitted: { icon: Clock, tone: "wait" },
  Approved:  { icon: CheckCircle2, tone: "good" },
  Declined:  { icon: XCircle, tone: "done" },
  Cancelled: { icon: XCircle, tone: "done" },
};

export default function JoinRequestStatusScreen({ token }) {
  useFonts();
  const { t } = useLanguage();

  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getJoinRequestStatus(token)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token]);

  async function handleCancelRequest() {
    if (!window.confirm(t("joinStatus.confirmCancel"))) return;
    setCancelling(true);
    setError(null);
    try {
      await api.cancelJoinRequest(token);
      setStatus((s) => ({ ...s, status: "Cancelled", headline: t("joinStatus.cancelledHeadline"), detail: t("joinStatus.cancelledDetail") }));
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  }

  if (error && !status) {
    return (
      <Shell>
        <div className="pl-stat__card is-bad">
          <div className="pl-stat__mark" aria-hidden="true"><AlertCircle size={22} /></div>
          <h1>{t("joinStatus.invalidTitle")}</h1>
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
          <p className="pl-stat__muted">{t("joinStatus.checking")}</p>
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
        <div className="pl-stat__eyebrow">{t("joinStatus.eyebrow")}</div>
        <h1>{status.headline}</h1>
        <p className="pl-stat__lead">{status.detail}</p>

        {error && <Message type="error">{error}</Message>}

        <dl className="pl-stat__meta">
          <div><dt>{t("joinStatus.name")}</dt><dd>{status.fullName}</dd></div>
          <div><dt>{t("joinStatus.email")}</dt><dd>{status.email}</dd></div>
          <div><dt>{t("joinStatus.asked")}</dt><dd>{new Date(status.submittedAt).toLocaleDateString()}</dd></div>
        </dl>

        {status.status === "Submitted" && (
          <button className="pl-stat__cancel" disabled={cancelling} onClick={handleCancelRequest}>
            {cancelling ? t("joinStatus.cancelling") : t("joinStatus.cancel")}
          </button>
        )}
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

  .pl-stat__cancel {
    margin-top: 22px; font-family: 'Karla', system-ui, sans-serif; font-size: 0.85rem;
    color: #E0A83E; background: transparent; border: 1px solid rgba(224,168,62,0.4);
    border-radius: 8px; padding: 8px 16px; cursor: pointer;
  }
  .pl-stat__cancel:disabled { opacity: 0.6; cursor: default; }

  ${LANGUAGE_TOGGLE_CSS}
`;
