import { useEffect, useMemo, useState } from 'react';
import {
  clampPage,
  computeTotalPages,
} from '../../../shared/ui/paginationStyles';

/**
 * Client-side pagination over an already-loaded array (fleet operations).
 *
 * Page maths now comes from the ONE shared implementation in
 * `shared/ui/paginationStyles` (`computeTotalPages` / `clampPage`), the same
 * helpers the global `<Pagination>` component and the accounts hook use, so no
 * module can drift into its own off-by-one or "stranded page" behaviour.
 *
 * STRANDED-PAGE FIX
 *   When `items` shrinks — a filter narrows the list, or the last row on the
 *   final page is deleted — the stored `currentPage` could remain above the new
 *   `totalPages`, leaving an empty table with a stale page number. The view is
 *   clamped on every render and the stored page reconciled in an effect.
 *
 * NOTE ON THE DEFAULT PAGE SIZE
 *   This hook defaulted to 15 rows while every other pager in the application
 *   defaults to the shared 20 (`PAGINATION_DEFAULT_PAGE_SIZE`). The local 15 is
 *   deliberately preserved here: it is the fleet module's existing visible
 *   behaviour, and changing it would alter how many rows a user sees per page
 *   without being asked. Callers can pass any size.
 *
 * Public API is unchanged (`currentItems`, `currentPage`, `totalPages`,
 * `goToPage`, `setCurrentPage`).
 */
export function usePagination<T>(items: T[], itemsPerPage: number = 15) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = computeTotalPages(items.length, itemsPerPage);

  // Clamped view of the page: safe even if `items` shrank underneath us.
  const safePage = clampPage(currentPage, totalPages);

  // Reconcile state only when it actually differs, so this cannot loop.
  useEffect(() => {
    if (safePage !== currentPage) setCurrentPage(safePage);
  }, [safePage, currentPage]);

  const currentItems = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, safePage, itemsPerPage]);

  const goToPage = (page: number) => {
    setCurrentPage(clampPage(page, totalPages));
  };

  return {
    currentItems,
    currentPage: safePage,
    totalPages,
    goToPage,
    setCurrentPage,
  };
}
