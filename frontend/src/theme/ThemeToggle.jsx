import { Moon, Sun } from "lucide-react";
import { useTheme } from "./useTheme";
import { useLanguage } from "../i18n/useLanguage";

/** A small icon switch between Light and Dark, dropped next to LanguageToggle in the account bar. */
export default function ThemeToggle({ className = "" }) {
  const { mode, toggleMode } = useTheme();
  const { t } = useLanguage();
  const isDark = mode === "dark";
  return (
    <button
      type="button"
      className={`lw-themetoggle ${className}`}
      onClick={toggleMode}
      aria-pressed={isDark}
      aria-label={isDark ? t("themeToggle.switchToLight") : t("themeToggle.switchToDark")}
      title={isDark ? t("themeToggle.switchToLight") : t("themeToggle.switchToDark")}
    >
      {isDark ? <Moon size={14} /> : <Sun size={14} />}
    </button>
  );
}

export const THEME_TOGGLE_CSS = `
  .lw-themetoggle {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; padding: 0; border-radius: 50%;
    background: var(--surface-2, #F0EFEA); color: var(--ink-soft, #6A7383);
    border: 1px solid transparent; cursor: pointer; transition: all .15s;
  }
  .lw-themetoggle:hover { color: var(--ink, #1B2430); border-color: var(--line, #E1DED7); }
`;
