import { useState, useEffect, useCallback, useMemo } from "react";
import { translations } from "./translations";
import { LanguageContext, RTL_LANGS, STORAGE_KEY } from "./languageStore";

function initialLang() {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored === "en" || stored === "ar") return stored;
  const browser = (navigator.language || "en").split("-")[0].toLowerCase();
  return browser === "ar" ? "ar" : "en";
}

/**
 * Owns the portal's one piece of global i18n state: which language is active.
 * Direction is derived, not stored — Arabic is RTL, everything else here is
 * LTR, so `dir` always follows `lang` rather than drifting independently.
 */
export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const toggleLang = useCallback(() => setLang((l) => (l === "ar" ? "en" : "ar")), []);

  const t = useCallback((key, vars) => {
    const parts = key.split(".");
    let node = parts.reduce((acc, p) => acc?.[p], translations[lang]);
    if (node == null) node = parts.reduce((acc, p) => acc?.[p], translations.en);
    if (typeof node !== "string") return key;
    if (!vars) return node;
    return Object.keys(vars).reduce((s, k) => s.replaceAll(`{${k}}`, vars[k]), node);
  }, [lang]);

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t, dir: RTL_LANGS.includes(lang) ? "rtl" : "ltr" }),
    [lang, toggleLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
