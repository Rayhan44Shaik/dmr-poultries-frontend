// src/modules/staff/components/leave/LeaveFilters.tsx

import { memo } from 'react';
import { Search, RotateCcw, CheckCircle2, Clock, XCircle, LayoutGrid } from 'lucide-react';

interface LeaveFiltersProps {
  filter: 'All' | 'Pending' | 'Approved' | 'Rejected';
  search: string;
  onFilterChange: (val: 'All' | 'Pending' | 'Approved' | 'Rejected') => void;
  onSearchChange: (val: string) => void;
  onReset: () => void;
}

function LeaveFilters({ filter, search, onFilterChange, onSearchChange, onReset }: LeaveFiltersProps) {
  const tabs: { label: 'All' | 'Pending' | 'Approved' | 'Rejected'; icon?: React.ReactNode }[] = [
    { label: 'All', icon: <LayoutGrid size={14} /> },
    { label: 'Pending', icon: <Clock size={14} /> },
    { label: 'Approved', icon: <CheckCircle2 size={14} /> },
    { label: 'Rejected', icon: <XCircle size={14} /> },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs transition-all space-y-4">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search Input with Clear Action */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by employee, type, or reason..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50/50 hover:bg-slate-50 transition text-slate-700 placeholder-slate-400 font-medium"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs font-bold text-slate-400 hover:text-slate-600 rounded-md transition bg-slate-200/60"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Modern Interactive Filter Tabs */}
        <div className="flex items-center flex-wrap gap-1.5 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60">
          {tabs.map((tab) => {
            const isActive = filter === tab.label;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => onFilterChange(tab.label)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shadow-2xs ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Reset Button */}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition shadow-2xs"
        >
          <RotateCcw size={14} className="text-slate-400" />
          Reset Filters
        </button>
      </div>
    </div>
  );
}

export default memo(LeaveFilters);