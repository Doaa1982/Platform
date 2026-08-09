import { useState, useEffect, useCallback, useMemo } from "react";
import { ThemeContext, STORAGE_KEY } from "./themeStore";

function initialMode() {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored === "light" || stored === "dark") return stored;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark" : "light";
}

/**
 * Owns which color mode is active for the main (tutor/learner) app shell.
 * A stored choice always wins; absent one, follows the OS preference live —
 * mirrors LanguageProvider's "explicit override beats a derived default".
 */
export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(initialMode);
  const [hasOverride, setHasOverride] = useState(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return stored === "light" || stored === "dark";
  });

  useEffect(() => {
    if (hasOverride) return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e) => setMode(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hasOverride]);

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
    setHasOverride(true);
  }, []);

  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
