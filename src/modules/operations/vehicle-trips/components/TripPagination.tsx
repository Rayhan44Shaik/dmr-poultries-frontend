import React from "react";
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
  paginationSummaryClass,
  pageRecordRange,
} from "../../../../shared/ui/paginationStyles";
import { PageSizeSelect } from "../../../../shared/ui/PageSizeSelect";
import { useI18n } from "../../../../i18n";

interface Props {
  currentPage: number;
  totalPages: number;
  /** Number of records after the active filters. */
  totalItems?: number;
  onPageChange: (page: number) => void;
  hidePageInfo?: boolean; // when true, only render navigation buttons
  /** Current rows-per-page. Pass with onPageSizeChange to show the control. */
  pageSize?: number;
  /** Omit to hide the rows-per-page control. */
  onPageSizeChange?: (pageSize: number) => void;
  /**
   * Compact strip: the first page, the current page and its neighbours, then
   * the last page — `1 2 … 20` instead of `1 2 3 4 5 … 20`. Used where the
   * strip shares a toolbar with search and actions (Recent Collections).
   */
  compact?: boolean;
}

function TripPagination({ currentPage, totalPages, totalItems, onPageChange, hidePageInfo = false, pageSize, onPageSizeChange, compact = false }: Props) {
  const { t } = useI18n();
  const { from, to } = pageRecordRange(currentPage, pageSize ?? 1, totalItems ?? 0);
  const hasMultiplePages = totalPages > 1;

  const getPageNumbers = () => {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  /**
   * Compact strip: page 1, the current page with one neighbour on each side,
   * and the last page — deduplicated and ordered, with a gap rendered as an
   * ellipsis. On page 1 of 20 that reads exactly `1 2 … 20`.
   */
  const compactPages = (() => {
    if (!compact || !hasMultiplePages) return null;
    const pages = new Set<number>([1, totalPages, currentPage]);
    if (currentPage > 1) pages.add(currentPage - 1);
    if (currentPage < totalPages) pages.add(currentPage + 1);
    return [...pages].sort((left, right) => left - right);
  })();

  const visiblePages = hasMultiplePages && !compactPages ? getPageNumbers() : [1];
  const showFirstEllipsis = hasMultiplePages && !compactPages && visiblePages[0] > 1;
  const showLastEllipsis =
    hasMultiplePages && !compactPages && visiblePages[visiblePages.length - 1] < totalPages;
  const atFirst = currentPage === 1;
  const atLast = currentPage === totalPages || !hasMultiplePages;

  const renderNavButtons = () => (
    <>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={atFirst}
        className={paginationNavBtnClass}
      >
        {t("common.previous")}
      </button>

      {compactPages ? (
        <>
          {compactPages.map((page, index) => {
            const previous = compactPages[index - 1];
            return (
              <React.Fragment key={page}>
                {previous != null && page - previous > 1 && (
                  <span className="px-1 text-slate-400">…</span>
                )}
                <button
                  type="button"
                  onClick={() => onPageChange(page)}
                  className={paginationPageBtnClass(page === currentPage)}
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </button>
              </React.Fragment>
            );
          })}
        </>
      ) : hasMultiplePages ? (
        <>
          {showFirstEllipsis && (
            <>
              <button
                type="button"
                onClick={() => onPageChange(1)}
                className={paginationPageBtnClass(currentPage === 1)}
              >
                1
              </button>
              <span className="px-1 text-slate-400">…</span>
            </>
          )}

          {visiblePages.map((page) => (
            <button
              type="button"
              key={page}
              onClick={() => onPageChange(page)}
              className={paginationPageBtnClass(page === currentPage)}
            >
              {page}
            </button>
          ))}

          {showLastEllipsis && (
            <>
              <span className="px-1 text-slate-400">…</span>
              <button
                type="button"
                onClick={() => onPageChange(totalPages)}
                className={paginationPageBtnClass(currentPage === totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}
        </>
      ) : (
        <span className={paginationPageBtnClass(true)}>1</span>
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={atLast}
        className={paginationNavBtnClass}
      >
        {t("common.next")}
      </button>
    </>
  );

  if (hidePageInfo) {
    return (
      <div className="flex items-center justify-end flex-wrap gap-1.5">
        {onPageSizeChange && pageSize != null && (
          <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-600">{t("common.rows_per_page")}</span>
          <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
        </div>
        )}
        {renderNavButtons()}
      </div>
    );
  }

  return (
    <div className={paginationBarClass}>
      {totalItems != null && (
        <p className={paginationSummaryClass} aria-live="polite">
          {totalItems === 0
            ? t("common.no_records")
            : `${t("common.showing")} ${from}–${to} ${t("common.of")} ${totalItems}`}
        </p>
      )}
      {onPageSizeChange && pageSize != null && (
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-600">{t("common.rows_per_page")}</span>
          <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
        </div>
      )}
      {renderNavButtons()}
    </div>
  );
}

export default React.memo(TripPagination);
