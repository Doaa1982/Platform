import { useState, useEffect, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./useTheme";
import { useLanguage } from "../i18n/useLanguage";

/**
 * Speechmatics-style theme toggle:
 * - Single action icon displayed in the top bar at a time (Sun in light mode, Moon in dark mode).
 * - Clicking the icon opens a floating popover dropdown with side-by-side light and dark options,
 *   with the active mode highlighted with a subtle border and pill background.
 */
export default function ThemeToggle({ className = "" }) {
  const { mode, setThemeMode } = useTheme();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const isDark = mode === "dark";

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className={`lw-themetoggle ${className}`}>
      {/* Single action displayed in navbar at a time */}
      <button
        type="button"
        className={`lw-themetoggle__trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("themeToggle.groupLabel") || "Theme"}
        title={isDark ? t("themeToggle.switchToLight") : t("themeToggle.switchToDark")}
      >
        {isDark ? (
          <Moon size={15} strokeWidth={1.8} className="lw-themetoggle__icon" />
        ) : (
          <Sun size={15} strokeWidth={1.8} className="lw-themetoggle__icon" />
        )}
      </button>

      {open && (
        <>
          <div className="lw-themetoggle__scrim" onClick={() => setOpen(false)} />
          <div
            className="lw-themetoggle__menu"
            role="dialog"
            aria-label={t("themeToggle.groupLabel") || "Theme"}
          >
            <div
              className="lw-themetoggle__group"
              role="radiogroup"
              aria-label={t("themeToggle.groupLabel") || "Theme"}
            >
              <button
                type="button"
                className={`lw-themetoggle__option is-light ${!isDark ? "is-active" : ""}`}
                onClick={() => {
                  setThemeMode("light");
                  setOpen(false);
                }}
                role="radio"
                aria-checked={!isDark}
                aria-label={t("themeToggle.switchToLight")}
                title={t("themeToggle.switchToLight")}
              >
                <Sun size={14} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className={`lw-themetoggle__option is-dark ${isDark ? "is-active" : ""}`}
                onClick={() => {
                  setThemeMode("dark");
                  setOpen(false);
                }}
                role="radio"
                aria-checked={isDark}
                aria-label={t("themeToggle.switchToDark")}
                title={t("themeToggle.switchToDark")}
              >
                <Moon size={14} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export const THEME_TOGGLE_CSS = `
  .lw-themetoggle {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .lw-themetoggle__trigger,
  .lw-accountbar .lw-themetoggle__trigger {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-soft, #6A7383);
    cursor: pointer;
    transition: all .18s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .lw-themetoggle__trigger:hover,
  .lw-themetoggle__trigger.is-open,
  .lw-accountbar .lw-themetoggle__trigger:hover,
  .lw-accountbar .lw-themetoggle__trigger.is-open {
    border-color: var(--bar-line, #E1DED7);
    background: var(--surface-2, rgba(0, 0, 0, 0.04));
    color: var(--bar-ink, #1B2430);
    transform: none;
  }

  [data-theme="dark"] .lw-themetoggle__trigger:hover,
  [data-theme="dark"] .lw-themetoggle__trigger.is-open,
  .dark .lw-themetoggle__trigger:hover,
  .dark .lw-themetoggle__trigger.is-open {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: #F8FAFC;
  }

  .lw-themetoggle__scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  .lw-themetoggle__menu {
    position: absolute;
    top: calc(100% + 8px);
    inset-inline-end: 0;
    z-index: 41;
    background: var(--surface, #FFFFFF);
    border: 1px solid var(--line, #E2E8F0);
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
    padding: 4px;
    display: flex;
    align-items: center;
    animation: lwThemePop 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  [data-theme="dark"] .lw-themetoggle__menu,
  .dark .lw-themetoggle__menu {
    background: #111827;
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  @keyframes lwThemePop {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .lw-themetoggle__group {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .lw-themetoggle__option,
  .lw-accountbar .lw-themetoggle__option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-soft, #64748B);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .lw-themetoggle__option:hover:not(.is-active),
  .lw-accountbar .lw-themetoggle__option:hover:not(.is-active) {
    background: var(--surface-2, rgba(0, 0, 0, 0.04));
    color: var(--ink, #1B2430);
    transform: none;
  }

  [data-theme="dark"] .lw-themetoggle__option:hover:not(.is-active),
  .dark .lw-themetoggle__option:hover:not(.is-active) {
    background: rgba(255, 255, 255, 0.06);
    color: #F8FAFC;
  }

  .lw-themetoggle__option.is-active,
  .lw-accountbar .lw-themetoggle__option.is-active {
    background: var(--surface-2, #F1F5F9);
    border-color: var(--line, #E2E8F0);
    color: var(--ink, #0F172A);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    transform: none;
  }

  [data-theme="dark"] .lw-themetoggle__option.is-active,
  .dark .lw-themetoggle__option.is-active {
    background: #1E293B;
    border-color: rgba(255, 255, 255, 0.14);
    color: #F8FAFC;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  @media (prefers-reduced-motion: reduce) {
    .lw-themetoggle__trigger,
    .lw-themetoggle__menu,
    .lw-themetoggle__option {
      transition: none !important;
      animation: none !important;
    }
  }
`;
