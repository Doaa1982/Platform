import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, CheckCircle2, ArrowRight, Building2 } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";
import Message from "../components/Message";

/* =========================================================================
   INVITE SCREEN — /invite/{token}

   Anonymous by necessity: an invitation link has to work for someone with no
   account yet. The token in the URL is the credential, and Workspace
   Resolution happens before any authentication.

   Two shapes, decided by whether the invited email already owns an Identity:
     new person      → name + a password to set
     existing person → their existing password, to prove it is really them
                        rather than merely someone holding the link
   ========================================================================= */

export default function InviteScreen({ token, onAccepted }) {
  useFonts();
  const { adoptSession } = useAuth();
  const { t } = useLanguage();

  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.previewInvitation(token)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((e) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const session = await api.acceptInvitation(token, {
        fullName: preview.accountExists ? undefined : fullName.trim(),
        password,
      });

      // Through the provider, never straight to storage: whoever was signed in
      // before — very often the admin who just copied this link — must be
      // replaced, not left in place for the next screen to read.
      adoptSession({
        token: session.token,
        expiresAt: session.expiresAt,
        fullName: session.fullName,
      });
      setDone(true);
      // Let them read the confirmation before the app takes over
      setTimeout(() => onAccepted(), 1200);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <div className="pl-invite__card pl-invite__card--bad">
          <AlertCircle size={26} aria-hidden="true" />
          <h1>{t("invite.cantOpenTitle")}</h1>
          <p>{loadError}</p>
          <p className="pl-invite__muted">{t("invite.cantOpenHint")}</p>
        </div>
      </Shell>
    );
  }

  if (!preview) {
    return (
      <Shell>
        <div className="pl-invite__card">
          <LoaderCircle size={22} className="pl-invite__spin" aria-hidden="true" />
          <p className="pl-invite__muted">{t("invite.checking")}</p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="pl-invite__card pl-invite__card--good">
          <CheckCircle2 size={26} aria-hidden="true" />
          <h1>{t("invite.doneTitle")}</h1>
          <p>{t("invite.doneBody", { workspace: preview.workspaceName })}</p>
        </div>
      </Shell>
    );
  }

  const expires = new Date(preview.expiresAt).toLocaleDateString(undefined, {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Shell>
      <div className="pl-invite__card">
        <div className="pl-invite__mark" aria-hidden="true"><Building2 size={22} /></div>
        <div className="pl-invite__eyebrow">{t("invite.eyebrow")}</div>
        <h1>{t("invite.joinTitle", { workspace: preview.workspaceName })}</h1>
        <p className="pl-invite__lead">
          {t("invite.leadPrefix")} <strong>{humanise(preview.intendedRole)}</strong>
          {" "}{t("invite.leadUsing")} <strong>{preview.email}</strong>.
        </p>

        <form className="pl-invite__form" onSubmit={handleSubmit} noValidate>
          {error && <Message type="error">{error}</Message>}

          {!preview.accountExists && (
            <label className="pl-invite__field">
              <span>{t("invite.nameLabel")}</span>
              <input
                type="text" autoComplete="name" required autoFocus
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder={t("invite.namePlaceholder")} disabled={submitting}
              />
            </label>
          )}

          <label className="pl-invite__field">
            <span>{preview.accountExists ? t("invite.existingPasswordLabel") : t("invite.newPasswordLabel")}</span>
            <input
              type="password"
              autoComplete={preview.accountExists ? "current-password" : "new-password"}
              required autoFocus={preview.accountExists}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" disabled={submitting}
            />
          </label>

          {preview.accountExists && (
            <p className="pl-invite__note">{t("invite.existingAccountNote")}</p>
          )}

          <button
            type="submit"
            className="pl-invite__btn"
            disabled={submitting || !password || (!preview.accountExists && !fullName.trim())}
          >
            {submitting
              ? (<><LoaderCircle size={16} className="pl-invite__spin" aria-hidden="true" /> {t("invite.accepting")}</>)
              : (<>{t("invite.acceptInvitation")} <ArrowRight size={16} aria-hidden="true" /></>)}
          </button>
        </form>

        <p className="pl-invite__muted">{t("invite.validUntil", { date: expires })}</p>
      </div>
    </Shell>
  );
}

function humanise(role) {
  return String(role ?? "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function Shell({ children }) {
  return (
    <div className="pl-invite">
      <style>{CSS}</style>
      <div className="pl-invite__langtoggle"><LanguageToggle /></div>
      {children}
    </div>
  );
}

const CSS = `
  .pl-invite {
    --ink: #1B2430; --ink-soft: #6A7383; --line: #E1DED7; --accent: #2D5BD1;
    font-family: 'Karla', system-ui, sans-serif; color: var(--ink);
    background: #F7F5F1; min-height: 100vh; position: relative;
    display: flex; align-items: center; justify-content: center; padding: 40px 22px;
  }
  .pl-invite *, .pl-invite *::before, .pl-invite *::after { box-sizing: border-box; }
  .pl-invite__langtoggle { position: absolute; top: 20px; inset-inline-end: 20px; }

  .pl-invite__card {
    width: 100%; max-width: 440px; background: #fff;
    border: 1px solid var(--line); border-radius: 16px; padding: 34px 30px;
    text-align: center;
  }
  .pl-invite__card--bad { border-color: rgba(179,56,43,0.3); color: #B3382B; }
  .pl-invite__card--good { border-color: rgba(30,127,99,0.35); color: #1E7F63; }
  .pl-invite__card--bad h1, .pl-invite__card--good h1 { color: inherit; }

  .pl-invite__mark {
    width: 48px; height: 48px; border-radius: 13px; margin: 0 auto 14px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff;
  }
  .pl-invite__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px;
  }
  .pl-invite h1 {
    font-family: 'Fraunces', Georgia, serif; font-size: 1.6rem;
    font-weight: 600; margin: 0 0 8px; line-height: 1.15;
  }
  .pl-invite__lead { color: var(--ink-soft); font-size: 0.93rem; line-height: 1.6; margin: 0 0 24px; }
  .pl-invite__lead strong { color: var(--ink); }

  /* UIC-003: one property per row — label left, value right. */
  .pl-invite__form { display: grid; grid-template-columns: max-content 1fr; row-gap: 16px; column-gap: 14px; align-items: start; text-align: start; }
  .pl-invite__form > .pl-invite__field { display: contents; }
  .pl-invite__field span:first-child { font-size: 0.82rem; font-weight: 600; padding-top: 11px; white-space: nowrap; }
  .pl-invite__field input {
    width: 100%; font-family: inherit; font-size: 0.95rem; color: var(--ink);
    background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 11px 13px;
  }
  .pl-invite__form > .pl-invite__note,
  .pl-invite__form > .pl-invite__btn {
    grid-column: 1 / -1;
  }
  @media (max-width: 480px) {
    .pl-invite__form { grid-template-columns: 1fr; }
    .pl-invite__form > .pl-invite__field { display: flex; flex-direction: column; gap: 6px; }
    .pl-invite__field span:first-child { padding-top: 0; white-space: normal; }
  }
  .pl-invite__field input:focus-visible {
    outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(45,91,209,0.16);
  }

  .pl-invite__note {
    font-size: 0.8rem; color: var(--ink-soft); text-align: start;
    margin: -6px 0 16px; line-height: 1.5;
  }

  .pl-invite__btn {
    width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.95rem; font-weight: 600;
    color: #fff; background: var(--accent); border: none; border-radius: 10px;
    padding: 12px 16px; cursor: pointer;
  }
  .pl-invite__btn:hover:not(:disabled) { background: #2449AC; }
  .pl-invite__btn:disabled { opacity: 0.55; cursor: not-allowed; }


  .pl-invite__muted { font-size: 0.8rem; color: var(--ink-soft); margin: 18px 0 0; line-height: 1.55; }

  .pl-invite__spin { animation: plInvSpin 0.9s linear infinite; }
  @keyframes plInvSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pl-invite__spin { animation: none; } }

  ${LANGUAGE_TOGGLE_CSS}
`;
