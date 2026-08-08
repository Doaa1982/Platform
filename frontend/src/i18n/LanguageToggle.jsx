import { Languages } from "lucide-react";
import { useLanguage } from "./useLanguage";
import { LANGUAGES } from "./languageStore";

/** A small pill switch between the two supported languages, dropped wherever the shell has room for it (account bar, pre-auth headers). */
export default function LanguageToggle({ className = "" }) {
  const { lang, setLang } = useLanguage();
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
  .lw-langtoggle__btn { font-family: inherit; font-size: 11px; font-weight: 600; border: none; background: transparent; color: var(--ink-soft, #6A7383); border-radius: 16px; padding: 4px 10px; cursor: pointer; transition: all .15s; }
  .lw-langtoggle__btn.is-active { background: var(--accent, #2D5BD1); color: #fff; }
  .lw-langtoggle__btn:hover:not(.is-active) { color: var(--ink, #1B2430); }
`;
