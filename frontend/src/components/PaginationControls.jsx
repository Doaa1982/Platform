import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../i18n/useLanguage";

/** Prev/Next + "Page X of Y", shared by every paginated grid/table in the
 * Admin screens. Renders nothing when there's only one page — a control
 * with nowhere to go is just clutter. */
export default function PaginationControls({ page, totalPages, onChange }) {
  const { t } = useLanguage();
  if (totalPages <= 1) return null;

  return (
    <div className="pl-pagination">
      <button type="button" className="pl-admin__ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={14} aria-hidden="true" /> {t("admin.paginationPrev")}
      </button>
      <span className="pl-pagination__status">{t("admin.paginationPageOf", { page, total: totalPages })}</span>
      <button type="button" className="pl-admin__ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        {t("admin.paginationNext")} <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export const PAGINATION_CONTROLS_CSS = `
  .pl-pagination { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 14px; }
  .pl-pagination button { display: inline-flex; align-items: center; gap: 4px; }
  .pl-pagination__status { font-size: 0.82rem; color: var(--ink-soft); font-family: var(--font-mono); }
`;
