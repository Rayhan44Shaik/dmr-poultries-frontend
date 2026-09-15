import React from "react";
import { PageSizeSelect } from "../../../../shared/ui/PageSizeSelect";
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
} from "../../../../shared/ui/paginationStyles";
import { useI18n } from "../../../../i18n";

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
}

/** Same compact, bounded page navigator used by Trip List. */
function ShopSalesPagination({ currentPage, totalPages, onPageChange, pageSize, onPageSizeChange }: Props) {
  const { t } = useI18n();
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const hasMultiplePages = safeTotalPages > 1;

  const visiblePages = (() => {
    const maxVisible = 5;
    let start = Math.max(1, safeCurrentPage - Math.floor(maxVisible / 2));
    let end = Math.min(safeTotalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  })();
  const showFirstEllipsis = hasMultiplePages && visiblePages[0] > 1;
  const showLastEllipsis = hasMultiplePages && visiblePages[visiblePages.length - 1] < safeTotalPages;

  return (
    <div className={paginationBarClass}>
      {onPageSizeChange && pageSize != null && (
        <div className="mr-auto flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-600">Rows Per Page</span>
          <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
        </div>
      )}
      <button type="button" onClick={() => onPageChange(safeCurrentPage - 1)} disabled={safeCurrentPage === 1} className={paginationNavBtnClass}>
        {t("common.previous")}
      </button>

      {showFirstEllipsis && (
        <>
          <button type="button" onClick={() => onPageChange(1)} className={paginationPageBtnClass(false)}>1</button>
          <span className="px-1 text-slate-400">…</span>
        </>
      )}

      {visiblePages.map((page) => (
        <button type="button" key={page} onClick={() => onPageChange(page)} className={paginationPageBtnClass(page === safeCurrentPage)}>
          {page}
        </button>
      ))}

      {showLastEllipsis && (
        <>
          <span className="px-1 text-slate-400">…</span>
          <button type="button" onClick={() => onPageChange(safeTotalPages)} className={paginationPageBtnClass(false)}>{safeTotalPages}</button>
        </>
      )}

      <button type="button" onClick={() => onPageChange(safeCurrentPage + 1)} disabled={safeCurrentPage === safeTotalPages} className={paginationNavBtnClass}>
        {t("common.next")}
      </button>
    </div>
  );
}

export default React.memo(ShopSalesPagination);
