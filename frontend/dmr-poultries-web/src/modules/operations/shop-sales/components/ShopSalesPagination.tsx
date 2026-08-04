import React from "react";

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function ShopSalesPagination({ currentPage, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  // Build a window of up to 10 pages around the current page
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 10;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const visiblePages = getPageNumbers();
  const showFirstEllipsis = visiblePages[0] > 1;
  const showLastEllipsis = visiblePages[visiblePages.length - 1] < totalPages;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Page <span className="font-bold text-slate-700">{currentPage}</span> of{" "}
          <span className="font-bold text-slate-700">{totalPages}</span>
        </div>
        <div className="flex gap-1">
          {/* Previous */}
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="px-3 py-1 rounded-lg border disabled:opacity-40 hover:bg-slate-100 text-xs"
          >
            Previous
          </button>

          {/* First page and ellipsis */}
          {showFirstEllipsis && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="h-8 w-8 rounded-lg border text-xs hover:bg-slate-100"
              >
                1
              </button>
              <span className="px-2 text-slate-400">…</span>
            </>
          )}

          {/* Visible pages */}
          {visiblePages.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`h-8 w-8 rounded-lg border text-xs transition ${
                page === currentPage
                  ? "bg-blue-600 text-white border-blue-600"
                  : "hover:bg-slate-100"
              }`}
            >
              {page}
            </button>
          ))}

          {/* Last ellipsis and last page */}
          {showLastEllipsis && (
            <>
              <span className="px-2 text-slate-400">…</span>
              <button
                onClick={() => onPageChange(totalPages)}
                className="h-8 w-8 rounded-lg border text-xs hover:bg-slate-100"
              >
                {totalPages}
              </button>
            </>
          )}

          {/* Next */}
          <button
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="px-3 py-1 rounded-lg border disabled:opacity-40 hover:bg-slate-100 text-xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ShopSalesPagination);