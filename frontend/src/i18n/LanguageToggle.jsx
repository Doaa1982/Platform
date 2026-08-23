import { Languages } from "lucide-react";
import { useLanguage } from "./useLanguage";
import { LANGUAGES } from "./languageStore";

/**
 * A small pill switch between the two supported languages, dropped wherever
 * the shell has room for it (account bar, pre-auth headers). `compact` drops
 * both language labels for a single icon button that cycles to the other
 * language on click — for the account bar at narrow widths, where showing
 * "English" and "العربية" side by side was the single biggest contributor to
 * it wrapping onto two rows.
 */
export default function LanguageToggle({ className = "", compact = false }) {
  const { lang, setLang } = useLanguage();

  if (compact) {
    const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
    const next = LANGUAGES.find((l) => l.code !== lang) ?? LANGUAGES[0];
    return (
      <button
        type="button"
        className={`lw-langtoggle lw-langtoggle--compact ${className}`}
        aria-label={next.nativeLabel}
        title={next.nativeLabel}
        onClick={() => setLang(next.code)}
      >
        <Languages size={13} aria-hidden="true" />
        {current.code.toUpperCase()}
      </button>
    );
  }

  return (
    <div className={`lw-langtoggle ${className}`} role="group" aria-label="Language">
      <Languages size={13} className="lw-langtoggle__icon" aria-hidden="true" />
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`lw-langtoggle__btn ${lang === l.code ? "is-active" : ""}`}
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
        >
          {l.nativeLabel}
        </button>
      ))}
    </div>
  );
}

export const LANGUAGE_TOGGLE_CSS = `
  .lw-langtoggle { display: inline-flex; align-items: center; gap: 2px; background: var(--surface-2, #F0EFEA); border-radius: 20px; padding: 3px; }
  .lw-langtoggle__icon { margin-inline-start: 6px; margin-inline-end: 2px; color: var(--ink-soft, #6A7383); flex-shrink: 0; }
  .lw-langtoggle__btn { font-family: inherit; font-size: 11px; font-weight: 600; border: 1px solid var(--line, #E1DED7); background: transparent; color: var(--ink-soft, #6A7383); border-radius: 16px; padding: 4px 10px; cursor: pointer; transition: all .15s; }
  .lw-langtoggle__btn.is-active { background: var(--accent, #2D5BD1); color: #fff; }
  .lw-langtoggle__btn:hover:not(.is-active) { color: var(--ink, #1B2430); background: var(--surface-2, rgba(128,128,128,0.12)); }

  button.lw-langtoggle--compact {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--surface-2, #F0EFEA); color: var(--ink-soft, #6A7383);
    border: none; border-radius: 20px; padding: 5px 9px;
    font-family: inherit; font-size: 10.5px; font-weight: 700; cursor: pointer;
  }
  button.lw-langtoggle--compact:hover { color: var(--ink, #1B2430); }
`;
