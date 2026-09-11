import React from "react";
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
} from "../../../../shared/ui/paginationStyles";
import {
  MAX_CUSTOM_PAGE_SIZE,
  PAGINATION_PAGE_SIZE_OPTIONS,
} from "../../../../shared/ui/uiTokens";
import MasterDropdown from "../../../masters/components/MasterDropdown";
import { useI18n } from "../../../../i18n";

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hidePageInfo?: boolean; // when true, only render navigation buttons
  /** Current rows-per-page. Pass with onPageSizeChange to show the control. */
  pageSize?: number;
  /** Omit to hide the rows-per-page control. */
  onPageSizeChange?: (pageSize: number) => void;
}

function TripPagination({ currentPage, totalPages, onPageChange, hidePageInfo = false, pageSize, onPageSizeChange }: Props) {
  const { t } = useI18n();
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

  const visiblePages = hasMultiplePages ? getPageNumbers() : [1];
  const showFirstEllipsis = hasMultiplePages && visiblePages[0] > 1;
  const showLastEllipsis = hasMultiplePages && visiblePages[visiblePages.length - 1] < totalPages;
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

      {hasMultiplePages ? (
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
        {renderNavButtons()}
      </div>
    );
  }

  return (
    <div className={paginationBarClass}>
      {onPageSizeChange && pageSize != null && (
        <div className="mr-auto flex items-center gap-1.5">
          <span className="hidden text-xs font-semibold text-slate-600 sm:inline">
            {t("common.rows")}
          </span>
          <MasterDropdown
            label={t("common.rows_per_page")}
            hideLabel
            value={String(pageSize)}
            options={PAGINATION_PAGE_SIZE_OPTIONS.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            // Same interaction as every other rows-per-page control: type to
            // filter, or commit an arbitrary count.
            searchable
            allowCustomValue
            validateCustom={(raw) => {
              if (!/^\d+$/.test(raw)) return null;
              const n = Number(raw);
              return n >= 1 && n <= MAX_CUSTOM_PAGE_SIZE ? String(n) : null;
            }}
            onChange={(value) => {
              const next = Number(value);
              if (Number.isFinite(next) && next !== pageSize) onPageSizeChange(next);
            }}
            className="w-[86px] [&>button]:h-8 [&>button]:rounded-lg [&>button]:px-2 [&>button]:text-xs"
          />
        </div>
      )}
      {renderNavButtons()}
    </div>
  );
}

export default React.memo(TripPagination);
