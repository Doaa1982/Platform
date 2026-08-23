import { Bot, X } from "lucide-react";
import { useDismissedTip } from "../hooks/useDismissedTip";

/* =========================================================================
   TUTOR TIP — the literal "sticky note": optional, dismissible workflow
   advice for the tutor. Built on .lw-aicard (App.jsx), already this app's
   warm-toned "sticky note" callout for AI feedback — this extends the same
   visual language to proactive tips, minus the Student-only tilt (that rule
   is scoped to .lw-root--learner, so a TutorTip under the owner shell stays
   flat automatically, no override needed).

   `id` is a stable per-tip key used for the dismiss-and-stay-dismissed flag
   (see useDismissedTip) — pick one that won't collide or get reused for a
   different tip later (e.g. "studio.quizGenSaveTip").
   ========================================================================= */
export default function TutorTip({ id, icon: Icon = Bot, children }) {
  const [dismissed, dismiss] = useDismissedTip(id);
  if (dismissed || !children) return null;

  return (
    <div className="lw-aicard lw-tutortip">
      <Icon size={16} />
      <div className="lw-aicard__body">{children}</div>
      <button type="button" className="lw-aicard__dismiss" onClick={dismiss} aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  );
}
