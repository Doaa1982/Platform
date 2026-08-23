import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

/* =========================================================================
   MESSAGE — the shared way to show a success, error or failure outcome.

   UIC-005, decided 2026-08-09 (revised same day): a toast fixed to the
   page's top-right corner, auto-vanishing after a few seconds — not an
   inline banner. Position is fixed rather than absolute so it floats above
   everything regardless of where in the DOM it's mounted (including inside
   a modal), since none of this app's overlay/panel wrappers use `transform`
   to center themselves (that would create a containing block and break
   `position: fixed`) — confirmed against `.lw-overlay` etc.

   Colors use `var(--token, fixedFallback)` rather than a bare theme token —
   pre-auth screens never mount inside `.lw-root`, so no `--danger`/
   `--surface` exist there and the fallback (this component's original
   fixed light values) is what renders, same portability InfoTip/
   RequiredMark rely on (UIC-001/UIC-002). Post-login, `.lw-root`'s theme
   vars are inherited (Message is still a DOM descendant despite floating
   via `position: fixed`), so the toast now follows dark mode instead of
   always looking light-mode (2026-08-21 fix — see --success/--danger in
   App.jsx's theme palettes).
   ========================================================================= */

const VISIBLE_MS = 4200;
const FADE_MS = 300;

const BASE_STYLE = {
  position: "fixed", top: 20, right: 20, zIndex: 9999,
  display: "flex", alignItems: "center", gap: 9,
  maxWidth: 360, borderRadius: 10, borderWidth: 1, borderStyle: "solid",
  padding: "12px 15px", fontSize: "0.87rem", lineHeight: 1.4,
  background: "var(--surface, #fff)", boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
};

const VARIANTS = {
  error: {
    Icon: AlertCircle, color: "var(--danger, #C0392B)",
    background: "color-mix(in srgb, var(--danger, #C0392B) 12%, var(--surface, #FDF1EF))",
    borderColor: "color-mix(in srgb, var(--danger, #C0392B) 35%, transparent)",
  },
  success: {
    // color nudged 2026-08-15 (WCAG pass) — #1E7F63 cleared only 4.48:1
    // against this background (needs 4.5:1); #1E7D61 clears 4.59:1. Reused
    // as --success's light-theme value in App.jsx.
    Icon: CheckCircle2, color: "var(--success, #1E7D61)",
    background: "color-mix(in srgb, var(--success, #1E7D61) 12%, var(--surface, #EBF7F2))",
    borderColor: "color-mix(in srgb, var(--success, #1E7D61) 35%, transparent)",
  },
};

/**
 * `type`: "error" (default) or "success". Renders nothing when there is no
 * message. Shows for `VISIBLE_MS`, then fades out and unmounts on its own —
 * the caller never has to clear it, just keep setting local error/success
 * state as this app already did everywhere.
 *
 * Keyed by its own text onto an inner `Toast` so that a *new* outcome (even
 * of the same type, while the last one is still showing or fading) remounts
 * a fresh instance rather than updating the old one in place — the natural
 * way to restart the visible/fade timer without touching a ref during
 * render, which this app's stricter (React Compiler) lint rules disallow.
 */
export default function Message({ type = "error", children }) {
  if (!children) return null;
  const key = `${type}:${typeof children === "string" ? children : "jsx"}`;
  return <Toast key={key} type={type}>{children}</Toast>;
}

function Toast({ type, children }) {
  const [phase, setPhase] = useState("shown");

  useEffect(() => {
    const toLeaving = setTimeout(() => setPhase("leaving"), VISIBLE_MS);
    const toHidden = setTimeout(() => setPhase("hidden"), VISIBLE_MS + FADE_MS);
    return () => { clearTimeout(toLeaving); clearTimeout(toHidden); };
  }, []);

  if (phase === "hidden") return null;
  const { Icon, color, background, borderColor } = VARIANTS[type] ?? VARIANTS.error;
  const leaving = phase === "leaving";

  return (
    <div
      className="ui-message"
      role={type === "error" ? "alert" : "status"}
      style={{
        ...BASE_STYLE, color, background, borderColor,
        opacity: leaving ? 0 : 1,
        transform: leaving ? "translateY(-6px)" : "translateY(0)",
      }}
    >
      <Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      {children}
    </div>
  );
}
