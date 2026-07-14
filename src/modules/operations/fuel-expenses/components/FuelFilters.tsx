import { Search, FileText, FileSpreadsheet } from "lucide-react";
import Select from "react-select";

interface Props {
  fromDate: string;
  toDate: string;
  vehicle: string;
  activeVehicles: string[]; // ✅ only active vehicle numbers
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
  setVehicle: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  hasFilters: boolean;
  totalEntries: number;
}

export function FuelFilters({
  fromDate,
  toDate,
  vehicle,
  activeVehicles,
  setFromDate,
  setToDate,
  setVehicle,
  onSearch,
  onReset,
  onExportPDF,
  onExportExcel,
  hasFilters,
  totalEntries,
}: Props) {
  const vehicleOptions = activeVehicles.map((v) => ({ value: v, label: v }));

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderRadius: 8,
      borderColor: "#e2e8f0",
      boxShadow: "none",
      minHeight: 38,
      fontSize: "14px",
      "&:hover": { borderColor: "#94a3b8" },
      "&:focus-within": { borderColor: "#3b82f6", boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.15)" },
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#eff6ff" : "white",
      color: isSelected ? "white" : "#1e293b",
    }),
    menu: (base: any) => ({ ...base, zIndex: 50 }),
    placeholder: (base: any) => ({ ...base, color: "#94a3b8" }),
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500 block mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          />
        </div>
        <div className="md:col-span-3">
          <label className="text-xs font-medium text-slate-500 block mb-1">Vehicle</label>
          <Select
            options={vehicleOptions}
            value={vehicleOptions.find((opt) => opt.value === vehicle) || null}
            onChange={(selected) => setVehicle(selected?.value || "")}
            isSearchable
            placeholder="All Vehicles"
            styles={selectStyles}
            maxMenuHeight={180}
            filterOption={(option, input) =>
              option.label.toLowerCase().startsWith(input.toLowerCase()) ||
              option.label.toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>
        <div className="md:col-span-5 flex items-end gap-2 justify-end">
          <button
            onClick={onSearch}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <Search size={16} /> Search
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg border border-red-500 bg-white text-red-600 text-sm font-medium transition-all hover:bg-red-50 active:scale-95"
          >
            Reset
          </button>
          <button
            onClick={onExportPDF}
            disabled={!hasFilters || totalEntries === 0}
            className={`px-4 py-2 rounded-lg border border-red-500 text-red-600 text-sm font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
              !hasFilters || totalEntries === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-red-50"
            }`}
          >
            <FileText size={16} /> PDF
          </button>
          <button
            onClick={onExportExcel}
            disabled={!hasFilters || totalEntries === 0}
            className={`px-4 py-2 rounded-lg border border-green-500 text-green-600 text-sm font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
              !hasFilters || totalEntries === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-green-50"
            }`}
          >
            <FileSpreadsheet size={16} /> Excel
          </button>
        </div>
      </div>
    </div>
  );
}