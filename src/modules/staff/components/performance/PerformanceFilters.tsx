// src/modules/staff/components/performance/PerformanceFilters.tsx

import { memo } from 'react';
import { Calendar, RotateCcw, User } from 'lucide-react';

interface PerformanceFiltersProps {
  fromDate: string;
  toDate: string;
  selectedId: number | null;
  availableList: { id: number; name: string }[];
  label: string;
  setFromDate: (val: string) => void;
  setToDate: (val: string) => void;
  setSelectedId: (val: number | null) => void;
  onReset: () => void;
}

function PerformanceFilters({
  fromDate,
  toDate,
  selectedId,
  availableList,
  label,
  setFromDate,
  setToDate,
  setSelectedId,
  onReset,
}: PerformanceFiltersProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        {/* From Date */}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
          <div className="relative">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        {/* To Date */}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
          <div className="relative">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        {/* Select Dropdown */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Select {label}</label>
          <div className="relative">
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white"
            >
              <option value="">All {label}s</option>
              {availableList.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>
    </div>
  );
}

export default memo(PerformanceFilters);