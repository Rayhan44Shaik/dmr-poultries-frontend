/**
 * =============================================================================
 * GLOBAL PAGINATION
 * =============================================================================
 * One pagination component for the whole app: identical appearance, disabled
 * states, page-window behaviour and keyboard contract in every module.
 *
 * ---------------------------------------------------------------------------
 * SAFE PAGE CLAMPING — the "stranded page" fix
 * ---------------------------------------------------------------------------
 * If the current page exceeds the new total (a filter narrowed the result set,
 * or the last row on the final page was deleted), the requested page is clamped
 * into range and the parent is told, so the view always shows real data instead
 * of an empty table with a stale page number.
 *
 * The correction is emitted from an effect, not during render, and only when the
 * clamped value actually differs — so it cannot loop and cannot fire a
 * redundant fetch.
 *
 * ---------------------------------------------------------------------------
 * NO DUPLICATE REQUESTS
 * ---------------------------------------------------------------------------
 *   • Clicking the CURRENT page is a no-op — it does not call `onPageChange`.
 *   • Prev/Next are hard-disabled at the boundaries, so they cannot emit an
 *     out-of-range page for the parent to fetch.
 *   • The page-size select only fires on a genuine change.
 *   • `disabled` (typically the table's loading flag) blocks every control
 *     while a request is in flight.
 *
 * ---------------------------------------------------------------------------
 * KEYBOARD
 * ---------------------------------------------------------------------------
 *   Tab reaches Prev, each visible page number, Next and the page-size select in
 *   visual order; Enter/Space activate through the same handler a click uses.
 *   Home/End on the pager jump to the first/last page. No roving tabindex and no
 *   positive `tabIndex` anywhere, so the order stays predictable.
 *
 * The window of page numbers is bounded (`pageWindow`), so a 500-page directory
 * renders 7 buttons, not 500.
 * =============================================================================
 */

import { useContext, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { I18nContext } from "../i18n/context";
import { cn } from "../utils/cn";
import { PageSizeSelect } from "../shared/ui/PageSizeSelect";
import {
  clampPage,
  compactPageWindow,
  computeTotalPages,
  pageRecordRange,
  pageWindow,
} from "../shared/ui/paginationStyles";
import {
  uiPaginationBarClass,
  uiPaginationEllipsisClass,
  uiPaginationNavButtonClass,
  uiPaginationPageButtonClass,
  uiPaginationSummaryClass,
} from "../shared/ui/uiTokens";

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** Omit to hide the page-size control. */
  onPageSizeChange?: (pageSize: number) => void;
  /** Blocks every control — pass the table's loading flag. */
  disabled?: boolean;
  /** "Showing 1–20 of 148". Default true. */
  showSummary?: boolean;
  siblingCount?: number;
  /**
   * Compact numbering — `1 2 … 20` (first two pages, the current neighbourhood,
   * the last page). Used by the collection tables; the default renders a full
   * window instead.
   */
  compact?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  showSummary = true,
  siblingCount = 1,
  compact = false,
  ariaLabel,
  className,
}: PaginationProps) {
  const i18n = useContext(I18nContext);
  const t = (key: string, fallback: string, params?: Record<string, string | number>) => {
    if (!i18n) return fallback;
    const translated = i18n.t(key, params);
    return translated === key ? fallback : translated;
  };

  const totalPages = computeTotalPages(totalItems, pageSize);
  const safePage = clampPage(page, totalPages);

  /**
   * `onPageChange` is read through a ref: callers usually pass an inline arrow,
   * and depending on it directly would re-run the clamping effect on every
   * parent render and risk emitting a redundant page change.
   */
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  // Correct a stranded page. Fires only when the values genuinely differ.
  useEffect(() => {
    if (safePage !== page) onPageChangeRef.current(safePage);
  }, [safePage, page]);

  const { from, to } = pageRecordRange(safePage, pageSize, totalItems);
  const items = compact
    ? compactPageWindow(safePage, totalPages)
    : pageWindow(safePage, totalPages, siblingCount);

  const go = (next: number) => {
    if (disabled) return;
    const clamped = clampPage(next, totalPages);
    // Never re-request the page we are already on.
    if (clamped === safePage) return;
    onPageChange(clamped);
  };

  const handleNavKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Home") {
      event.preventDefault();
      go(1);
    } else if (event.key === "End") {
      event.preventDefault();
      go(totalPages);
    }
  };

  return (
    <div className={cn(uiPaginationBarClass, className)}>
      {showSummary ? (
        <p data-master-summary className={uiPaginationSummaryClass} aria-live="polite">
          {totalItems === 0
            ? t("common.no_records", "No records")
            : `${t("common.showing", "Showing")} ${from}\u2013${to} ${t("common.of", "of")} ${totalItems}`}
        </p>
      ) : null}

      {onPageSizeChange ? (
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-600">{t("common.rows_per_page", "Rows per page")}</span>
          <PageSizeSelect
            value={pageSize}
            onChange={onPageSizeChange}
            disabled={disabled}
          />
        </div>
      ) : null}

      <nav
        aria-label={ariaLabel ?? t("masters.ui.pagination", "Pagination")}
        onKeyDown={handleNavKeyDown}
        className="flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={() => go(safePage - 1)}
          disabled={disabled || safePage <= 1}
          className={uiPaginationNavButtonClass}
          aria-label={t("common.previous_page", "Previous page")}
        >
          <ChevronLeft aria-hidden="true" />
          <span>{t("common.previous", "Previous")}</span>
        </button>

        {items.map((item, index) =>
          item === null ? (
            <span key={`gap-${index}`} className={uiPaginationEllipsisClass} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => go(item)}
              disabled={disabled}
              aria-current={item === safePage ? "page" : undefined}
              aria-label={t("masters.ui.page", `Page ${item}`, { page: item })}
              className={uiPaginationPageButtonClass(item === safePage)}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => go(safePage + 1)}
          disabled={disabled || safePage >= totalPages}
          className={uiPaginationNavButtonClass}
          aria-label={t("common.next_page", "Next page")}
        >
          <span>{t("common.next", "Next")}</span>
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}

export default Pagination;
