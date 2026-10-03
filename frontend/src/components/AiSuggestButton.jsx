import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, LoaderCircle, Lock, Sparkles, X } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import { useAiAccess } from "../ai/useAiAccess";
import { AI_FIX_SCREEN, aiErrorKind } from "../ai/aiAccessStore";

/* =========================================================================
   AI SUGGEST BUTTON — every "Suggest with AI"-style action, so whether it
   will work is visible before it's clicked (2026-10-03: on Free, branding
   suggestions failed with a 4-second toast in the far corner and teachers
   thought the button did nothing).

   · Available (or unknown): today's ghost button, Sparkles + busy spinner.
   · Not available for this workspace (plan, credits, paused subscription):
     a Lock icon, muted, aria-disabled (still focusable), and a click opens a
     note right beside it saying why and linking to the fix. Never calls the API.

   AiErrorNote shows what a call that did go out came back with, inline under
   the field, until the teacher retries or dismisses it — not the toast.
   ========================================================================= */

const MESSAGE = { plan: "ai.notInPlan", credits: "ai.noCredits", inactive: "ai.inactive", failed: "ai.failed" };
const ACTION = { plan: "ai.seePlans", credits: "ai.getCredits", inactive: "ai.openBilling" };

function NoteBody({ kind, navigate }) {
  const { t } = useLanguage();
  const fix = AI_FIX_SCREEN[kind];
  return (
    <div className="lw-ainote__body">
      <p>{t(MESSAGE[kind])}</p>
      {fix && navigate && (
        <button type="button" className="lw-ainote__action" onClick={() => navigate(fix)}>{t(ACTION[kind])}</button>
      )}
    </div>
  );
}

export default function AiSuggestButton({ domain, onClick, busy = false, disabled = false, label, title, size = "xs", iconSize = 12, icon: Icon = Sparkles }) {
  const { state, navigate } = useAiAccess(domain);
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const anchor = useRef(null);
  const locked = state === "plan" || state === "credits" || state === "inactive";

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e) => { if (anchor.current && !anchor.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  const className = `lw-btn lw-btn--ghost lw-btn--${size}`;
  if (!locked) {
    return (
      <button type="button" className={className} onClick={onClick} disabled={disabled || busy} title={title ?? label}>
        {busy ? <LoaderCircle size={iconSize} className="lw-ai-spin" /> : <Icon size={iconSize} />} {label}
      </button>
    );
  }

  return (
    <span className="lw-ainote-anchor" ref={anchor}>
      <button type="button" className={`${className} lw-ai-locked`} aria-disabled="true" aria-expanded={open}
              aria-controls={open ? noteId : undefined}
              onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}>
        <Lock size={iconSize} /> {label}
      </button>
      {open && (
        <span id={noteId} role="dialog" aria-label={label} className="lw-ainote lw-ainote--pop">
          <Lock size={14} className="lw-ainote__icon" />
          <NoteBody kind={state} navigate={navigate} />
          <button type="button" className="lw-ainote__close" onClick={() => setOpen(false)} aria-label={t("ai.dismiss")}><X size={13} /></button>
        </span>
      )}
    </span>
  );
}

/** A failed AI call's outcome, inline under its field. `error` is the ApiError the call threw. */
export function AiErrorNote({ error, domain, onDismiss }) {
  const { t } = useLanguage();
  const { refresh, navigate } = useAiAccess(domain);
  const kind = error ? aiErrorKind(error) : null;

  // A refusal means what this screen believed about the plan or balance is out of date.
  useEffect(() => { if (kind === "plan" || kind === "credits") refresh(); }, [error, kind, refresh]);

  if (!error) return null;
  return (
    <div className="lw-ainote lw-ainote--inline" role="alert">
      <AlertCircle size={14} className="lw-ainote__icon" />
      <NoteBody kind={kind} navigate={navigate} />
      {onDismiss && (
        <button type="button" className="lw-ainote__close" onClick={onDismiss} aria-label={t("ai.dismiss")}><X size={13} /></button>
      )}
    </div>
  );
}
