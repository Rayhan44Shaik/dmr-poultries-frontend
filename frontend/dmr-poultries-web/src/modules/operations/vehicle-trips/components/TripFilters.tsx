import React from "react";
import Select from "react-select";
import { FileText, FileSpreadsheet, Search, Eye, Calendar, Truck, UserCog, Warehouse, RotateCcw } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";

interface Props {
  fromDate: string;
  toDate: string;
  vehicle: string;
  supervisor: string;
  farm: string;
  search: string;
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
  setVehicle: (v: string) => void;
  setSupervisor: (v: string) => void;
  setFarm: (v: string) => void;
  setSearch: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
  vehicles?: string[];
  supervisors?: string[];
  farms?: string[];
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onViewSelected?: () => void;
  showViewButton?: boolean;
  hasFilters?: boolean;
  viewButtonRef?: React.Ref<HTMLButtonElement>;
  totalCount?: number;
}

const containsFilter = (option: any, inputValue: string) => {
  if (!inputValue) return true;
  return option.label.toLowerCase().includes(inputValue.toLowerCase());
};

function TripFilters({
  fromDate,
  toDate,
  vehicle,
  supervisor,
  farm,
  search,
  setFromDate,
  setToDate,
  setVehicle,
  setSupervisor,
  setFarm,
  setSearch,
  onSearch,
  onReset,
  vehicles = [],
  supervisors = [],
  farms = [],
  onExportPDF,
  onExportExcel,
  onViewSelected,
  showViewButton = false,
  hasFilters = false,
  viewButtonRef,
}: Props) {
  const vehicleOptions = (vehicles || []).map((v) => ({ value: v, label: v }));
  const supervisorOptions = (supervisors || []).map((v) => ({ value: v, label: v }));
  const farmOptions = (farms || []).map((v) => ({ value: v, label: v }));

  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      borderRadius: "0.75rem",
      borderColor: state.isFocused ? "#3b82f6" : "#e2e8f0",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(59, 130, 246, 0.15)" : "none",
      minHeight: "42px",
      fontSize: "13px",
      fontWeight: 500,
      backgroundColor: "#ffffff",
      "&:hover": { borderColor: "#cbd5e1" },
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#f8fafc" : "transparent",
      color: isSelected ? "#ffffff" : "#334155",
      fontSize: "13px",
      fontWeight: isSelected ? 600 : 500,
      padding: "8px 12px",
      cursor: "pointer",
    }),
    menu: (base: any) => ({
      ...base,
      borderRadius: "0.75rem",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      border: "1px solid #e2e8f0",
      overflow: "hidden",
      zIndex: 50,
    }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base: any) => ({
      ...base,
      color: "#94a3b8",
      "&:hover": { color: "#64748b" },
    }),
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Calendar size={13} className="text-blue-500 flex-shrink-0" />
            <span>From Date</span>
          </label>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder="Select date"
            className="w-full text-xs font-medium"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Calendar size={13} className="text-blue-500 flex-shrink-0" />
            <span>To Date</span>
          </label>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="Select date"
            className="w-full text-xs font-medium"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Truck size={13} className="text-indigo-500 flex-shrink-0" />
            <span>Vehicle</span>
          </label>
          <Select
            options={vehicleOptions}
            value={vehicleOptions.find((x) => x.value === vehicle)}
            onChange={(e) => setVehicle(e?.value || "All Vehicles")}
            isSearchable
            filterOption={containsFilter}
            placeholder="All Vehicles"
            styles={selectStyles}
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <UserCog size={13} className="text-purple-500 flex-shrink-0" />
            <span>Supervisor</span>
          </label>
          <Select
            options={supervisorOptions}
            value={supervisorOptions.find((x) => x.value === supervisor)}
            onChange={(e) => setSupervisor(e?.value || "All Supervisors")}
            isSearchable
            filterOption={containsFilter}
            placeholder="All Supervisors"
            styles={selectStyles}
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Warehouse size={13} className="text-amber-500 flex-shrink-0" />
            <span>Source Farm</span>
          </label>
          <Select
            options={farmOptions}
            value={farmOptions.find((x) => x.value === farm)}
            onChange={(e) => setFarm(e?.value || "All Sources")}
            isSearchable
            filterOption={containsFilter}
            placeholder="All Sources"
            styles={selectStyles}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end pt-1">
        <div className="lg:col-span-5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <span>Search</span>
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Trip No, Vehicle, Supervisor, or Farm..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pl-10 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
            />
          </div>
        </div>

        <div className="lg:col-span-7 flex items-center gap-2 justify-end flex-wrap">
          {showViewButton && onViewSelected && (
            <button
              ref={viewButtonRef}
              onClick={onViewSelected}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Eye size={15} />
              View Selected
            </button>
          )}
          <button
            onClick={onSearch}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Search size={15} />
            Search
          </button>
          <button
            onClick={onReset}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <RotateCcw size={14} className="text-slate-400" />
            Reset
          </button>
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              disabled={!hasFilters}
              className={`px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                !hasFilters
                  ? "opacity-40 cursor-not-allowed bg-slate-50/50"
                  : "hover:bg-rose-50"
              }`}
            >
              <FileText size={15} />
              PDF
            </button>
          )}
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              disabled={!hasFilters}
              className={`px-3.5 py-2.5 rounded-xl border border-emerald-200 text-emerald-600 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                !hasFilters
                  ? "opacity-40 cursor-not-allowed bg-slate-50/50"
                  : "hover:bg-emerald-50"
              }`}
            >
              <FileSpreadsheet size={15} />
              Excel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripFilters);