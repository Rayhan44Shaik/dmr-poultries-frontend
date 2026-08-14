import { Search, FileText, FileSpreadsheet, Calendar, Truck, UserCog, Hash, RotateCcw } from "lucide-react";
import Select from "react-select";
import { DatePicker } from "../../../../components/common/DatePicker";

interface Props {
  fromDate: string;
  toDate: string;
  tripNo: string;
  vehicle: string;
  supervisor: string;
  vehicleList: string[];
  supervisorList: string[];
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setTripNo: (value: string) => void;
  setVehicle: (value: string) => void;
  setSupervisor: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  pendingTrips?: number;
  hasFilters?: boolean;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
}

export default function CompletedTripsFilters({
  fromDate,
  toDate,
  tripNo,
  vehicle,
  supervisor,
  vehicleList,
  supervisorList,
  setFromDate,
  setToDate,
  setTripNo,
  setVehicle,
  setSupervisor,
  onSearch,
  onReset,
  pendingTrips = 0,
  hasFilters = false,
  onExportPDF,
  onExportExcel,
}: Props) {
  const enableExports = hasFilters && pendingTrips > 0;

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
        {/* From Date */}
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

        {/* To Date */}
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

        {/* Vehicle */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Truck size={13} className="text-indigo-500 flex-shrink-0" />
            <span>Vehicle</span>
          </label>
          <Select
            options={vehicleList.map((item) => ({ value: item, label: item }))}
            value={vehicle ? { value: vehicle, label: vehicle } : null}
            onChange={(selected) => setVehicle(selected ? selected.value : "")}
            isSearchable
            placeholder="All Vehicles"
            styles={selectStyles}
          />
        </div>

        {/* Supervisor */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <UserCog size={13} className="text-purple-500 flex-shrink-0" />
            <span>Supervisor</span>
          </label>
          <Select
            options={supervisorList.map((item) => ({ value: item, label: item }))}
            value={supervisor ? { value: supervisor, label: supervisor } : null}
            onChange={(selected) => setSupervisor(selected ? selected.value : "")}
            isSearchable
            placeholder="All Supervisors"
            styles={selectStyles}
          />
        </div>

        {/* Trip No */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Hash size={13} className="text-slate-400 flex-shrink-0" />
            <span>Trip No</span>
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={tripNo}
              onChange={(e) => setTripNo(e.target.value)}
              placeholder="Trip Number..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 pl-10 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
        <div className="text-xs font-semibold text-slate-600">
          Trips Awaiting Rate : <span className="font-bold text-orange-600">{pendingTrips}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onSearch}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap active:scale-95"
          >
            <Search size={15} />
            Search
          </button>
          <button
            onClick={onReset}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
          >
            <RotateCcw size={14} className="text-slate-400" />
            Reset
          </button>
          <button
            onClick={onExportPDF}
            disabled={!enableExports}
            className={`px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              enableExports ? "hover:bg-rose-50" : "opacity-40 cursor-not-allowed bg-slate-50/50"
            }`}
          >
            <FileText size={15} />
            PDF
          </button>
          <button
            onClick={onExportExcel}
            disabled={!enableExports}
            className={`px-3.5 py-2.5 rounded-xl border border-emerald-200 text-emerald-600 text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              enableExports ? "hover:bg-emerald-50" : "opacity-40 cursor-not-allowed bg-slate-50/50"
            }`}
          >
            <FileSpreadsheet size={15} />
            Excel
          </button>
        </div>
      </div>
    </div>
  );
}