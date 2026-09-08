import { memo, useMemo } from 'react';
import { useI18n } from '../../../../i18n';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const navButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600 sm:w-auto sm:px-3';

interface Props {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  ready: boolean;
  onChange: (page: number) => void;
}

function EmiPagination({ page, totalPages, totalItems, pageSize, ready, onChange }: Props) {
  const { t } = useI18n();
  const pages = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
  }, [page, totalPages]);
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="grid min-h-[92px] items-center gap-2 rounded-b-xl border-t border-slate-200 px-4 py-3 sm:flex sm:min-h-[58px] sm:justify-between">
      <p className="text-xs tabular-nums text-slate-500">
        {ready ? t('fleet.emi.showing_rows', { from, to, total: totalItems }) : '—'}
      </p>
      <nav aria-label={t('fleet.emi.pagination_label')} className="flex items-center justify-end gap-1.5">
        <button type="button" aria-label={t('common.previous')} disabled={!ready || page === 1} onClick={() => onChange(page - 1)} className={navButtonClass}>
          <ChevronLeft size={14} aria-hidden="true" className="sm:hidden" />
          <span className="hidden sm:inline">{t('common.previous')}</span>
        </button>
        <div className="flex w-[204px] shrink-0 items-center justify-center gap-1.5">
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            disabled={!ready}
            aria-label={t('fleet.emi.go_to_page', { page: number })}
            aria-current={page === number ? 'page' : undefined}
            onClick={() => onChange(number)}
            className={`inline-flex h-8 w-9 shrink-0 items-center justify-center rounded-lg border px-1 text-xs font-bold tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600 ${page === number ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {number}
          </button>
        ))}
        </div>
        <button type="button" aria-label={t('common.next')} disabled={!ready || page === totalPages} onClick={() => onChange(page + 1)} className={navButtonClass}>
          <ChevronRight size={14} aria-hidden="true" className="sm:hidden" />
          <span className="hidden sm:inline">{t('common.next')}</span>
        </button>
      </nav>
    </div>
  );
}

export default memo(EmiPagination);
