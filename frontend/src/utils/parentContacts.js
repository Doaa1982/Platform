/* Parent contacts (Parent Progress Reports Business Analysis) — the plain helpers and styles
   shared by components/ParentContacts.jsx and components/ParentImport.jsx. Kept out of those
   component files so Fast Refresh can treat them as components-only. */

export const EMPTY_PARENT = { name: "", email: "", language: "ar", whatsAppPhone: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field-level problems, as translation keys (empty object = fine to send). */
export function parentProblems(p) {
  const problems = {};
  if (!p.name.trim()) problems.name = "parents.errName";
  if (!EMAIL_RE.test(p.email.trim())) problems.email = "parents.errEmail";
  const digits = (p.whatsAppPhone || "").replace(/\D/g, "");
  if (p.whatsAppPhone?.trim() && (digits.length < 7 || digits.length > 15)) problems.whatsAppPhone = "parents.errPhone";
  return problems;
}

/** What the API expects: trimmed, an empty WhatsApp number as null. */
export function toParentRequest(p) {
  return { name: p.name.trim(), email: p.email.trim(), language: p.language || "ar", whatsAppPhone: p.whatsAppPhone?.trim() || null };
}

export const IMPORT_COLUMNS = [
  "student_email", "parent1_name", "parent1_email", "parent1_whatsapp", "parent1_language",
  "parent2_name", "parent2_email", "parent2_whatsapp", "parent2_language",
];
const TEMPLATE_EXAMPLE = [
  "student@example.com", "Hala Ahmed", "hala@example.com", "+201001234567", "ar",
  "Omar Ahmed", "omar@example.com", "", "en",
];

/** A CSV with the headers and one example row. The BOM makes Excel open Arabic names correctly. */
export function downloadParentTemplate() {
  const text = "﻿" + IMPORT_COLUMNS.join(",") + "\r\n" + TEMPLATE_EXAMPLE.join(",") + "\r\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "students-and-parents-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Row numbers of every row without a problem — the default selection after a preview. */
export const okRowNumbers = (preview) =>
  new Set((preview?.rows ?? []).filter((r) => r.problems.length === 0).map((r) => r.rowNumber));

export const PARENT_IMPORT_CSS = `
  .lw-pimport__guide { font-size: 0.84rem; color: var(--ink-soft); margin: 4px 0 10px; text-align: start; }
  .lw-pimport__guide summary { cursor: pointer; color: var(--ink); font-weight: 600; }
  .lw-pimport__guide dl { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); gap: 4px 12px; margin: 8px 0; }
  .lw-pimport__guide dt { margin: 0; }
  .lw-pimport__guide dd { margin: 0; }
  .lw-pimport__guide code { font-size: 0.78rem; overflow-wrap: anywhere; }
  .lw-pimport__template { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; padding: 0; font: inherit;
    color: var(--ink); text-decoration: underline; cursor: pointer; }
  .lw-pimport__error { color: var(--danger); font-size: 0.85rem; margin: 8px 0 0; }
  .lw-pimport__spin { animation: lwPImportSpin 0.9s linear infinite; }
  @keyframes lwPImportSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-pimport__spin { animation: none; } }
  .lw-pimport__preview { margin-top: 12px; text-align: start; }
  .lw-pimport__summary { margin: 0 0 8px; font-size: 0.86rem; }
  .lw-pimport__summary .is-warn { color: var(--danger); }
  .lw-pimport__scroll { width: 100%; overflow-x: auto; max-height: 360px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-sm); }
  .lw-pimport__table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 0.82rem; }
  .lw-pimport__table th { text-align: start; font-family: var(--font-mono); font-size: 10.5px; text-transform: uppercase; color: var(--ink-soft);
    background: var(--surface-2); padding: 8px 10px; position: sticky; top: 0; }
  .lw-pimport__table td { padding: 8px 10px; border-top: 1px solid var(--line); vertical-align: top; overflow-wrap: anywhere; }
  .lw-pimport__table tr.is-problem td { background: color-mix(in srgb, var(--danger) 6%, transparent); }
  .lw-pimport__sub { color: var(--ink-soft); font-size: 0.78rem; }
  .lw-pimport__ok { display: inline-flex; align-items: center; gap: 4px; color: color-mix(in srgb, var(--accent-2) 55%, var(--ink)); font-weight: 600; }
  .lw-pimport__problems { list-style: none; margin: 0; padding: 0; color: color-mix(in srgb, var(--danger) 70%, var(--ink)); }
  .lw-pimport__problems li { display: flex; align-items: flex-start; gap: 4px; }
  .lw-pimport__problems svg { flex-shrink: 0; margin-top: 2px; }
  .lw-pimport__hint { font-size: 0.8rem; color: var(--ink-soft); margin: 8px 0 0; }
  .lw-pimport__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

export const PARENT_CSS = `
  .lw-parent { display: flex; flex-direction: column; gap: 10px; text-align: start; }
  .lw-parent__empty, .lw-parent__hint { margin: 0; font-size: 0.84rem; color: var(--ink-soft); line-height: 1.5; }
  .lw-parent__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .lw-parent__item { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 14px;
    border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px; background: var(--surface); }
  .lw-parent__who { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; min-width: 0; }
  .lw-parent__name { font-weight: 600; }
  .lw-parent__meta { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; font-size: 0.8rem; color: var(--ink-soft); }
  .lw-parent__meta [dir="ltr"] { overflow-wrap: anywhere; min-width: 0; }
  .lw-parent__note { flex-basis: 100%; font-size: 0.78rem; color: var(--ink-soft); }
  .lw-parent__pill { font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; border-radius: 20px; padding: 3px 9px;
    background: var(--surface-2); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); }
  .lw-parent__pill.is-confirmed { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: color-mix(in srgb, var(--accent-2) 55%, var(--ink)); box-shadow: none; }
  .lw-parent__pill.is-unsubscribed, .lw-parent__pill.is-expired { color: color-mix(in srgb, var(--ink-soft) 45%, var(--ink)); }
  .lw-parent__rowactions, .lw-parent__confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.82rem; }
  .lw-parent__form { flex-basis: 100%; display: flex; flex-direction: column; gap: 10px; }
  .lw-parent__fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; text-align: start; }
  .lw-parent__field { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; min-width: 0; }
  .lw-parent__fields input, .lw-parent__fields select { width: 100%; box-sizing: border-box; }
  .lw-parent__optional { font-style: normal; color: var(--ink-soft); font-size: 0.76rem; }
  .lw-parent__err { color: var(--danger); font-size: 0.76rem; }
  .lw-parent__actions { display: flex; gap: 8px; }
  .lw-parent__addbtn { align-self: flex-start; }
  @media (max-width: 560px) { .lw-parent__fields { grid-template-columns: minmax(0, 1fr); } }
`;
