// A compact, two-row desktop filter. Roles sit above their selected chips;
// period/date controls sit above search and export actions. Custom dates replace
// the period navigator in-place instead of adding a third full-width row.
import { memo, useState, useRef, useEffect, useId, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw, UsersRound, X, Search, FileSpreadsheet, LoaderCircle, CalendarDays, CalendarCheck2, ArrowRight } from 'lucide-react';
import { DatePicker } from '../../../../components/common/DatePicker';
import type { DutyReportRange } from '../../services/dutyReport';

export type DutyPlannerView = 'week' | 'month' | 'custom';

interface DutyPlannerFiltersProps {
  role: string[];
  roles: string[];
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onRoleChange: (val: string[]) => void;
  onReset: () => void;
  onDownloadExcel: () => void;
  canDownloadExcel: boolean;
  exporting: boolean;
  downloadTitle: string;
  view: DutyPlannerView;
  onViewChange: (view: DutyPlannerView) => void;
  periodLabel: string;
  periodTitle: string;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onCurrentPeriod?: () => void;
  customRange: DutyReportRange;
  onCustomRangeChange: (range: DutyReportRange) => void;
  periodMeta?: ReactNode;
  feedback?: ReactNode;
}

const VIEWS: { value: DutyPlannerView; label: string }[] = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'custom', label: 'Custom range' },
];
const labelClass = 'text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500';
const dateInputClass = 'w-full min-w-0 [&>div>input]:border-slate-200 [&>div>input]:pl-2 [&>div>input]:pr-7 [&>div>input]:text-xs [&>div>input]:font-medium [&>div>input]:tabular-nums';

function DutyPlannerFilters({
  role, roles, searchQuery, onSearchChange, onRoleChange, onReset,
  onDownloadExcel, canDownloadExcel, exporting, downloadTitle,
  view, onViewChange, periodLabel, periodTitle, onPreviousPeriod,
  onNextPeriod, onCurrentPeriod, customRange, onCustomRangeChange,
  periodMeta, feedback,
}: DutyPlannerFiltersProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const roleButtonRef = useRef<HTMLButtonElement>(null);
  const roleControlId = useId();
  const periodControlId = useId();

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        roleButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDropdownOpen]);

  const toggleRole = (value: string) => {
    const included = role.length ? role : roles;
    onRoleChange(included.includes(value) ? included.filter((r) => r !== value) : [...included, value]);
  };

  return (
    <section aria-label="Duty Planner filters" className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm lg:px-5">
      <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Row 1 / left: the role selector. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1" ref={dropdownRef}>
          <div className="mb-1.5 flex h-5 items-center">
            <label htmlFor={roleControlId} className={labelClass}>Roles</label>
          </div>
          <div className="relative">
            <button
              id={roleControlId}
              ref={roleButtonRef}
              type="button"
              aria-label="Filter employee roles"
              aria-expanded={isDropdownOpen}
              aria-controls={`${roleControlId}-options`}
              onClick={() => setIsDropdownOpen((open) => !open)}
              className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition-colors hover:border-emerald-300 hover:bg-emerald-50/30 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-100"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <UsersRound size={16} className="shrink-0 text-slate-400" />
                <span className="truncate">{role.length === 0 ? 'All roles' : `${role.length} ${role.length === 1 ? 'role' : 'roles'} selected`}</span>
              </span>
              <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDropdownOpen && (
              <div id={`${roleControlId}-options`} className="absolute left-0 top-[calc(100%+6px)] z-40 w-full min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="text-[11px] font-medium text-slate-500">Include roles</span>
                  <button type="button" onClick={() => { onRoleChange([]); setIsDropdownOpen(false); }} className="rounded px-1.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-300">All roles</button>
                </div>
                <div className="max-h-60 overflow-y-auto p-1.5">
                  {roles.map((value) => (
                    <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50">
                      <input type="checkbox" checked={!role.length || role.includes(value)} onChange={() => toggleRole(value)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />
                      <span className="text-[13px] text-slate-700">{value}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2 / left: chips stay immediately below Roles, also on phones. */}
        <div role="group" aria-label="Selected role filters" className="flex min-w-0 flex-wrap items-center gap-1.5 lg:col-start-1 lg:row-start-2 lg:min-h-10 lg:content-center">
          {role.length ? role.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Remove ${value} role filter`}
              title={`Remove ${value}`}
              onClick={() => onRoleChange(role.filter((r) => r !== value))}
              className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-1 text-[11px] font-medium text-emerald-800 transition-colors hover:border-emerald-200 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <span className="truncate">{value}</span><X size={11} className="shrink-0 text-emerald-600" />
            </button>
          )) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><UsersRound size={13} /> All roles included</span>
          )}
        </div>

        {/* Row 1 / right: Weekly / Monthly / Custom and its date control. */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <div className="mb-1.5 flex h-5 items-center justify-between gap-2">
            <span id={periodControlId} className={labelClass}>Period</span>
            {periodMeta && <div className="flex shrink-0 items-center gap-1.5">{periodMeta}</div>}
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div role="group" aria-labelledby={periodControlId} className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-lg border border-slate-200/70 bg-slate-100/80 p-1">
              {VIEWS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => onViewChange(value)}
                  className={`h-8 flex-auto whitespace-nowrap rounded-md px-2 text-[11px] font-semibold sm:px-2.5 sm:text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${view === value ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'}`}
                >{label}</button>
              ))}
            </div>

            {view === 'custom' ? (
              <div role="group" aria-label="Custom date range" className="flex min-w-0 flex-1 items-center gap-1.5" title="Both dates are included in the table and Excel export.">
                <div className="min-w-0 flex-1">
                  <label htmlFor="duty-report-from" className="sr-only">From date</label>
                  <DatePicker id="duty-report-from" value={customRange.fromDate} onChange={(fromDate) => onCustomRangeChange({ ...customRange, fromDate })} minDate="1900-01-01" required hideClear className={dateInputClass} popupClassName="max-w-[calc(100vw_-_4rem)]" icon={<CalendarDays size={15} className="text-slate-400" />} />
                </div>
                <ArrowRight size={13} aria-hidden="true" className="shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <label htmlFor="duty-report-to" className="sr-only">To date</label>
                  <DatePicker id="duty-report-to" value={customRange.toDate} onChange={(toDate) => onCustomRangeChange({ ...customRange, toDate })} minDate="1900-01-01" required hideClear className={dateInputClass} popupClassName="!left-auto !right-0 max-w-[calc(100vw_-_4rem)]" icon={<CalendarDays size={15} className="text-slate-400" />} />
                </div>
              </div>
            ) : (
              <div role="group" aria-label="Displayed period" className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-white p-1">
                <button type="button" onClick={onPreviousPeriod} aria-label={`Previous ${view}`} title={`Previous ${view}`} className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"><ChevronLeft size={16} /></button>
                <span title={periodTitle} className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1 text-center text-xs font-semibold leading-4 text-slate-700">
                  <CalendarDays size={14} className="hidden shrink-0 text-slate-400 xl:block" />{periodLabel}
                </span>
                <button type="button" onClick={onNextPeriod} aria-label={`Next ${view}`} title={`Next ${view}`} className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"><ChevronRight size={16} /></button>
                {onCurrentPeriod && <button type="button" onClick={onCurrentPeriod} aria-label="Current week" title="Go to current week" className="ml-1 flex h-7 w-8 shrink-0 items-center justify-center border-l border-slate-200 text-emerald-600 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"><CalendarCheck2 size={15} /></button>}
              </div>
            )}
          </div>
        </div>

        {/* Row 2 / right: search and the paired Reset / Excel actions. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:flex-nowrap lg:col-start-2 lg:row-start-2 lg:gap-3">
          <div className="relative w-full min-w-0 sm:flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" aria-label="Search employees" placeholder="Search employee name..." value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-[13px] text-slate-700 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
          </div>
          <div role="group" aria-label="Duty Planner actions" className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onReset} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"><RotateCcw size={14} /> Reset</button>
            <button type="button" onClick={onDownloadExcel} disabled={!canDownloadExcel || exporting} aria-busy={exporting} title={downloadTitle} className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-600 bg-emerald-600 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-900/10 transition-colors hover:border-emerald-700 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
              {exporting ? <LoaderCircle size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              {exporting ? 'Preparing Excel…' : 'Download Excel'}
            </button>
          </div>
        </div>
      </div>
      {feedback && <div className="mt-3 border-t border-slate-100 pt-3">{feedback}</div>}
    </section>
  );
}

export default memo(DutyPlannerFilters);
