// src/modules/staff/components/duty-planner/DutyPlannerFilters.tsx

import { memo, useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Filter, ChevronDown, X, Search } from 'lucide-react';
import { DatePicker } from '../../../../components/common/DatePicker';

interface DutyPlannerFiltersProps {
  weekStart: string;
  role: string[];
  roles: string[];
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onWeekStartChange: (val: string) => void;
  onRoleChange: (val: string[]) => void;
  onMoveWeek: (direction: -1 | 1) => void;
  onReset: () => void;
}

function DutyPlannerFilters({
  weekStart,
  role,
  roles,
  searchQuery = '',
  onSearchChange,
  onWeekStartChange,
  onRoleChange,
  onMoveWeek,
  onReset,
}: DutyPlannerFiltersProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchQuery || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchValue(searchQuery || '');
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatWeekLabel = (start: string) => {
    if (!start) return '';
    const startDate = new Date(start);
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + 6);
    return `${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  const toggleRole = (roleValue: string) => {
    if (role.includes(roleValue)) {
      onRoleChange(role.filter(r => r !== roleValue));
    } else {
      onRoleChange([...role, roleValue]);
    }
  };

  const removeRole = (roleValue: string) => {
    onRoleChange(role.filter(r => r !== roleValue));
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    if (onSearchChange) {
      onSearchChange(val);
    }
  };

  const handleDateChange = (val: string) => {
    if (!val) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      const year = startOfWeek.getFullYear();
      const month = String(startOfWeek.getMonth() + 1).padStart(2, '0');
      const date = String(startOfWeek.getDate()).padStart(2, '0');
      onWeekStartChange(`${year}-${month}-${date}`);
    } else {
      onWeekStartChange(val);
    }
  };

  return (
    <div className="bg-white rounded-xl w-full">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div className="flex flex-col gap-4 flex-1 w-full xl:max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 min-h-[40px]">
            <div className="relative flex items-center gap-2" ref={dropdownRef}>
              <div className="flex items-center gap-1 text-sm text-slate-500 font-medium">
                <Filter size={16} /><span>Role:</span>
              </div>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-green-200 outline-none bg-white flex items-center gap-2 hover:bg-slate-50 transition shadow-sm"
              >
                {role.length === 0 ? 'Select roles' : `${role.length} selected`}
                <ChevronDown size={16} className="text-slate-400" />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-60 overflow-auto">
                  <div className="p-1.5">
                    {roles.map((r) => (
                      <label key={r} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-md cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={role.includes(r)}
                          onChange={() => toggleRole(r)}
                          className="rounded border-slate-300 text-green-600 focus:ring-green-500 h-4 w-4"
                        />
                        <span className="text-sm text-slate-700">{r}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {role.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 xl:border-l xl:border-slate-200 xl:pl-3 ml-1 xl:ml-0">
                {role.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-full"
                  >
                    {r}
                    <button
                      onClick={() => removeRole(r)}
                      className="hover:bg-green-200 hover:text-green-900 rounded-full p-0.5 transition focus:outline-none"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee name..."
                value={searchValue}
                onChange={handleSearchInput}
                className="h-10 w-full pl-10 pr-4 rounded-lg border border-slate-200 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition bg-white shadow-sm"
              />
            </div>
            <button
              onClick={() => {
                setSearchValue('');
                onReset();
              }}
              className="h-10 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition flex items-center gap-2 bg-white shadow-sm"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full xl:w-auto justify-start xl:justify-end xl:border-l xl:border-slate-200 xl:pl-6 pt-4 xl:pt-0 border-t xl:border-t-0 border-slate-100">
          <button 
            onClick={() => onMoveWeek(-1)} 
            className="p-2 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200 text-slate-600"
            title="Previous Week"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm h-10 relative">
            <DatePicker
              value={weekStart}
              onChange={handleDateChange}
              className="w-[140px] [&_input]:h-full [&_input]:border-none [&_input]:bg-transparent [&_input]:shadow-none [&_input]:rounded-l-lg focus-within:bg-slate-50 transition-colors"
              placement="bottom"
              placeholder="Start Date"
            />
            <div className="hidden sm:flex items-center px-4 text-sm font-medium text-slate-700 whitespace-nowrap border-l border-slate-200 bg-slate-50/50 h-full rounded-r-lg">
              {formatWeekLabel(weekStart)}
            </div>
          </div>

          <button 
            onClick={() => onMoveWeek(1)} 
            className="p-2 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200 text-slate-600"
            title="Next Week"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="mt-4 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
        {role.length === 0 ? 'Showing all roles' : `Filtered by ${role.length} role(s)`}
      </div>
    </div>
  );
}

export default memo(DutyPlannerFilters);