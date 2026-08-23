import { AlertTriangle } from "lucide-react";

/* =========================================================================
   NOTICE — the shared way to show a state of the page or a pre-action
   warning, replacing what used to be four independently-defined,
   byte-identical `*__readonly`/`*__empty` rules per screen.

   Three tones, each one visual identity used consistently everywhere:
     "empty"    — dashed-border card: "nothing here yet" / onboarding steps.
     "readonly" — a small italic one-liner: "you can view but not change this."
     "warning"  — amber, `AlertTriangle`-led: consequences of an action the
                  tutor is about to take, lifted from what was previously
                  WorkspaceSetupScreen's one-off `.lw-setup__slugwarning`.

   Relies on this app's global CSS custom properties (--surface, --line,
   --ink, --ink-soft, --radius, --radius-sm, --font-display) defined in
   App.jsx's theme objects — safe here because, unlike InfoTip/Message,
   Notice is only ever used post-login, where App.jsx's own <style> (and
   its per-role theme values) is already mounted, whichever of the owner
   or learner shells is active. It's not used pre-auth.
   ========================================================================= */

export default function Notice({ tone = "readonly", layout = "column", icon: Icon, title, action, style, children }) {
  if (!children) return null;

  if (tone === "warning") {
    return (
      <div className="lw-notice lw-notice--warning" style={style}>
        {Icon ? <Icon size={15} /> : <AlertTriangle size={15} />}
        <div className="lw-notice__body">{children}</div>
      </div>
    );
  }

  if (tone === "readonly") {
    return <p className="lw-notice lw-notice--readonly" style={style}>{children}</p>;
  }

  // tone === "empty"
  if (layout === "row") {
    return (
      <div className="lw-notice lw-notice--empty lw-notice--row" style={style}>
        {Icon && <span className="lw-notice__iconchip"><Icon size={20} /></span>}
        <div className="lw-notice__body">
          {children}
          {action}
        </div>
      </div>
    );
  }

  return (
    <div className="lw-notice lw-notice--empty" style={style}>
      {Icon && <Icon size={26} />}
      {title && <h2>{title}</h2>}
      {children}
      {action}
    </div>
  );
}
