import Select from "react-select";
import { Search, FileText, FileSpreadsheet } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker"; // adjust path as needed
import { useSafeNotification } from "../../../../hooks/useSafeNotification"; // imported but unused here

interface Props {
  fromDate: string;
  toDate: string;
  shopName: string;
  sortBy: string;
  shopNames: string[];
  totalEntries: number;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setShopName: (value: string) => void;
  setSortBy: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  hasFilters: boolean;
}

function ShopSalesFilters({
  fromDate,
  toDate,
  shopName,
  sortBy,
  shopNames,
  totalEntries,
  setFromDate,
  setToDate,
  setShopName,
  setSortBy,
  onSearch,
  onReset,
  onExportPDF,
  onExportExcel,
  hasFilters,
}: Props) {
  // If you need notifications inside this component, uncomment and use:
  // const { showNotification } = useSafeNotification();

  const shopOptions = [
    { value: "", label: "All Shops" },
    ...shopNames.map((shop) => ({ value: shop, label: shop })),
  ];

  const sortOptions = [
    { value: "Latest", label: "Latest Date" },
    { value: "Shop", label: "Shop Name" },
    { value: "Birds", label: "Highest Birds" },
    { value: "Weight", label: "Highest Weight" },
    { value: "Amount", label: "Highest Amount" },
    { value: "Rate", label: "Highest Rate" },
  ];

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
        {/* From Date – now using DatePicker */}
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500 block mb-1">From Date</label>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder="Select date"
            className="w-full"
          />
        </div>

        {/* To Date – now using DatePicker */}
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500 block mb-1">To Date</label>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="Select date"
            className="w-full"
          />
        </div>

        <div className="md:col-span-4">
          <label className="text-xs font-medium text-slate-500 block mb-1">Shop Name</label>
          <Select
            options={shopOptions}
            value={shopOptions.find((x) => x.value === shopName)}
            onChange={(e) => setShopName(e?.value || "")}
            isSearchable
            placeholder="All Shops"
            styles={selectStyles}
          />
        </div>
        <div className="md:col-span-4">
          <label className="text-xs font-medium text-slate-500 block mb-1">Sort By</label>
          <Select
            options={sortOptions}
            value={sortOptions.find((x) => x.value === sortBy)}
            onChange={(e) => setSortBy(e?.value || "Latest")}
            styles={selectStyles}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-6">
          <div className="text-sm text-slate-600">
            Total Entries : <span className="font-bold text-green-600">{totalEntries}</span>
          </div>
        </div>
        <div className="md:col-span-6 flex items-center gap-2 justify-end flex-wrap">
          <button
            onClick={onSearch}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
          >
            <Search size={16} />
            Search
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-all active:scale-95"
          >
            Reset
          </button>
          <button
            onClick={onExportPDF}
            disabled={!hasFilters || totalEntries === 0}
            className={`px-4 py-2 rounded-lg border border-red-500 text-red-600 text-sm font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
              !hasFilters || totalEntries === 0
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-red-50"
            }`}
          >
            <FileText size={16} />
            PDF
          </button>
          <button
            onClick={onExportExcel}
            disabled={!hasFilters || totalEntries === 0}
            className={`px-4 py-2 rounded-lg border border-green-500 text-green-600 text-sm font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
              !hasFilters || totalEntries === 0
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-green-50"
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

export default ShopSalesFilters;