// src/modules/staff/components/leave/LeaveFilters.tsx

import { memo } from 'react';
import { Search, Filter } from 'lucide-react';

interface LeaveFiltersProps {
  filter: 'All' | 'Pending' | 'Approved' | 'Rejected';
  search: string;
  onFilterChange: (val: 'All' | 'Pending' | 'Approved' | 'Rejected') => void;
  onSearchChange: (val: string) => void;
  onReset: () => void;
}

function LeaveFilters({ filter, search, onFilterChange, onSearchChange, onReset }: LeaveFiltersProps) {
  const options = ['All', 'Pending', 'Approved', 'Rejected'];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by employee, type, status..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none bg-slate-50"
          />
        </div>

        {/* Filter dropdown */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as any)}
            className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onReset}
          className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default memo(LeaveFilters);