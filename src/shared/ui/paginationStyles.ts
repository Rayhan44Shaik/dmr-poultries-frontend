/**
 * Visual-only pagination classes. Do not use for page math or API behaviour.
 *
 * These now derive from the global design system (`./uiTokens`) so every module
 * renders an identical pagination bar. The names are kept as stable aliases for
 * the ~28 existing consumers; new code should use the `<Pagination />`
 * component in `src/ui/Pagination.tsx`, which additionally handles page
 * clamping, disabled states and keyboard activation.
 */

import {
  PAGINATION_DEFAULT_PAGE_SIZE,
  PAGINATION_MIN_RECORDS,
  PAGINATION_PAGE_SIZE_OPTIONS,
  uiPaginationBarClass,
  uiPaginationEllipsisClass,
  uiPaginationNavButtonClass,
  uiPaginationPageButtonClass,
  uiPaginationSizeSelectClass,
  uiPaginationSummaryClass,
} from "./uiTokens";

export {
  PAGINATION_DEFAULT_PAGE_SIZE,
  PAGINATION_MIN_RECORDS,
  PAGINATION_PAGE_SIZE_OPTIONS,
};

/** Hide the bar for short result sets where paging adds noise, not value. */
export const shouldShowPagination = (totalRecords: number) =>
  totalRecords >= PAGINATION_MIN_RECORDS;

export const paginationBarClass =
  `${uiPaginationBarClass} rounded-b-xl border-t border-slate-200 bg-white`;

export const paginationNavBtnClass = uiPaginationNavButtonClass;

export const paginationPageBtnClass = (active: boolean) =>
  uiPaginationPageButtonClass(active);

export const paginationEllipsisClass = uiPaginationEllipsisClass;

export const paginationSummaryClass = uiPaginationSummaryClass;

export const paginationSizeSelectClass = uiPaginationSizeSelectClass;

/* ---------------------------------------------------------------------------
 * PURE PAGE MATH
 * ---------------------------------------------------------------------------
 * Shared so no module can drift into off-by-one or "stranded page" behaviour
 * after filtering or deleting. No side effects, no state, no API calls.
 * ------------------------------------------------------------------------- */

/** Total pages for a record count, always ≥ 1. */
export function computeTotalPages(
  totalRecords: number,
  pageSize: number,
): number {
  if (!Number.isFinite(totalRecords) || totalRecords <= 0) return 1;
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalRecords / pageSize));
}

/**
 * Clamp a page number into `[1, totalPages]`.
 *
 * This is what prevents a "stranded page": when a filter shrinks the result
 * set or the last row on the final page is deleted, the requested page can
 * exceed the new total. Clamping here keeps the view on real data instead of
 * showing an empty table with a stale page number.
 */
export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1;
  const total = Math.max(1, Number.isFinite(totalPages) ? totalPages : 1);
  return Math.min(Math.max(1, Math.floor(page)), total);
}

/** Inclusive 1-based record range shown on the current page. */
export function pageRecordRange(
  page: number,
  pageSize: number,
  totalRecords: number,
): { from: number; to: number } {
  if (totalRecords <= 0) return { from: 0, to: 0 };
  const safePage = clampPage(page, computeTotalPages(totalRecords, pageSize));
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalRecords);
  return { from, to };
}

/**
 * Bounded list of page numbers / gaps for the pager.
 *
 * Deterministic for a given (page, totalPages): always shows the first page,
 * the last page and a window around the current page, with `null` marking a
 * gap. Bounded so a 500-page directory cannot render 500 buttons.
 */
export function pageWindow(
  page: number,
  totalPages: number,
  siblingCount = 1,
): (number | null)[] {
  const total = Math.max(1, totalPages);
  const current = clampPage(page, total);

  // Few enough pages to show them all.
  if (total <= 7 + siblingCount * 2) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const left = Math.max(2, current - siblingCount);
  const right = Math.min(total - 1, current + siblingCount);
  const items: (number | null)[] = [1];

  if (left > 2) items.push(null);
  for (let p = left; p <= right; p += 1) items.push(p);
  if (right < total - 1) items.push(null);

  items.push(total);
  return items;
}
