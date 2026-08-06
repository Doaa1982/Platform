/* =========================================================================
   REQUIRED MARK — the shared way to flag a mandatory field's label.

   Documents/UI Interaction Conventions.md, UIC-002: every required control is
   marked at the label (not just discovered after a rejected submit), and a
   pressed action button on missing/invalid data surfaces what's wrong rather
   than silently staying disabled. Fixed inline styles for the same reason as
   InfoTip — this app has no shared root theme, so a component meant to drop
   into any screen can't lean on `var(--ink)`-style tokens.
   ========================================================================= */

const STYLE = { color: "#C0392B", marginLeft: 3 };

/** Purely visual — the `required` attribute on the control itself carries the a11y semantics. */
export default function RequiredMark() {
  return <span style={STYLE} aria-hidden="true">*</span>;
}

/** Same red, applied to a control's own border once a submit attempt has shown it to be invalid. */
export const invalidFieldStyle = { borderColor: "#C0392B" };
