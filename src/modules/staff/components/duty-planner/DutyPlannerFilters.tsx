import { memo, useState, useRef, useEffect, useId, type ReactNode } from 'react';
import { uiSearchInputClass } from '../../../../shared/ui/uiTokens';
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw, UsersRound, X, Search, FileSpreadsheet, LoaderCircle, CalendarDays, CalendarCheck2, ArrowRight } from 'lucide-react';
import { DatePicker } from '../../../../components/common/DatePicker';
import type { DutyReportRange } from '../../services/dutyReport';
import { useDutyPlannerText } from '../../hooks/useDutyPlannerText';
import { dutyDisplayValue } from '../../i18n/dutyPlannerCopy';

export type DutyPlannerView = 'week' | 'month' | 'custom';
interface Props {
  role: string[]; roles: string[]; searchQuery: string;
  onSearchChange: (value: string) => void; onRoleChange: (value: string[]) => void;
  onReset: () => void; onDownloadExcel: () => void;
  canDownloadExcel: boolean; exporting: boolean; downloadTitle: string;
  view: DutyPlannerView; onViewChange: (view: DutyPlannerView) => void;
  periodLabel: string; periodTitle: string;
  onPreviousPeriod: () => void; onNextPeriod: () => void; onCurrentPeriod?: () => void;
  customRange: DutyReportRange; onCustomRangeChange: (range: DutyReportRange) => void;
  periodMeta?: ReactNode; feedback?: ReactNode;
}
const views = ['week', 'month', 'custom'] as const;
const dateInputClass = 'w-full min-w-0 [&>div>input]:h-9 [&>div>input]:border-slate-200 [&>div>input]:pl-2 [&>div>input]:pr-7 [&>div>input]:text-xs [&>div>input]:font-medium [&>div>input]:tabular-nums';

function DutyPlannerFilters({ role, roles, searchQuery, onSearchChange, onRoleChange, onReset, onDownloadExcel, canDownloadExcel, exporting, downloadTitle, view, onViewChange, periodLabel, periodTitle, onPreviousPeriod, onNextPeriod, onCurrentPeriod, customRange, onCustomRangeChange, periodMeta, feedback }: Props) {
  const { language, t } = useDutyPlannerText();
  const [open, setOpen] = useState(false);
  const dropdown = useRef<HTMLDivElement>(null);
  const roleButton = useRef<HTMLButtonElement>(null);
  const roleId = useId();
  const periodId = useId();
  const dateId = useId();
  const searchId = useId();
  const labelClass = `text-[10.5px] font-semibold text-slate-500 ${language === 'en' ? 'uppercase tracking-wide' : ''}`;
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
  return (
    <section aria-label={t('filters')} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2.5 lg:grid-cols-[160px_auto_minmax(220px,260px)_minmax(0,1fr)]">
        <div ref={dropdown} className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="mb-1 flex h-5 items-center"><label htmlFor={roleId} className={labelClass}>{t('roles')}</label></div>
          <div className="relative">
            <button id={roleId} ref={roleButton} type="button" aria-label={t('filterRoles')} aria-expanded={open} aria-controls={`${roleId}-options`} onClick={() => setOpen((value) => !value)} className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 outline-none hover:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-200">
              <span className="flex min-w-0 items-center gap-2"><UsersRound size={14} className="shrink-0 text-slate-400" /><span className="truncate">{role.length ? t('selectedCount', { count: role.length }) : t('allRoles')}</span></span><ChevronDown size={14} className={`shrink-0 text-slate-400 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div id={`${roleId}-options`} className="absolute left-0 top-[calc(100%+6px)] z-40 w-60 max-w-[calc(100vw-4rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2"><span className="text-[11px] text-slate-500">{t('includeRoles')}</span><button type="button" onClick={() => { onRoleChange([]); setOpen(false); }} className="rounded px-1.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">{t('allRoles')}</button></div>
              <div className="max-h-60 overflow-y-auto p-1.5">{roles.map((value) => <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-50"><input type="checkbox" checked={!role.length || role.includes(value)} onChange={() => toggle(value)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" /><span className="text-xs text-slate-700">{dutyDisplayValue(value, language)}</span></label>)}</div>
            </div>}
          </div>
        </div>

        <div role="group" aria-label={t('selectedRoles')} className="flex min-w-0 flex-wrap items-center gap-1.5 lg:col-span-2 lg:col-start-1 lg:row-start-2">
          {role.length ? role.map((value) => <button key={value} type="button" aria-label={t('removeRole', { role: dutyDisplayValue(value, language) })} onClick={() => onRoleChange(role.filter((r) => r !== value))} className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-300"><span className="truncate">{dutyDisplayValue(value, language)}</span><X size={11} className="shrink-0" /></button>) : <span className="text-xs text-slate-500">{t('allRolesIncluded')}</span>}
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <div className="mb-1 flex h-5 items-center"><span id={periodId} className={labelClass}>{t('period')}</span></div>
          <div role="group" aria-labelledby={periodId} className="inline-flex h-9 w-full items-center gap-0.5 rounded-lg border border-slate-200/70 bg-slate-100/70 p-0.5">
            {views.map((value) => <button key={value} type="button" aria-pressed={view === value} onClick={() => onViewChange(value)} className={`h-8 min-w-0 flex-auto whitespace-nowrap rounded-md px-2 text-[11px] font-semibold focus-visible:ring-2 focus-visible:ring-emerald-300 ${view === value ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-500 hover:bg-white/70'}`}>{t(value)}</button>)}
          </div>
        </div>

        <div className="min-w-0 lg:col-start-3 lg:row-start-1">
          <div className="mb-1 flex h-5 items-center justify-between gap-2"><span id={dateId} className={labelClass}>{t('dateRange')}</span>{periodMeta && <span className="flex items-center gap-1">{periodMeta}</span>}</div>
          {view === 'custom' ? <div role="group" aria-label={t('customDates')} className="flex min-w-0 items-center gap-1.5" title={t('bothDates')}>
            <div className="min-w-0 flex-1"><label htmlFor="duty-report-from" className="sr-only">{t('fromDate')}</label><DatePicker id="duty-report-from" value={customRange.fromDate} onChange={(fromDate) => onCustomRangeChange({ ...customRange, fromDate })} minDate="1900-01-01" required hideClear language={language} className={dateInputClass} popupClassName="max-w-[calc(100vw_-_4rem)]" icon={<CalendarDays size={14} className="text-slate-400" />} /></div>
            <ArrowRight size={12} aria-hidden="true" className="shrink-0 text-slate-300" />
            <div className="min-w-0 flex-1"><label htmlFor="duty-report-to" className="sr-only">{t('toDate')}</label><DatePicker id="duty-report-to" value={customRange.toDate} onChange={(toDate) => onCustomRangeChange({ ...customRange, toDate })} minDate="1900-01-01" required hideClear language={language} className={dateInputClass} popupClassName="!left-auto !right-0 max-w-[calc(100vw_-_4rem)]" icon={<CalendarDays size={14} className="text-slate-400" />} /></div>
          </div> : <div role="group" aria-label={t('displayedPeriod')} className="flex h-9 w-full max-w-[260px] items-center gap-0.5 rounded-lg border border-slate-200 px-0.5">
            <button type="button" onClick={onPreviousPeriod} aria-label={t(view === 'week' ? 'previousWeek' : 'previousMonth')} className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"><ChevronLeft size={14} /></button>
            <span title={periodTitle} className="min-w-0 flex-1 text-center text-[11px] font-semibold leading-4 text-slate-700">{periodLabel}</span>
            <button type="button" onClick={onNextPeriod} aria-label={t(view === 'week' ? 'nextWeek' : 'nextMonth')} className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"><ChevronRight size={14} /></button>
            {onCurrentPeriod && <button type="button" onClick={onCurrentPeriod} aria-label={t('currentWeek')} title={t('currentWeek')} className="flex h-6 w-6 shrink-0 items-center justify-center border-l border-slate-200 text-emerald-600 hover:bg-emerald-50"><CalendarCheck2 size={13} /></button>}
          </div>}
        </div>

        <div className="min-w-0 lg:col-start-4 lg:row-start-1">
          <div className="mb-1 flex h-5 items-center"><label htmlFor={searchId} className={labelClass}>{t('search')}</label></div>
          <div className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input id={searchId} type="search" aria-label={t('search')} placeholder={t('searchPlaceholder')} value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} className={uiSearchInputClass} /></div>
        </div>

        <div role="group" aria-label={t('actions')} className="flex items-center gap-2 lg:col-span-2 lg:col-start-3 lg:row-start-2 lg:justify-end">
          <button type="button" onClick={onReset} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300"><RotateCcw size={13} />{t('reset')}</button>
          <button type="button" onClick={onDownloadExcel} disabled={!canDownloadExcel || exporting} aria-busy={exporting} title={downloadTitle} className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
            {exporting ? <LoaderCircle size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}{t(exporting ? 'preparing' : 'download')}
          </button>
        </div>
      </div>
      {feedback && <div className="mt-3 border-t border-slate-100 pt-3">{feedback}</div>}
    </section>
  );
}
export default memo(DutyPlannerFilters);
