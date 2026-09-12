import { Moon, Sun } from "lucide-react";
import { useTheme } from "./useTheme";
import { useLanguage } from "../i18n/useLanguage";

/** A segmented light/dark switch (both options always visible, current one highlighted) — dropped next to LanguageToggle in the account bar. */
export default function ThemeToggle({ className = "" }) {
  const { mode, setThemeMode } = useTheme();
  const { t } = useLanguage();
  const isDark = mode === "dark";
  return (
    <span className={`lw-themetoggle ${className}`} role="group" aria-label={t("themeToggle.groupLabel")}>
      <button
        type="button"
        className={`lw-themetoggle__option is-light ${!isDark ? "is-active" : ""}`}
        onClick={() => setThemeMode("light")}
        aria-pressed={!isDark}
        aria-label={t("themeToggle.switchToLight")}
        title={t("themeToggle.switchToLight")}
      >
        <Sun size={13} />
      </button>
      <button
        type="button"
        className={`lw-themetoggle__option is-dark ${isDark ? "is-active" : ""}`}
        onClick={() => setThemeMode("dark")}
        aria-pressed={isDark}
        aria-label={t("themeToggle.switchToDark")}
        title={t("themeToggle.switchToDark")}
      >
        <Moon size={13} />
      </button>
    </span>
  );
}

export const THEME_TOGGLE_CSS = `
  .lw-themetoggle {
    display: inline-flex; align-items: center; gap: 2px;
    background: var(--surface-2, #F0EFEA); border-radius: 9999px; padding: 2px;
  }
  .lw-themetoggle__option {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; padding: 0; border-radius: 50%; border: none;
    background: transparent; color: var(--ink-soft, #6A7383); cursor: pointer;
    transition: background .2s ease, color .2s ease, box-shadow .2s ease, transform .15s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .lw-themetoggle__option:hover:not(.is-active) { color: var(--ink, #1B2430); transform: scale(1.08); }
  .lw-themetoggle__option:active { transform: scale(0.9); }
  .lw-themetoggle__option.is-active {
    background: var(--surface, #fff); box-shadow: 0 1px 4px rgba(0,0,0,0.16);
  }
  .lw-themetoggle__option.is-light.is-active { color: #B8790A; }
  .lw-themetoggle__option.is-dark.is-active { color: #7C8CFF; }
  @media (prefers-reduced-motion: reduce) {
    .lw-themetoggle__option { transition: background .2s ease, color .2s ease; }
    .lw-themetoggle__option:hover:not(.is-active), .lw-themetoggle__option:active { transform: none; }
  }
`;
