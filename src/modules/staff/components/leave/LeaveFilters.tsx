// src/modules/staff/components/leave/LeaveFilters.tsx

import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  UsersRound,
  Building2,
  Calendar,
  CalendarOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Trash2,
  X,
} from 'lucide-react';
import {
  uiCardClass,
  uiFilterLabelClass,
  uiFilterResetButtonClass,
  uiFilterSearchFieldClass,
  uiIconButton,
} from '../../../../shared/ui/uiTokens';
import { Button } from '../../../../ui';
import { BrandRefreshButton } from '../../../../ui';
import MasterDropdown from '../../../masters/components/MasterDropdown';
import type { LeaveFilters as LeaveFilterState } from '../../hooks/useLeaveManagement';
import { useI18n } from '../../../../i18n';
import {
  departmentLabel,
  leaveMonthName,
  leaveTypeLabel,
  personNameLabel,
} from '../../utils/leaveDisplay';
import type { LeaveRequest } from '../../types/staffDashboard';
import type { Employee } from '../../../masters/employees/types/employee';

interface LeaveFiltersProps {
  filters: LeaveFilterState;
  employees: Employee[];
  departments: string[];
  onFilterChange: <K extends keyof LeaveFilterState>(key: K, value: LeaveFilterState[K]) => void;
  /**
   * Commit a search term immediately instead of waiting out the typing pause —
   * used by Enter and by the field's clear button. Omit it to commit whatever is
   * currently typed (clearing does the opposite: it commits the empty term).
   */
  onSearch: (value?: string) => void;
  onReset: () => void;
  onRefresh: () => void;
  onNewRequest: () => void;
  loading: boolean;
  showForm: boolean;
  /** Selected table row — the actions for it appear beside Reset. */
  selected: LeaveRequest | null;
  onViewSelected: () => void;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onDeleteSelected: () => void;
}

/**
 * Search field: one step taller (44px) than the filter controls, with the 18px
 * glyph and 11px inset of the Trip List search. Finding a request is the main
 * thing anyone does on this page, so it is the biggest control in the card and
 * it sits on the left, where the eye starts. The styling itself is the shared
 * `uiFilterSearchFieldClass`, so every filter card in the app matches.
 */
const searchInputClass = uiFilterSearchFieldClass;

const viewIconButtonClass = `${uiIconButton('view', 'lg')} group`;
const approveIconButtonClass = `${uiIconButton('success', 'lg')} group`;
const rejectIconButtonClass = `${uiIconButton('destructiveOutline', 'lg')} group`;
const deleteIconButtonClass = `${uiIconButton('destructive', 'lg')} group`;

const LEAVE_TYPES = ['Casual', 'Sick', 'Emergency', 'Annual'] as const;

/** `01`..`12` with the 0-based index the month name helper expects. The label
 *  itself is produced from the active language (te-IN → ఫిబ్రవరి). */
const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, '0'),
  index,
}));

/**
 * Month-only picker: a grid of month names with year navigation. Styled to
 * match the MasterDropdown trigger it sits beside (same 36px white control,
 * 12px corners, rotating chevron) so the filter row reads as one system.
 */
function MonthPicker({
  value,
  onChange,
}: {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
}) {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedYear = value ? Number(value.slice(0, 4)) : new Date().getFullYear();
  const selectedMonth = value ? value.slice(5, 7) : '';
  const [viewYear, setViewYear] = useState(selectedYear);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedMonthIndex = MONTHS.find((m) => m.value === selectedMonth)?.index ?? -1;
  const displayLabel = value
    ? `${selectedMonthIndex >= 0 ? leaveMonthName(language, selectedMonthIndex, 'short') : ''} ${selectedYear}`
    : t('staff.leave.month_select');

  const handleMonthClick = (monthValue: string) => {
    onChange(`${viewYear}-${monthValue}`);
    setOpen(false);
  };

  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYear = new Date().getFullYear();

  return (
    <div className="relative" ref={ref}>
      <span className={uiFilterLabelClass}>
        <Calendar size={13} className="shrink-0 text-emerald-500" />
        <span>{t('common.month')}</span>
      </span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t('staff.leave.month_select')}
        aria-expanded={open}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition hover:border-emerald-300 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 min-w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* Year navigation */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label={t('staff.leave.previous_year')}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-slate-800">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label={t('staff.leave.next_year')}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {/* Month grid — 4 columns x 3 rows */}
          <div className="grid grid-cols-4 gap-1 p-2">
            {MONTHS.map((month) => {
              const isSelected = selectedMonth === month.value && selectedYear === viewYear;
              const isCurrentMonth = month.value === currentMonth && viewYear === currentYear;
              return (
                <button
                  key={month.value}
                  type="button"
                  onClick={() => handleMonthClick(month.value)}
                  className={`rounded-lg py-2.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isCurrentMonth
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {leaveMonthName(language, month.index, 'long')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Leave Management filter card, standardised on the Trip List / Shop List
 * conventions: uppercase micro-labels with emerald glyphs, MasterDropdown
 * controls, and the shared action buttons — Reset (ghost + spin), the DMR-hen
 * Refresh pill, and the emerald New Request primary whose plus icon stamps on
 * hover. Every hover animation plays unconditionally (no `motion-safe:` guard).
 *
 * Row 2 is the Trip List layout: the search field sits on the LEFT, labelled
 * and one size up (44px field, 18px glyph) because searching is the page's
 * primary interaction; the actions sit on the right. Enter in that field, or
 * the Search button, commits immediately — typing is debounced by the hook, so
 * no request is fired per character.
 *
 * When a table row is selected its actions appear in that same cluster, beside
 * Reset, instead of being repeated on every row: View (always), and Approve /
 * Reject / Delete while the request is still Pending. The cluster carries
 * `data-leave-actions`, which is how the page knows a click landed on the row's
 * own controls and must therefore keep the selection (any other click outside
 * the grid deselects it).
 */
function LeaveFilters({
  filters,
  employees,
  departments,
  onFilterChange,
  onSearch,
  onReset,
  onRefresh,
  onNewRequest,
  loading,
  showForm,
  selected,
  onViewSelected,
  onApproveSelected,
  onRejectSelected,
  onDeleteSelected,
}: LeaveFiltersProps) {
  const { t, language } = useI18n();

  /* The three option lists are memoized because this component re-renders on
     every keystroke in the search box: rebuilding 150 employee labels (each an
     i18n lookup per name word) per character was the page's one real stall.
     They only change when the source data or the language does. */
  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d, label: departmentLabel(t, d), keywords: d })),
    [departments, t]
  );

  // Alphabetical from the first word, so the dropdown reads A → Z.
  const employeeOptions = useMemo(
    () =>
      [...employees]
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName, undefined, { numeric: true }))
        .map((e) => ({
          value: String(e.id),
          label: personNameLabel(t, language, e.employeeName),
          // The label is Telugu; the stored name keeps the English search working.
          keywords: e.employeeName,
        })),
    [employees, t, language]
  );

  const leaveTypeOptions = useMemo(
    () =>
      LEAVE_TYPES.map((type) => ({
        value: type,
        label: leaveTypeLabel(t, type),
        keywords: type,
      })),
    [t]
  );

  const handleEmployeeChange = useCallback(
    (val: string) => {
      onFilterChange('employeeId', val ? Number(val) : null);
    },
    [onFilterChange]
  );

  return (
    <div className={`${uiCardClass} space-y-4 p-4 md:p-5`}>
      {/* Row 1 — Month, Department, Employee, Leave Type */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MonthPicker
          value={filters.month}
          onChange={(val) => onFilterChange('month', val)}
        />

        <div>
          <label className={uiFilterLabelClass}>
            <Building2 size={13} className="shrink-0 text-emerald-500" />
            <span>{t('staff.department')}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t('staff.department')}
            value={filters.department}
            options={departmentOptions}
            onChange={(val) => onFilterChange('department', val)}
            placeholder={t('staff.leave.all_departments')}
            allowClear
            disabled={loading}
            className="w-full"
          />
        </div>

        <div>
          <label className={uiFilterLabelClass}>
            <UsersRound size={13} className="shrink-0 text-emerald-500" />
            <span>{t('common.employee')}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t('common.employee')}
            value={filters.employeeId ? String(filters.employeeId) : ''}
            options={employeeOptions}
            onChange={handleEmployeeChange}
            placeholder={t('staff.leave.all_employees')}
            searchable
            allowClear
            disabled={loading}
            className="w-full"
          />
        </div>

        <div>
          <label className={uiFilterLabelClass}>
            <CalendarOff size={13} className="shrink-0 text-emerald-500" />
            <span>{t('staff.leave_type')}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t('staff.leave_type')}
            value={filters.leaveType === 'All' ? '' : filters.leaveType}
            options={leaveTypeOptions}
            onChange={(val) => onFilterChange('leaveType', (val || 'All') as LeaveFilterState['leaveType'])}
            placeholder={t('staff.leave.all_types')}
            allowClear
            disabled={loading}
            className="w-full"
          />
        </div>
      </div>

      {/* Row 2 — the Trip List layout: big search on the LEFT (label + 44px
          field), then the action cluster on the right — the selected row's
          actions first, then Search / Reset / Refresh / New Request. */}
      <div className="grid grid-cols-1 items-end gap-3.5 lg:grid-cols-12">
        <div className="lg:col-span-4 2xl:col-span-5">
          <label className={uiFilterLabelClass} htmlFor="leave-search">
            <Search size={17} className="shrink-0 text-slate-400" />
            <span>{t('staff.leave.search_label')}</span>
            {/* No Search button: the term is applied as it is typed (300 ms
                pause), so the label says so instead of leaving people hunting
                for a button that no longer exists. */}
            <span className="text-[11px] font-normal text-slate-400">
              {' · '}
              {t('staff.leave.search_live')}
            </span>
          </label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="leave-search"
              type="text"
              aria-label={t('staff.leave.search_aria')}
              placeholder={t('staff.leave.search_placeholder')}
              value={filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                onSearch();
              }}
              className={searchInputClass}
            />
            {filters.search !== '' && (
              <button
                type="button"
                onClick={() => {
                  onFilterChange('search', '');
                  onSearch('');
                }}
                aria-label={`${t('common.clear')} — ${t('common.search')}`}
                className="group absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="flex max-w-full flex-wrap items-center justify-end gap-2 lg:col-span-8 2xl:col-span-7">
          {/* Selected-row actions — they appear the moment a row is selected and
              act on that row only (the table has no Action column any more). */}
          {selected && (
            <div
              role="group"
              data-leave-actions=""
              aria-label={t('staff.leave.actions_for', {
                name: personNameLabel(t, language, selected.employeeName),
              })}
              className="flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-1"
            >
              <span className="hidden max-w-[8.5rem] truncate px-1.5 text-xs font-semibold text-slate-600 2xl:inline">
                {personNameLabel(t, language, selected.employeeName)}
              </span>
              <button
                type="button"
                onClick={onViewSelected}
                className={viewIconButtonClass}
                aria-label={t('staff.leave.view_aria', {
                  name: personNameLabel(t, language, selected.employeeName),
                })}
              >
                <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-view)]"><Eye /></span>
              </button>
              {selected.status === 'Pending' && (
                <>
                  <button
                    type="button"
                    onClick={onApproveSelected}
                    className={approveIconButtonClass}
                    aria-label={t('staff.leave.approve_aria', {
                      name: personNameLabel(t, language, selected.employeeName),
                    })}
                  >
                    <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-approve)]"><CheckCircle /></span>
                  </button>
                  <button
                    type="button"
                    onClick={onRejectSelected}
                    className={rejectIconButtonClass}
                    aria-label={t('staff.leave.reject_aria', {
                      name: personNameLabel(t, language, selected.employeeName),
                    })}
                  >
                    <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reject)]"><XCircle /></span>
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteSelected}
                    className={deleteIconButtonClass}
                    aria-label={t('staff.leave.delete_aria', {
                      name: personNameLabel(t, language, selected.employeeName),
                    })}
                  >
                    <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-delete)]"><Trash2 /></span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* The selected row's actions and the filter's own actions are two
              different groups — a hairline keeps them from reading as one long
              button bar once a row is picked. */}
          {selected && (
            <span aria-hidden="true" className="mx-0.5 hidden h-6 w-px shrink-0 bg-slate-200 sm:block" />
          )}

          <button
            type="button"
            onClick={onReset}
            className={uiFilterResetButtonClass}
            aria-label={`${t('common.reset')} — ${t('common.filter')}`}
          >
            <span className="inline-flex group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={14} /></span>
            {t('common.reset')}
          </button>

          <BrandRefreshButton loading={loading} onClick={onRefresh} size="lg" ariaLabel={t('staff.leave.refresh_aria')}>
            {t('common.refresh')}
          </BrandRefreshButton>

          <Button
            type="button"
            size="lg"
            className="group"
            onClick={onNewRequest}
            icon={
              <span className={`inline-flex ${showForm ? '' : 'group-hover:animate-[var(--animate-action-add)]'}`}>
                <Plus
                  size={16}
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${showForm ? 'rotate-45' : ''}`}
                />
              </span>
            }
          >
            {showForm ? t('staff.leave.hide_form') : t('staff.leave.new_request')}
          </Button>
        </div>
      </div>

    </div>
  );
}

export default memo(LeaveFilters);
