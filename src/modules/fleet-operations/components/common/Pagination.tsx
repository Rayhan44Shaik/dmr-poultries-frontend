import React from "react";
import { useI18n } from "../../../../i18n";
import { PageSizeSelect } from "../../../../shared/ui/PageSizeSelect";
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
  shouldShowPagination,
} from "../../../../shared/ui/paginationStyles";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
  /** Pass with onPageSizeChange to show the global rows-per-page control. */
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  pageSize,
  onPageSizeChange,
}) => {
  const { t } = useI18n();

  if (!shouldShowPagination(totalItems ?? 0)) return null;

  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);

    if (end - start < maxVisible - 1) {
      if (start === 1) end = Math.min(totalPages, start + maxVisible - 1);
      else if (end === totalPages) start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  void totalItems;
  void itemsPerPage;

  return (
    <div className={paginationBarClass}>
      {onPageSizeChange && pageSize != null && (
        <div className="mr-auto flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-600">{t("common.rows_per_page")}</span>
          <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
        </div>
      )}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={paginationNavBtnClass}
        aria-label={t("common.previous_page")}
      >
        {t("common.previous")}
      </button>

      {getPageNumbers().map((page) => (
        <button
          type="button"
          key={page}
          onClick={() => onPageChange(page)}
          className={paginationPageBtnClass(page === currentPage)}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={paginationNavBtnClass}
        aria-label={t("common.next_page")}
      >
        {t("common.next")}
      </button>
    </div>
  );
};

export default React.memo(Pagination);
