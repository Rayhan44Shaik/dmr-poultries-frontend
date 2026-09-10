// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\accounts\components\farm-payment\FarmerPaymentFilters.tsx

import React from 'react';
import { uiInputClass } from '../../../../shared/ui/uiTokens';
import { DatePicker } from '../../../../components/common/DatePicker';
import { Search, X, Filter, RefreshCw } from 'lucide-react';

interface FarmerPaymentFiltersProps {
  dateFrom: string;
  dateTo: string;
  selectedFarm: string;
  searchQuery: string;
  farms: string[];
  /** A trips reload is in flight — the Refresh button shows its spinner. */
  loading?: boolean;
  onRefresh: () => void;
  onDateFromChange: (val: string) => void;
  onDateToChange: (val: string) => void;
  onFarmChange: (farm: string) => void;
  onSearchChange: (val: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export function FarmerPaymentFilters({
  dateFrom,
  dateTo,
  selectedFarm,
  searchQuery,
  farms,
  loading = false,
  onRefresh,
  onDateFromChange,
  onDateToChange,
  onFarmChange,
  onSearchChange,
  onApply,
  onClear,
}: FarmerPaymentFiltersProps) {
  const [farmSearch, setFarmSearch] = React.useState('');
  const [showFarmDropdown, setShowFarmDropdown] = React.useState(false);
  const farmDropdownRef = React.useRef<HTMLDivElement>(null);
  const farmTriggerRef = React.useRef<HTMLButtonElement>(null);
  const farmSearchRef = React.useRef<HTMLInputElement>(null);
  const farmOptionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const farmLabelId = React.useId();
  const farmListboxId = React.useId();

  const filteredFarms = React.useMemo(() => {
    if (!farmSearch.trim()) return farms;
    return farms.filter((f) => f.toLowerCase().includes(farmSearch.toLowerCase()));
  }, [farms, farmSearch]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (farmDropdownRef.current && !farmDropdownRef.current.contains(e.target as Node)) {
        setShowFarmDropdown(false);
        setFarmSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus the farm search box whenever the dropdown opens.
  React.useEffect(() => {
    if (showFarmDropdown) farmSearchRef.current?.focus();
  }, [showFarmDropdown]);

  const closeFarmDropdown = (restoreFocus = true) => {
    setShowFarmDropdown(false);
    setFarmSearch('');
    if (restoreFocus) farmTriggerRef.current?.focus();
  };

  /** Keyboard navigation inside the farm listbox: Escape closes, arrows move. */
  const handleFarmListKeydown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFarmDropdown();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = farmOptionRefs.current.filter((b): b is HTMLButtonElement => Boolean(b));
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'ArrowDown'
        ? (current + 1) % buttons.length
        : (current - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
      {/* Row 1: Date From, Date To, Farm */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DatePicker
          label="Date From"
          value={dateFrom}
          onChange={onDateFromChange}
          placeholder="From"
          className="w-full"
        />
        <DatePicker
          label="Date To"
          value={dateTo}
          onChange={onDateToChange}
          placeholder="To"
          className="w-full"
        />

        {/* Farm dropdown – searchable, fully keyboard operable */}
        <div>
          <label id={farmLabelId} className="block text-xs font-medium text-slate-600 mb-1">Farm</label>
          <div className="relative" ref={farmDropdownRef}>
            <button
              type="button"
              ref={farmTriggerRef}
              aria-labelledby={farmLabelId}
              aria-haspopup="listbox"
              aria-expanded={showFarmDropdown}
              onClick={() => (showFarmDropdown ? closeFarmDropdown(false) : setShowFarmDropdown(true))}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setShowFarmDropdown(true);
                }
              }}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white flex items-center justify-between cursor-pointer text-sm focus:ring-2 focus:ring-blue-400 outline-none"
            >
              <span className="truncate">{selectedFarm}</span>
              <Search size={16} className="text-slate-400" />
            </button>
            {showFarmDropdown && (
              <div
                role="listbox"
                id={farmListboxId}
                aria-labelledby={farmLabelId}
                onKeyDown={handleFarmListKeydown}
                className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto p-1"
              >
                <input
                  type="text"
                  ref={farmSearchRef}
                  value={farmSearch}
                  onChange={(e) => setFarmSearch(e.target.value)}
                  placeholder="Search farm..."
                  aria-label="Search farm"
                  className={`${uiInputClass} mb-1`}
                  onClick={(e) => e.stopPropagation()}
                />
                {filteredFarms.map((farm, index) => (
                  <button
                    type="button"
                    key={farm}
                    role="option"
                    aria-selected={selectedFarm === farm}
                    ref={(el) => {
                      farmOptionRefs.current[index] = el;
                    }}
                    onClick={() => {
                      onFarmChange(farm);
                      closeFarmDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-blue-50 transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      selectedFarm === farm ? 'bg-blue-100 font-semibold text-blue-700' : ''
                    }`}
                  >
                    {farm}
                  </button>
                ))}
                {filteredFarms.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400" role="status">
                    No farms found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Row 2: Global Search + Apply + Clear */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by Trip No, Vehicle, Farm, Driver, Supervisor..."
              aria-label="Search trips"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onApply}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm whitespace-nowrap"
        >
          <Filter size={14} /> Apply
        </button>
        <button
          onClick={onClear}
          className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition bg-white whitespace-nowrap"
        >
          Clear
        </button>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Reload completed trips from the backend"
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}