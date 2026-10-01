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
