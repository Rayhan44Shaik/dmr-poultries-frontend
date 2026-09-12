import { memo, useMemo } from 'react';
import { useI18n } from '../../../../i18n';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageSizeSelect } from '../../../../shared/ui/PageSizeSelect';
import {
  uiPaginationNavButtonClass,
  uiPaginationPageButtonClass,
  uiPaginationSummaryClass,
} from '../../../../shared/ui/uiTokens';

/**
 * Shared pager tokens. This component already had the correct behaviour
 * (clamping, same-page no-op, `aria-current`, bounded mobile window); only its
 * hand-written class strings were bespoke — a `focus-visible:outline` ring
 * instead of the global focus ring, and its own 32px button metrics. It now
 * renders from the same tokens as every other pager in the ERP.
 */
const navButtonClass = `${uiPaginationNavButtonClass} w-8 sm:w-auto`;

interface Props {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  ready: boolean;
  onChange: (page: number) => void;
  /** Pass to show the global rows-per-page control. */
  onPageSizeChange?: (pageSize: number) => void;
}

function EmiPagination({ page, totalPages, totalItems, pageSize, ready, onChange, onPageSizeChange }: Props) {
  const { t } = useI18n();
  const pageCount = Math.max(1, totalPages);
  const currentPage = Math.max(1, Math.min(page, pageCount));
  const canNavigate = ready && totalItems > 0;
  const pages = useMemo(() => {
    const start = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
    return Array.from({ length: Math.min(5, pageCount) }, (_, index) => start + index);
  }, [currentPage, pageCount]);
  // Three neighboring pages on phones; five on larger screens. Both windows
  // contain the current page, without a resize listener or reserved empty slots.
  const mobileStart = Math.max(1, Math.min(currentPage - 1, pageCount - 2));
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);
  const choosePage = (next: number) => {
    if (!canNavigate || next === currentPage || next < 1 || next > pageCount) return;
    onChange(next);
  };

  return (
    <div className="grid min-h-[92px] min-w-0 grid-cols-1 items-center gap-2 rounded-b-xl border-t border-slate-200 px-4 py-3 md:flex md:min-h-[58px] md:justify-between">
      <p className={`${uiPaginationSummaryClass} mr-0`} aria-live="polite">
        {ready ? t('fleet.emi.showing_rows', { from, to, total: totalItems }) : '—'}
      </p>
      {onPageSizeChange && (
        <PageSizeSelect value={pageSize} onChange={onPageSizeChange} disabled={!ready} />
      )}
      <nav aria-label={t('fleet.emi.pagination_label')} className="flex items-center justify-end gap-1.5">
        <button type="button" aria-label={t('common.previous')} disabled={!canNavigate || currentPage === 1} onClick={() => choosePage(currentPage - 1)} className={navButtonClass}>
          <ChevronLeft size={14} aria-hidden="true" className="sm:hidden" />
          <span className="hidden sm:inline">{t('common.previous')}</span>
        </button>
        {pages.map((number) => {
          const selected = canNavigate && currentPage === number;
          const mobileVisible = number >= mobileStart && number < mobileStart + 3;
          return (
            <button
              key={number}
              type="button"
              disabled={!canNavigate}
              aria-label={t('fleet.emi.go_to_page', { page: number })}
              aria-current={selected ? 'page' : undefined}
              onClick={() => choosePage(number)}
              className={`${uiPaginationPageButtonClass(selected)} ${mobileVisible ? 'inline-flex' : 'hidden sm:inline-flex'}`}
            >
              {number}
            </button>
          );
        })}
        <button type="button" aria-label={t('common.next')} disabled={!canNavigate || currentPage === pageCount} onClick={() => choosePage(currentPage + 1)} className={navButtonClass}>
          <ChevronRight size={14} aria-hidden="true" className="sm:hidden" />
          <span className="hidden sm:inline">{t('common.next')}</span>
        </button>
      </nav>
    </div>
  );
}

export default memo(EmiPagination);
