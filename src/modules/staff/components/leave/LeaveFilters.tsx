// src/modules/staff/components/leave/LeaveFilters.tsx

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  LayoutGrid,
  UsersRound,
  Building2,
  Calendar,
  CalendarOff,
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Plus,
} from 'lucide-react';
import {
  uiCardClass,
  uiFilterLabelClass,
  uiInputClass,
} from '../../../../shared/ui/uiTokens';
import { Button } from '../../../../ui';
import { BrandRefreshButton } from '../../../../ui';
import { ActionTooltip } from '../../../../ui/ActionTooltip';
import MasterDropdown from '../../../masters/components/MasterDropdown';
import type { LeaveFilters as LeaveFilterState } from '../../hooks/useLeaveManagement';
import type { Employee } from '../../../masters/employees/types/employee';

interface LeaveFiltersProps {
  filters: LeaveFilterState;
  employees: Employee[];
  departments: string[];
  onFilterChange: <K extends keyof LeaveFilterState>(key: K, value: LeaveFilterState[K]) => void;
  onReset: () => void;
  onRefresh: () => void;
  onNewRequest: () => void;
  loading: boolean;
  showForm: boolean;
  stats: {
    approved: number;
    pending: number;
    rejected: number;
    approvedDays: number;
    onLeaveToday: number;
  };
}

type LeaveStatusTab = 'All' | 'Pending' | 'Approved' | 'Rejected';

const STATUS_TABS: { label: LeaveStatusTab; Icon: typeof Clock }[] = [
  { label: 'All', Icon: LayoutGrid },
  { label: 'Pending', Icon: Clock },
  { label: 'Approved', Icon: CheckCircle2 },
  { label: 'Rejected', Icon: XCircle },
];

const LEAVE_TYPES = ['Casual', 'Sick', 'Emergency', 'Annual'] as const;

const MONTHS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

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

  const displayLabel = value
    ? `${MONTHS.find((m) => m.value === selectedMonth)?.label || ''} ${selectedYear}`
    : 'Select month';

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
        <span>Month</span>
      </span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Select month"
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
              aria-label="Previous year"
              className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-slate-800">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Next year"
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
                  {month.label}
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
 * controls, the trips search input, a segmented status toggle, and the shared
 * action buttons — Reset (ghost + spin), the DMR-hen Refresh pill, and the
 * emerald New Request primary whose plus icon stamps on hover. Every hover
 * animation plays unconditionally (no `motion-safe:` guard).
 */
function LeaveFilters({
  filters,
  employees,
  departments,
  onFilterChange,
  onReset,
  onRefresh,
  onNewRequest,
  loading,
  showForm,
  stats,
}: LeaveFiltersProps) {
  const departmentOptions = departments.map((d) => ({ value: d, label: d }));

  // Alphabetical from the first word, so the dropdown reads A → Z.
  const employeeOptions = [...employees]
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, undefined, { numeric: true }))
    .map((e) => ({
      value: String(e.id),
      label: e.employeeName,
    }));

  const leaveTypeOptions = LEAVE_TYPES.map((t) => ({ value: t, label: t }));

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
            <span>Department</span>
          </label>
          <MasterDropdown
            hideLabel
            label="Department"
            value={filters.department}
            options={departmentOptions}
            onChange={(val) => onFilterChange('department', val)}
            placeholder="All Departments"
            allowClear
            disabled={loading}
            className="w-full"
          />
        </div>

        <div>
          <label className={uiFilterLabelClass}>
            <UsersRound size={13} className="shrink-0 text-emerald-500" />
            <span>Employee</span>
          </label>
          <MasterDropdown
            hideLabel
            label="Employee"
            value={filters.employeeId ? String(filters.employeeId) : ''}
            options={employeeOptions}
            onChange={handleEmployeeChange}
            placeholder="All Employees"
            searchable
            allowClear
            disabled={loading}
            className="w-full"
          />
        </div>

        <div>
          <label className={uiFilterLabelClass}>
            <CalendarOff size={13} className="shrink-0 text-emerald-500" />
            <span>Leave Type</span>
          </label>
          <MasterDropdown
            hideLabel
            label="Leave Type"
            value={filters.leaveType === 'All' ? '' : filters.leaveType}
            options={leaveTypeOptions}
            onChange={(val) => onFilterChange('leaveType', (val || 'All') as LeaveFilterState['leaveType'])}
            placeholder="All Types"
            allowClear
            disabled={loading}
            className="w-full"
          />
        </div>
      </div>

      {/* Row 2 — Search (left) + Status segmented toggle (right) */}
      <div className="grid grid-cols-1 items-end gap-3.5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <label className={uiFilterLabelClass}>
            <Search size={13} className="shrink-0 text-slate-400" />
            <span>Search</span>
          </label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee, leave type, reason..."
              value={filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
              className={`${uiInputClass} pl-10`}
            />
          </div>
        </div>

        <div className="lg:col-span-7 lg:flex lg:justify-end">
          <span className={uiFilterLabelClass}>
            <Activity size={13} className="shrink-0 text-emerald-500" />
            <span>Status</span>
          </span>
          <div
            role="group"
            aria-label="Filter by status"
            className="flex h-10 w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-slate-200/70 bg-slate-100/70 p-0.5 lg:ml-auto lg:w-auto"
          >
            {STATUS_TABS.map(({ label, Icon }) => {
              const isActive = filters.status === label;
              // Active tab wears its status colour: Pending orange, Approved
              // the app green, Rejected light red; All stays neutral white.
              const activeClass = {
                All: 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/60',
                Pending: 'bg-orange-50 text-orange-700 shadow-sm ring-1 ring-orange-200/70',
                Approved: 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200/70',
                Rejected: 'bg-rose-50 text-rose-700 shadow-sm ring-1 ring-rose-200/70',
              }[label];
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onFilterChange('status', label)}
                  aria-pressed={isActive}
                  className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-emerald-300 sm:px-2 sm:text-xs lg:flex-none lg:px-2.5 ${
                    isActive
                      ? activeClass
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  <Icon size={13} className="hidden shrink-0 sm:block" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3 — KPI stats (left) + Action buttons (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        {/* KPI stats */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            Total <span className="font-bold text-slate-900">{stats.approved + stats.pending + stats.rejected}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Approved <span className="font-bold">{stats.approved}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200/60 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            Pending <span className="font-bold">{stats.pending}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200/60 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
            Rejected <span className="font-bold">{stats.rejected}</span>
          </span>
        </div>

        {/* Action buttons — trips/shop list conventions */}
        <div className="flex max-w-full flex-wrap items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="group relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-300"
            aria-label="Reset filters"
          >
            <span className="inline-flex group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={14} /></span>
            Reset
            <ActionTooltip label="Reset filters" />
          </button>

          <BrandRefreshButton loading={loading} onClick={onRefresh} size="lg" ariaLabel="Refresh leave data">
            Refresh
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
            {showForm ? 'Hide Form' : 'New Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(LeaveFilters);
