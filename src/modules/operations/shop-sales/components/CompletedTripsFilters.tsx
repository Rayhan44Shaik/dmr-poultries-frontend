import { Search, FileText, FileSpreadsheet } from "lucide-react";
import Select from "react-select";

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
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500 block mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          />
        </div>
        <div className="md:col-span-3">
          <label className="text-xs font-medium text-slate-500 block mb-1">Vehicle</label>
          <Select
            options={vehicleList.map((item) => ({ value: item, label: item }))}
            value={vehicle ? { value: vehicle, label: vehicle } : null}
            onChange={(selected) => setVehicle(selected ? selected.value : "")}
            isSearchable
            placeholder="All Vehicles"
            styles={selectStyles}
          />
        </div>
        <div className="md:col-span-3">
          <label className="text-xs font-medium text-slate-500 block mb-1">Supervisor</label>
          <Select
            options={supervisorList.map((item) => ({ value: item, label: item }))}
            value={supervisor ? { value: supervisor, label: supervisor } : null}
            onChange={(selected) => setSupervisor(selected ? selected.value : "")}
            isSearchable
            placeholder="All Supervisors"
            styles={selectStyles}
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500 block mb-1">Trip No</label>
          <input
            value={tripNo}
            onChange={(e) => setTripNo(e.target.value)}
            placeholder="Enter Trip Number..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex items-center justify-between flex-nowrap gap-4">
        <div className="text-sm text-slate-600 whitespace-nowrap">
          Pending Trips : <span className="font-bold text-orange-600">{pendingTrips}</span>
        </div>
        <div className="flex items-center gap-3 flex-nowrap">
          <button
            onClick={onSearch}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap active:scale-95"
          >
            <Search size={16} />
            Search
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all whitespace-nowrap active:scale-95"
          >
            Reset
          </button>
          <button
            onClick={onExportPDF}
            disabled={!enableExports}
            className={`px-4 py-2 rounded-lg border border-red-500 text-red-600 text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              enableExports ? "hover:bg-red-50" : "opacity-50 cursor-not-allowed"
            }`}
          >
            <FileText size={16} />
            PDF
          </button>
          <button
            onClick={onExportExcel}
            disabled={!enableExports}
            className={`px-4 py-2 rounded-lg border border-green-500 text-green-600 text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              enableExports ? "hover:bg-green-50" : "opacity-50 cursor-not-allowed"
            }`}
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>
        </div>
      </div>
    </div>
  );
}