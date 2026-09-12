import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../../../i18n';
import { PageSizeSelect } from '../../../../shared/ui/PageSizeSelect';
import {
  clampPage,
  pageRecordRange,
  pageWindow,
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
  paginationSummaryClass,
  shouldShowPagination,
} from '../../../../shared/ui/paginationStyles';
import { uiPaginationEllipsisClass } from '../../../../shared/ui/uiTokens';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Pass with onPageSizeChange to show the global rows-per-page control. */
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
}

/**
 * Staff-module pagination footer.
 *
 * Migrated onto the ONE shared pagination system (`shared/ui/paginationStyles`
 * → `shared/ui/uiTokens`), which is the same source the global `<Pagination>`,
 * the masters pager and the EMI pager now use. Public props are unchanged, so no
 * consuming page needed edits.
 *
 * What this fixes
 *   • ACCESSIBILITY — the page-number buttons had no `aria-current="page"` and no
 *     `aria-label`, so a screen reader announced a row of bare numbers with no
 *     indication of which page was active. None of the buttons declared
 *     `type="button"`.
 *   • STABILITY — page maths was re-implemented locally (`Math.max/Math.min`
 *     window building, hand-computed record range). It now calls the shared
 *     `clampPage` / `pageWindow` / `pageRecordRange`, so this pager cannot drift
 *     into an off-by-one or "stranded page" state that the rest of the app does
 *     not have. `currentPage` is clamped against `totalPages` before rendering,
 *     so a shrinking result set can never show an empty page.
 *   • NO DUPLICATE REQUESTS — clicking the current page is now a no-op.
 *   • i18n — the summary was hardcoded English ("Showing 1–20 of 100") in an app
 *     that is fully bilingual; it now uses the shared `common.*` keys, so Telugu
 *     users get a Telugu summary.
 *   • VISUAL — 36px `h-9 w-9` buttons with `text-sm` replaced by the shared
 *     32px compact pager tokens, matching every other pager in the ERP.
 *
 * The hide threshold now comes from the shared `shouldShowPagination` (fewer than
 * 10 records) instead of a local `totalPages <= 1`, so short result sets behave
 * the same everywhere.
 */
const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = '',
  pageSize,
  onPageSizeChange,
}) => {
  const { t } = useI18n();

  if (!shouldShowPagination(totalItems)) return null;

  const safeTotal = Math.max(1, totalPages);
  const safePage = clampPage(currentPage, safeTotal);
  const { from, to } = pageRecordRange(safePage, itemsPerPage, totalItems);

  const goTo = (page: number) => {
    const next = clampPage(page, safeTotal);
    if (next === safePage) return; // no-op: never re-request the same page
    onPageChange(next);
  };

  return (
    <div
      className={`${paginationBarClass} flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className={paginationSummaryClass} aria-live="polite">
        {t('common.showing')} <span className="font-semibold">{from}</span>–
        <span className="font-semibold">{to}</span> {t('common.of')}{' '}
        <span className="font-semibold">{totalItems}</span>
      </p>
      {onPageSizeChange && pageSize != null && (
        <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
      )}
      <nav
        aria-label={t('masters.ui.pagination')}
        className="flex items-center gap-1"
      >
        <button
          type="button"
          onClick={() => goTo(safePage - 1)}
          disabled={safePage === 1}
          className={paginationNavBtnClass}
          aria-label={t('common.previous_page')}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {pageWindow(safePage, safeTotal).map((page, idx) =>
          page === null ? (
            <span
              key={`ellipsis-${idx}`}
              className={uiPaginationEllipsisClass}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => goTo(page)}
              disabled={false}
              aria-current={page === safePage ? 'page' : undefined}
              aria-label={t('common.page') + ' ' + page}
              className={paginationPageBtnClass(page === safePage)}
            >
              {page}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => goTo(safePage + 1)}
          disabled={safePage === safeTotal}
          className={paginationNavBtnClass}
          aria-label={t('common.next_page')}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
};

export default React.memo(Pagination);
