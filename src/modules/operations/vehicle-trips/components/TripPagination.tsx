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
    const pages = [];
    const maxVisible = 3; // number of page buttons to show
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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <div className="flex justify-between items-center">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-5 py-2 rounded-xl border disabled:opacity-40 hover:bg-slate-100"
        >
          Previous
        </button>

        <div className="flex items-center gap-2">
          {/* First page + ellipsis */}
          {showFirstEllipsis && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="h-10 w-10 rounded-xl border hover:bg-slate-100 font-semibold transition"
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
              className={`h-10 w-10 rounded-xl font-semibold transition ${
                page === currentPage
                  ? "bg-green-700 text-white"
                  : "border hover:bg-slate-100"
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
                className="h-10 w-10 rounded-xl border hover:bg-slate-100 font-semibold transition"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-5 py-2 rounded-xl border disabled:opacity-40 hover:bg-slate-100"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default React.memo(TripPagination);