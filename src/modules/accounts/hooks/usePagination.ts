import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clampPage,
  computeTotalPages,
  PAGINATION_DEFAULT_PAGE_SIZE,
} from '../../../shared/ui/paginationStyles';

/**
 * Client-side pagination over an already-loaded array.
 *
 * Page maths now comes from the ONE shared implementation in
 * `shared/ui/paginationStyles` (`computeTotalPages` / `clampPage`), the same
 * helpers the global `<Pagination>` component uses. This hook previously
 * re-derived `Math.ceil(len / size)` itself, so a module could drift into
 * off-by-one behaviour that no other module had.
 *
 * STRANDED-PAGE FIX
 *   When `items` shrinks — a filter narrows the list, or the last row on the
 *   final page is deleted — `currentPage` could stay above the new
 *   `totalPages`. The old `goTo` clamped on the way *in* but nothing corrected
 *   the stored page, so the user was left looking at an empty table with a
 *   stale page number and had to click backwards manually. The view is now
 *   clamped on every render and the stored page is reconciled in an effect, so
 *   the list always shows real data.
 *
 * Public API is unchanged (`paginated`, `currentPage`, `totalPages`, `goTo`,
 * `next`, `prev`) — this is a pure internal correction, and because the work is
 * client-side there is no request to duplicate.
 */
export function usePagination<T>(
  items: T[],
  pageSize: number = PAGINATION_DEFAULT_PAGE_SIZE,
) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = computeTotalPages(items.length, pageSize);

  // Clamped view of the page: safe even if `items` shrank underneath us.
  const safePage = clampPage(currentPage, totalPages);

  // Reconcile state only when it actually differs, so this cannot loop and
  // never re-renders on an unrelated change.
  useEffect(() => {
    if (safePage !== currentPage) setCurrentPage(safePage);
  }, [safePage, currentPage]);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const goTo = useCallback(
    (page: number) => {
      const next = clampPage(page, totalPages);
      // No-op when already on that page: nothing to re-render or re-slice.
      setCurrentPage((current) => (current === next ? current : next));
    },
    [totalPages],
  );

  const next = useCallback(() => goTo(safePage + 1), [safePage, goTo]);
  const prev = useCallback(() => goTo(safePage - 1), [safePage, goTo]);

  return { paginated, currentPage: safePage, totalPages, goTo, next, prev };
}
