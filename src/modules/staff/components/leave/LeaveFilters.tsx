// src/modules/staff/components/leave/LeaveFilters.tsx

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  LayoutGrid,
  Users,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  Plus,
  RotateCcw,
  Calendar,
} from 'lucide-react';
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

const STATUS_TABS: { label: LeaveFilterState['status']; icon: React.ReactNode }[] = [
  { label: 'All', icon: <LayoutGrid size={13} /> },
  { label: 'Pending', icon: <Clock size={13} /> },
  { label: 'Approved', icon: <CheckCircle2 size={13} /> },
  { label: 'Rejected', icon: <XCircle size={13} /> },
];

const LEAVE_TYPES = ['All', 'Casual', 'Sick', 'Emergency', 'Annual'] as const;

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

/** Month-only picker: shows a grid of month names with year navigation. */
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
    if (value) setViewYear(Number(value.slice(0, 4)));
  }, [value]);

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
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
        <Calendar size={13} className="text-brand-500" /> Month
      </span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-slate-50/50 hover:bg-slate-50 transition text-left flex items-center justify-between text-slate-700 font-medium"
      >
        <span>{displayLabel}</span>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden min-w-[260px]">
          {/* Year navigation */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-slate-800">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
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
                  className={`py-2.5 rounded-lg text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-sm'
                      : isCurrentMonth
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
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

/** Compact searchable dropdown. Max 5 visible items at a time. */
function SearchableDropdown({
  label,
  icon,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const displayLabel = options.find((o) => o.value === value)?.label || placeholder;

  return (
    <div className="relative" ref={ref}>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
        {icon} {label}
      </span>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch('');
        }}
        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-slate-50/50 hover:bg-slate-50 transition text-left flex items-center justify-between text-slate-700 font-medium"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          {options.length > 5 && (
            <div className="p-1.5 border-b border-slate-100">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full h-8 pl-7 pr-7 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-slate-50/50 text-slate-700 placeholder-slate-400"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition ${
                    value === o.value
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...departments.map((d) => ({ value: d, label: d })),
  ];

  const employeeOptions = [
    { value: '', label: 'All Employees' },
    ...employees.map((e) => ({ value: String(e.id), label: e.employeeName })),
  ];

  const leaveTypeOptions = LEAVE_TYPES.map((t) => ({
    value: t,
    label: t === 'All' ? 'All Types' : t,
  }));

  const handleEmployeeChange = useCallback(
    (val: string) => {
      onFilterChange('employeeId', val ? Number(val) : null);
    },
    [onFilterChange]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
      {/* Row 1 — Month, Department, Employee, Leave Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <MonthPicker
            value={filters.month}
            onChange={(val) => onFilterChange('month', val)}
          />
        </div>

        <SearchableDropdown
          label="Department"
          icon={<Users size={13} className="text-brand-500" />}
          value={filters.department}
          options={departmentOptions}
          placeholder="All Departments"
          onChange={(val) => onFilterChange('department', val)}
        />

        <SearchableDropdown
          label="Employee"
          icon={<Users size={13} className="text-brand-500" />}
          value={filters.employeeId ? String(filters.employeeId) : ''}
          options={employeeOptions}
          placeholder="All Employees"
          onChange={handleEmployeeChange}
        />

        <SearchableDropdown
          label="Leave Type"
          icon={<Filter size={13} className="text-brand-500" />}
          value={filters.leaveType}
          options={leaveTypeOptions}
          placeholder="All Types"
          onChange={(val) => onFilterChange('leaveType', val as LeaveFilterState['leaveType'])}
        />
      </div>

      {/* Row 2 — Search + Status (perfect single line) */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          <input
            type="text"
            placeholder="Search employee, leave type, reason..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-slate-50/50 hover:bg-slate-50 transition text-slate-700 placeholder-slate-400 font-medium"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onFilterChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center flex-nowrap shrink-0 gap-0.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 h-10">
          {STATUS_TABS.map((tab) => {
            const isActive = filters.status === tab.label;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => onFilterChange('status', tab.label)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-brand-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3 — KPI stats (left) + Action buttons (right) */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
        {/* KPI stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
            Total <span className="text-slate-900 font-bold">{stats.approved + stats.pending + stats.rejected}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
            Approved <span className="font-bold">{stats.approved}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-xs font-semibold text-amber-700 border border-amber-200/60">
            Pending <span className="font-bold">{stats.pending}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-xs font-semibold text-rose-700 border border-rose-200/60">
            Rejected <span className="font-bold">{stats.rejected}</span>
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 text-sm font-semibold shadow-sm transition active:scale-95"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button
            onClick={onNewRequest}
            className="inline-flex items-center gap-2 h-9 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium shadow-sm transition active:scale-95"
          >
            <Plus size={16} />
            {showForm ? 'Hide Form' : 'New Request'}
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition active:scale-95 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(LeaveFilters);
