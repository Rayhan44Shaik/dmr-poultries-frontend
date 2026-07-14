import { X } from "lucide-react";
import { useShopSearch } from "../../../../../core/hooks/useShopSearch";

// ✅ Define the filter state shape
interface FilterState {
  shopName: string;
  fromDate: string;
  toDate: string;
  sortBy: string;
}

interface PendingFiltersProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void; // <-- Replaced 'any' with proper type
  shops: string[];
  onClose: () => void;
}

export function PendingFilters({
  filters,
  onFilterChange,
  shops,
  onClose,
}: PendingFiltersProps) {
  const shopSearch = useShopSearch(shops, filters.shopName, (value) => {
    onFilterChange({ ...filters, shopName: value });
  });

  const handleDateChange = (field: "fromDate" | "toDate", value: string) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const handleSortChange = (value: string) => {
    onFilterChange({ ...filters, sortBy: value });
  };

  const handleClearAll = () => {
    onFilterChange({
      shopName: "",
      fromDate: "",
      toDate: "",
      sortBy: "highestBalance",
    });
    shopSearch.setQuery(""); // ✅ Now works because the hook exposes setQuery
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 transform overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-in-out">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-800">Filters</h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Body */}
        <div className="flex-1 space-y-6 px-4 py-6">
          {/* Shop Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Shop Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={shopSearch.query}
                onChange={(e) =>
                  shopSearch.handleInputChange(e.target.value)
                }
                onFocus={() => shopSearch.setIsOpen(true)}
                placeholder="Search shop..."
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
              />
              {shopSearch.isOpen && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white py-1 text-sm shadow-lg">
                  {shopSearch.filteredShops.length > 0 ? (
                    shopSearch.filteredShops.map((shop) => (
                      <li
                        key={shop}
                        className="cursor-pointer px-3 py-2 hover:bg-blue-50"
                        onClick={() => shopSearch.handleSelect(shop)}
                      >
                        {shop}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-slate-500">No shops found</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              From Date
            </label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => handleDateChange("fromDate", e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              To Date
            </label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => handleDateChange("toDate", e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {/* Sort By */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Sort By
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="highestBalance">Highest Balance</option>
              <option value="shopName">Shop Name</option>
              <option value="overdueDays">Overdue Days</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-3">
          <button
            onClick={handleClearAll} // ✅ Cleaner handler
            className="w-full rounded-md bg-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}