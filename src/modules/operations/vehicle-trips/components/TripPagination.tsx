import React from "react";

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function TripPagination({ currentPage, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  // Show a window of up to 5 pages around the current page
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

  const visiblePages = getPageNumbers();
  const showFirstEllipsis = visiblePages[0] > 1;
  const showLastEllipsis = visiblePages[visiblePages.length - 1] < totalPages;

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {/* Page info */}
      <div className="text-sm text-slate-600">
        Page {currentPage} of {totalPages}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        {/* First page + ellipsis */}
        {showFirstEllipsis && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              1
            </button>
            <span className="px-1 text-slate-400">…</span>
          </>
        )}

        {/* Visible pages */}
        {visiblePages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition ${
              page === currentPage
                ? "bg-green-700 text-white"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {page}
          </button>
        ))}

        {/* Last ellipsis + last page */}
        {showLastEllipsis && (
          <>
            <span className="px-1 text-slate-400">…</span>
            <button
              onClick={() => onPageChange(totalPages)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default React.memo(TripPagination);