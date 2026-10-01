import { LANGUAGES } from "./languageStore";

/**
 * Dates in the reader's language. Arabic keeps Latin digits (ar-u-nu-latn) to
 * match the digits used everywhere else in the app and in its emails.
 */
const LOCALES = { en: "en-GB", ar: "ar-u-nu-latn" };

export function formatDate(lang, value, options = { dateStyle: "medium" }) {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALES[lang] ?? LOCALES.en, options).format(date);
}

/**
 * Wraps a value interpolated into a translated sentence (an email, a name, a
 * workspace) in Unicode first-strong isolates, so a Latin email inside Arabic
 * text — or an Arabic name inside English — never reorders the surrounding
 * punctuation. The plain-text equivalent of <bdi>.
 */
export const isolate = (value) => `⁨${value}⁩`;

/** A workspace role ("AssistantTeacher") in the reader's language. */
export function roleLabel(t, role) {
  const key = `roles.${role}`;
  const label = t(key);
  return label !== key ? label : String(role ?? "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** "ar" → "العربية", "en" → "English" (each language in its own name); any other value as typed. */
export function languageName(code) {
  const known = LANGUAGES.find((l) => l.code === String(code ?? "").trim().toLowerCase());
  return known ? known.nativeLabel : code;
}

/** The active UI language, as LanguageProvider sets it on <html lang>. Read at render time by
 *  the number/money/size helpers below; every caller already re-renders on a language change
 *  because it reads t() from the same context. */
const currentLang = () => (typeof document !== "undefined" && document.documentElement.lang) || "en";
const locale = () => LOCALES[currentLang()] ?? LOCALES.en;

/** 1234 → "1,234" in the active language (Latin digits in Arabic, matching the rest of the app). */
export const num = (n) => (n == null || n === "" ? "" : new Intl.NumberFormat(locale()).format(Number(n)));

/** 15, "USD" → "$15" in English, "15 $" in Arabic. Intl's Arabic data has no narrow symbol for
 *  USD (it prints "US$"), so the symbol always comes from the English data. */
export function money(amount, currency = "USD") {
  const value = Number(amount);
  const digits = { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 };
  const symbol = new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
    .formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  const number = new Intl.NumberFormat(locale(), digits).format(value);
  return currentLang() === "ar" ? `${number}\u00A0${symbol}` : new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol", ...digits }).format(value);
}

/** 10 → "10 GB" / "10 غيغابايت". */
export const gb = (n) => new Intl.NumberFormat(locale(), { style: "unit", unit: "gigabyte", unitDisplay: "short" }).format(Number(n));

/** A catalog plan or pack name in the active language, by its code; falls back to the server's name for anything new. */
export function catalogName(t, item) {
  if (!item) return "";
  const key = `catalog.${item.code}`;
  const label = t(key);
  return label !== key ? label : item.name;
}

/** formatDate in the active language — for helpers outside a component. */
export const formatDateActive = (value, options) => formatDate(currentLang(), value, options);

/** "15", "15–265", with " GB"/Arabic unit when `unit` is "GB" — numbers in the active language. */
export function quantity(value, unit = "") {
  if (unit === "GB") return gb(value);
  return unit ? `${num(value)} ${unit}` : num(value);
}

/** "{count} lessons" with the right plural form: t(`${base}_${category}`), categories from
 *  Intl.PluralRules (Arabic distinguishes zero/one/two/few/many/other; English one/other). Both
 *  languages define all six keys so the translation key sets stay identical. */
export function plural(t, base, count) {
  const category = new Intl.PluralRules(locale()).select(Number(count));
  return t(`${base}_${category}`, { count: num(count) });
}
