import { LoaderCircle, GraduationCap, AlertCircle } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";
import { useTheme } from "../theme/useTheme";
import LanguageToggle from "../i18n/LanguageToggle";
import ThemeToggle from "../theme/ThemeToggle";
import { paletteFor } from "../theme/palettes";
import { APP_CSS } from "../styles/appCss";

/* =========================================================================
   ENTRY SHELL — every screen someone sees before (or while) getting into a
   workspace: sign in, apply, invitations, join requests, password reset,
   choosing a workspace, errors.

   Renders through the app's own palette and stylesheet (the same tutor
   palette Content Studio uses, light or dark per ThemeContext), so an entry
   screen is the same product as the inside — same tokens, buttons, cards and
   fonts — rather than a look-alike with its own colors. The language switch
   and theme toggle are the exact components the account bar uses.
   ========================================================================= */

export default function EntryShell({ children, wide = false, actions = null }) {
  const { mode } = useTheme();
  const { lang, dir, t } = useLanguage();

  return (
    <div className="lw-root lw-root--owner lw-entry" style={paletteFor("owner", mode)} lang={lang} dir={dir}>
      <style>{APP_CSS}</style>
      <header className="lw-entry__bar">
        <a className="lw-entry__brand" href="/" aria-label={t("entry.homeLink")}>
          <span className="lw-entry__brandmark" aria-hidden="true"><GraduationCap size={17} /></span>
          <span className="lw-entry__brandname">{t("entry.brandName")}</span>
        </a>
        <div className="lw-entry__controls">
          {actions}
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main className={`lw-entry__main ${wide ? "lw-entry__main--wide" : ""}`}>{children}</main>
    </div>
  );
}

/**
 * The one card every narrow entry screen is built from: optional status icon,
 * eyebrow, heading and lead, then whatever the screen needs.
 */
/** `titleDir="auto"` for a heading that is user content (a workspace name), not translated text. */
export function EntryCard({ icon: Icon, tone = "info", eyebrow, title, titleDir, lead, leadDir, children, align = "center" }) {
  return (
    <section className={`lw-card lw-entry__card lw-entry__card--${align}`}>
      {Icon && <div className={`lw-entry__mark lw-entry__mark--${tone}`} aria-hidden="true"><Icon size={22} /></div>}
      {eyebrow && <div className="lw-eyebrow">{eyebrow}</div>}
      {title && <h1 className="lw-entry__title" dir={titleDir}>{title}</h1>}
      {lead && <p className="lw-entry__lead" dir={leadDir}>{lead}</p>}
      {children}
    </section>
  );
}

/** Centered spinner + one line, for "checking your link…" style waits. */
export function EntryLoading({ label }) {
  return (
    <EntryShell>
      <section className="lw-card lw-entry__card lw-entry__card--center" role="status">
        <LoaderCircle size={22} className="lw-entry__spin" aria-hidden="true" />
        <p className="lw-entry__lead">{label}</p>
      </section>
    </EntryShell>
  );
}

/** A labeled form field in the app's input style. */
export function EntryField({ label, hint, children }) {
  return (
    <label className="lw-field">
      <span className="lw-field__label">{label}</span>
      {children}
      {hint && <span className="lw-field__hint">{hint}</span>}
    </label>
  );
}

/** Label/value pairs (name, email, date) — values isolated so mixed scripts never flip punctuation. */
export function EntryFacts({ items }) {
  return (
    <dl className="lw-entry__facts">
      {items.filter(Boolean).map(({ label, value }) => (
        <div key={label}><dt>{label}</dt><dd><bdi>{value}</bdi></dd></div>
      ))}
    </dl>
  );
}

/** A full-page problem state (couldn't load the session, unknown page) with one way out. */
export function EntryError({ icon = AlertCircle, title, lead, actionLabel, onAction }) {
  return (
    <EntryShell>
      <EntryCard icon={icon} tone="bad" title={title} lead={lead}>
        {actionLabel && (
          <div className="lw-entry__actions">
            <button type="button" className="lw-btn lw-btn--accent" onClick={onAction}>{actionLabel}</button>
          </div>
        )}
      </EntryCard>
    </EntryShell>
  );
}
