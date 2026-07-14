import React from "react";
import Select from "react-select";
import { FileText, FileSpreadsheet, Search, Calendar, Eye } from "lucide-react";

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
  hasFilters?: boolean; // <-- new
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
}: Props) {
  const vehicleOptions = (vehicles || []).map((v) => ({ value: v, label: v }));
  const supervisorOptions = (supervisors || []).map((v) => ({ value: v, label: v }));
  const farmOptions = (farms || []).map((v) => ({ value: v, label: v }));

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderRadius: 8,
      borderColor: "#e2e8f0",
      boxShadow: "none",
      minHeight: 38,
      fontSize: "14px",
      "&:hover": { borderColor: "#94a3b8" },
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#eff6ff" : "white",
      color: isSelected ? "white" : "#1e293b",
    }),
    menu: (base: any) => ({ ...base, zIndex: 50 }),
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500 block mb-1">From Date</label>
          <div className="relative">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
            <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500 block mb-1">To Date</label>
          <div className="relative">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
            <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="md:col-span-3">
          <label className="text-xs font-medium text-slate-500 block mb-1">Vehicle</label>
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
        <div className="md:col-span-3">
          <label className="text-xs font-medium text-slate-500 block mb-1">Supervisor</label>
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
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500 block mb-1">Source Farm</label>
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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-6">
          <label className="text-xs font-medium text-slate-500 block mb-1">Search</label>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Trip No, Vehicle, Supervisor, or Farm..."
              className="w-full rounded-lg border border-slate-200 px-4 py-2 pl-10 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
        </div>
        <div className="md:col-span-6 flex items-center gap-2 justify-end flex-wrap">
          {/* View Selected – appears first when visible */}
          {showViewButton && onViewSelected && (
            <button
              onClick={onViewSelected}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all shadow-sm flex items-center gap-1.5"
            >
              <Eye size={16} />
              View Selected
            </button>
          )}
          {/* Search */}
          <button
            onClick={onSearch}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all shadow-sm flex items-center gap-1.5"
          >
            <Search size={16} />
            Search
          </button>
          {/* Reset */}
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all"
          >
            Reset
          </button>
          {/* PDF – disabled when no filters */}
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              disabled={!hasFilters}
              className={`px-4 py-2 rounded-lg border border-red-500 text-red-600 text-sm font-medium transition-all flex items-center gap-1.5 ${
                !hasFilters
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-red-50"
              }`}
            >
              <FileText size={16} />
              PDF
            </button>
          )}
          {/* Excel – disabled when no filters */}
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              disabled={!hasFilters}
              className={`px-4 py-2 rounded-lg border border-green-500 text-green-600 text-sm font-medium transition-all flex items-center gap-1.5 ${
                !hasFilters
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-green-50"
              }`}
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripFilters);