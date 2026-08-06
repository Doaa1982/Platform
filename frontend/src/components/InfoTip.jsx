import { useId, useState } from "react";
import { Info } from "lucide-react";

/* =========================================================================
   INFO TIP — the shared way to explain what a field or option means.

   Documents/UI Interaction Conventions.md, decided 2026-08-06: explanatory
   text lives in a tooltip revealed on hover/focus, not printed permanently
   under the field. Styled with fixed inline values rather than this app's
   `var(--ink)`-style theme tokens, since those are only ever defined inside
   each screen's own scoped CSS (there is no shared root theme) — inline
   styles are what let this same component drop into any screen, logged in
   or not, without that screen having to register anything for it.
   ========================================================================= */

const TRIGGER_STYLE = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 15, height: 15, borderRadius: "50%", padding: 0, marginLeft: 5,
  background: "rgba(120,128,140,0.18)", color: "#6b7280",
  border: "none", cursor: "help", verticalAlign: "middle", flexShrink: 0,
};

const BUBBLE_STYLE = {
  position: "absolute", left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)",
  width: "max-content", maxWidth: 240, background: "#1B2430", color: "#F2F5FA",
  fontSize: "0.76rem", lineHeight: 1.45, padding: "8px 10px", borderRadius: 6,
  boxShadow: "0 6px 18px rgba(0,0,0,0.28)", zIndex: 60, pointerEvents: "none",
  fontFamily: "system-ui, sans-serif", fontWeight: 400, textAlign: "left",
};

/** A small "i" affordance next to a label; hover or focus it to read `text`. */
export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!text) return null;

  return (
    <span
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button" style={TRIGGER_STYLE}
        aria-describedby={open ? id : undefined} aria-label="More information"
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      >
        <Info size={10} />
      </button>
      {open && <span role="tooltip" id={id} style={BUBBLE_STYLE}>{text}</span>}
    </span>
  );
}
