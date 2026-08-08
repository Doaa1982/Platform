import { createContext } from "react";

export const RTL_LANGS = ["ar"];
export const STORAGE_KEY = "platform.lang";

export const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
];

export const LanguageContext = createContext(null);
