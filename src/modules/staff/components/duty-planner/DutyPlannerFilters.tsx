import { memo, useState, useRef, useEffect, useId, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, UsersRound, X, Search, FileSpreadsheet, LoaderCircle, Calendar, CalendarCheck2, CalendarRange, ArrowRight } from 'lucide-react';
import { DatePicker } from '../../../../components/common/DatePicker';
import { uiExcelButtonClass, uiFilterLabelClass, uiInputClass } from '../../../../shared/ui/uiTokens';
import { BrandRefreshButton, FilterResetButton } from '../../../../ui';
import type { DutyReportRange } from '../../services/dutyReport';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';
import { dutyDisplayValue } from '../../i18n/dutyPlannerCopy';

export type DutyPlannerView = 'week' | 'month' | 'custom';
interface Props {
  role: string[]; roles: string[]; searchQuery: string;
  onSearchChange: (value: string) => void; onRoleChange: (value: string[]) => void;
  onReset: () => void; onDownloadExcel: () => void;
  /** Facets away from their defaults — drives the badge on Reset. */
  activeFilterCount?: number;
  canDownloadExcel: boolean; exporting: boolean;
  onRefresh?: () => void; refreshing?: boolean;
  view: DutyPlannerView; onViewChange: (view: DutyPlannerView) => void;
  periodLabel: string;
  onPreviousPeriod: () => void; onNextPeriod: () => void; onCurrentPeriod?: () => void;
  customRange: DutyReportRange; onCustomRangeChange: (range: DutyReportRange) => void;
  periodMeta?: ReactNode; feedback?: ReactNode;
}
const views = ['week', 'month', 'custom'] as const;

function DutyPlannerFilters({ role, roles, searchQuery, onSearchChange, onRoleChange, onReset, activeFilterCount = 0, onDownloadExcel, canDownloadExcel, exporting, onRefresh, refreshing, view, onViewChange, periodLabel, onPreviousPeriod, onNextPeriod, onCurrentPeriod, customRange, onCustomRangeChange, periodMeta, feedback }: Props) {
  const { language, t } = useDutyPlannerText();
  const [open, setOpen] = useState(false);
  const dropdown = useRef<HTMLDivElement>(null);
  const roleButton = useRef<HTMLButtonElement>(null);
  const roleId = useId();
  const periodId = useId();
  const searchId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (dropdown.current && !dropdown.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); roleButton.current?.focus(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const toggle = (value: string) => {
    const selected = role.length ? role : roles;
    onRoleChange(selected.includes(value) ? selected.filter((r) => r !== value) : [...selected, value]);
  };
  // The chip row mirrors the EFFECTIVE selection: with "All roles" active every
  // role is in play, so every role gets a chip — the row under the filters
  // always shows exactly what the table includes.
  const chipRoles = role.length ? role : roles;
  return (
    <section aria-label={t('filters')} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm md:p-5">
      <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2.5 lg:grid-cols-[160px_auto_minmax(220px,260px)_minmax(0,1fr)]">
        <div ref={dropdown} className="min-w-0 lg:col-start-1 lg:row-start-1">
          <label htmlFor={roleId} className={uiFilterLabelClass}>
            <UsersRound size={13} className="shrink-0 text-emerald-500" />
            <span>{t('roles')}</span>
          </label>
          <div className="relative">
            <button id={roleId} ref={roleButton} type="button" aria-label={t('filterRoles')} aria-expanded={open} aria-controls={`${roleId}-options`} onClick={() => setOpen((value) => !value)} className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-800 outline-none transition hover:border-slate-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-200">
              <span className="flex min-w-0 items-center gap-2"><UsersRound size={15} className="shrink-0 text-slate-400" /><span className="truncate">{role.length ? t('selectedCount', { count: role.length }) : t('allRoles')}</span></span><ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div id={`${roleId}-options`} className="absolute left-0 top-[calc(100%+6px)] z-40 w-60 max-w-[calc(100vw-4rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2"><span className="text-[11px] text-slate-500">{t('includeRoles')}</span><button type="button" onClick={() => { onRoleChange([]); setOpen(false); }} className="rounded px-1.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">{t('allRoles')}</button></div>
              <div className="max-h-60 overflow-y-auto p-1.5">{roles.map((value) => <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-50"><input type="checkbox" checked={!role.length || role.includes(value)} onChange={() => toggle(value)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" /><span className="text-xs text-slate-700">{dutyDisplayValue(value, language)}</span></label>)}</div>
            </div>}
          </div>
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <span id={periodId} className={uiFilterLabelClass}>
            <CalendarRange size={13} className="shrink-0 text-emerald-500" />
            <span>{t('period')}</span>
          </span>
          <div role="group" aria-labelledby={periodId} className="inline-flex h-10 w-full items-center gap-0.5 rounded-lg border border-slate-200/70 bg-slate-100/70 p-0.5">
            {views.map((value) => <button key={value} type="button" aria-pressed={view === value} onClick={() => onViewChange(value)} className={`h-9 min-w-0 flex-auto whitespace-nowrap rounded-md px-2 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-emerald-300 ${view === value ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-500 hover:bg-white/70'}`}>{t(value)}</button>)}
          </div>
        </div>

        <div className="min-w-0 lg:col-start-3 lg:row-start-1">
          <div className={uiFilterLabelClass}>
            <Calendar size={13} className="shrink-0 text-emerald-500" />
            <span>{t('dateRange')}</span>
            {periodMeta && <span className="ml-auto flex min-w-0 items-center gap-1 normal-case tracking-normal">{periodMeta}</span>}
          </div>
          {view === 'custom' ? <div role="group" aria-label={t('customDates')} className="flex min-w-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><label htmlFor="duty-report-from" className="sr-only">{t('fromDate')}</label><DatePicker id="duty-report-from" value={customRange.fromDate} onChange={(fromDate) => onCustomRangeChange({ ...customRange, fromDate })} minDate="1900-01-01" required hideClear language={language} className="w-full" popupClassName="max-w-[calc(100vw_-_4rem)]" /></div>
            <ArrowRight size={12} aria-hidden="true" className="hidden shrink-0 text-slate-300 sm:block" />
            <div className="min-w-0 flex-1"><label htmlFor="duty-report-to" className="sr-only">{t('toDate')}</label><DatePicker id="duty-report-to" value={customRange.toDate} onChange={(toDate) => onCustomRangeChange({ ...customRange, toDate })} minDate="1900-01-01" required hideClear language={language} className="w-full" popupClassName="!left-auto !right-0 max-w-[calc(100vw_-_4rem)]" /></div>
          </div> : <div role="group" aria-label={t('displayedPeriod')} className="flex h-10 w-full max-w-[260px] items-center gap-0.5 rounded-lg border border-slate-200 px-0.5">
            <button type="button" onClick={onPreviousPeriod} aria-label={t(view === 'week' ? 'previousWeek' : 'previousMonth')} className="flex h-8 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"><ChevronLeft size={14} /></button>
            <span className="min-w-0 flex-1 text-center text-[11px] font-semibold leading-4 text-slate-700">{periodLabel}</span>
            <button type="button" onClick={onNextPeriod} aria-label={t(view === 'week' ? 'nextWeek' : 'nextMonth')} className="flex h-8 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"><ChevronRight size={14} /></button>
            {onCurrentPeriod && <button type="button" onClick={onCurrentPeriod} aria-label={t('currentWeek')} className="flex h-8 w-7 shrink-0 items-center justify-center border-l border-slate-200 text-emerald-600 hover:bg-emerald-50"><CalendarCheck2 size={13} /></button>}
          </div>}
        </div>

        <div className="min-w-0 lg:col-start-4 lg:row-start-1">
          <label htmlFor={searchId} className={uiFilterLabelClass}>
            <Search size={13} className="shrink-0 text-slate-400" />
            <span>{t('search')}</span>
          </label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id={searchId} value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder={t('searchPlaceholder')} className={`${uiInputClass} pl-10`} />
          </div>
        </div>

        <div role="group" aria-label={t('actions')} className="flex flex-wrap items-center gap-2 lg:col-span-2 lg:col-start-3 lg:row-start-2 lg:justify-end">
          <FilterResetButton count={activeFilterCount} onClick={onReset} aria-label={t('reset')}>
            {t('reset')}
          </FilterResetButton>
          {onRefresh && <BrandRefreshButton loading={refreshing} onClick={onRefresh} ariaLabel={t('refreshData')}>{t('refresh')}</BrandRefreshButton>}
          <button type="button" onClick={onDownloadExcel} disabled={!canDownloadExcel || exporting} aria-busy={exporting} className={`group relative ${uiExcelButtonClass}`} aria-label={t('download')}>
            <span className={`inline-flex ${canDownloadExcel && !exporting ? 'group-hover:animate-[var(--animate-action-excel)]' : ''}`}>
              {exporting ? <LoaderCircle size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            </span>
            {exporting ? t('preparing') : t('excel')}
          </button>
        </div>
      </div>

      {/* Selected-role chips live OUTSIDE the grid on purpose: as a spanning
          grid row they fed the auto-sized Period (Weekly/Monthly/Custom) column,
          so every chip selected stretched the Period control. Below the grid
          they can wrap freely and the filter row's widths stay standard no
          matter which roles are selected. */}
      <div role="group" aria-label={t('selectedRoles')} className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
        {chipRoles.map((value) => <button key={value} type="button" aria-label={t('removeRole', { role: dutyDisplayValue(value, language) })} onClick={() => onRoleChange(chipRoles.filter((r) => r !== value))} className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-300"><span className="truncate">{dutyDisplayValue(value, language)}</span><X size={11} className="shrink-0" /></button>)}
      </div>
      {feedback && <div className="mt-3 border-t border-slate-100 pt-3">{feedback}</div>}
    </section>
  );
}
export default memo(DutyPlannerFilters);
