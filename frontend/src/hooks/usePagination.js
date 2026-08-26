import { useState } from "react";

export const DEFAULT_PAGE_SIZE = 8;

/**
 * Slices `items` into fixed-size pages, resetting to page 1 whenever the
 * item count changes (a filter/search/reload swapping the list out from
 * under an admin mid-browse should never leave them stranded on an empty
 * page) and clamping down if the current page is pushed past the new total
 * (e.g. approving the last row on the last page removes it).
 *
 * Resets happen synchronously during render — the React-recommended
 * "adjusting state when a prop changes" pattern — rather than in a
 * useEffect, so there's no extra commit/flash of a stale page before the
 * reset lands.
 */
export function usePagination(items, pageSize = DEFAULT_PAGE_SIZE) {
  const count = items?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const [page, setPage] = useState(1);
  const [prevCount, setPrevCount] = useState(count);

  let effectivePage = page;
  if (count !== prevCount) {
    setPrevCount(count);
    setPage(1);
    effectivePage = 1;
  } else if (page > totalPages) {
    setPage(totalPages);
    effectivePage = totalPages;
  }

  const start = (effectivePage - 1) * pageSize;
  const pageItems = items?.slice(start, start + pageSize) ?? [];

  return { page: effectivePage, setPage, totalPages, pageItems };
}
