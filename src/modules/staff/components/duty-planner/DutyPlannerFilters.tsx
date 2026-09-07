// src/modules/staff/components/duty-planner/DutyPlannerFilters.tsx

import { memo, useState, useRef, useEffect, useId, type ReactNode } from 'react';
import { ChevronDown, RotateCcw, Filter, X, Search, FileSpreadsheet, LoaderCircle } from 'lucide-react';

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
  navigation?: ReactNode;
  dateRangeControls?: ReactNode;
  feedback?: ReactNode;
}

function DutyPlannerFilters({
  role,
  roles,
  searchQuery,
  onSearchChange,
  onRoleChange,
  onReset,
  onDownloadExcel,
  canDownloadExcel,
  exporting,
  downloadTitle,
  navigation,
  dateRangeControls,
  feedback,
}: DutyPlannerFiltersProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const roleControlId = useId();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleRole = (value: string) => {
    onRoleChange(role.includes(value) ? role.filter((r) => r !== value) : [...role, value]);
  };

  return (
    <section aria-label="Duty Planner filters" className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      {navigation && <div className="mb-3 border-b border-slate-100 pb-3">{navigation}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex items-center gap-2" ref={dropdownRef}>
          <label htmlFor={roleControlId} className="hidden text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:block">Role</label>
          <button
            id={roleControlId}
            type="button"
            aria-label="Filter employee roles"
            aria-expanded={isDropdownOpen}
            aria-controls={`${roleControlId}-options`}
            onClick={() => setIsDropdownOpen((open) => !open)}
            className="flex h-10 min-w-[160px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:bg-slate-50 focus:ring-2 focus:ring-green-200"
          >
            <span className="flex items-center gap-1.5">
              <Filter size={16} className="text-slate-400" />
              {role.length === 0 ? 'All Roles' : `${role.length} selected`}
            </span>
            <ChevronDown size={16} className="text-slate-400" />
          </button>
          {isDropdownOpen && (
            <div id={`${roleControlId}-options`} className="absolute left-0 top-[calc(100%+8px)] z-30 max-h-60 w-56 overflow-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
              {roles.map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={role.includes(value)}
                    onChange={() => toggleRole(value)}
                    className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-700">{value}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {role.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {role.map((value) => (
              <span key={value} className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 py-1 pl-3 pr-2 text-sm font-medium text-green-700">
                {value}
                <button
                  type="button"
                  aria-label={`Remove ${value} role filter`}
                  onClick={() => onRoleChange(role.filter((r) => r !== value))}
                  className="rounded-full p-0.5 transition hover:bg-green-200 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative w-full min-w-0 sm:w-auto sm:min-w-[180px] sm:max-w-xs sm:flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Search employees"
            placeholder="Search employee name..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>

        {/* Keep these actions together, even when the filter row wraps. */}
        <div role="group" aria-label="Duty Planner actions" className="flex shrink-0 items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={onReset}
            className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button
            type="button"
            onClick={onDownloadExcel}
            disabled={!canDownloadExcel || exporting}
            aria-busy={exporting}
            title={downloadTitle}
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? <LoaderCircle size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            {exporting ? 'Preparing Excel…' : 'Download Excel'}
          </button>
        </div>
      </div>

      {dateRangeControls && <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">{dateRangeControls}</div>}
      {feedback && <div className="mt-3">{feedback}</div>}
    </section>
  );
}

export default memo(DutyPlannerFilters);
