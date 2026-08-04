// src/modules/operations/shop-sales/components/ShopSalesFilters.tsx

import React from "react";
import Select from "react-select";
import { Search, FileText, FileSpreadsheet, RotateCcw, Filter } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";

interface Props {
  fromDate: string;
  toDate: string;
  shopName: string;
  sortBy: string;
  shopNames: string[];
  totalEntries: number; // Kept in interface types for backend compatibility, but hidden in UI
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
  setFromDate,
  setToDate,
  setShopName,
  setSortBy,
  onSearch,
  onReset,
  onExportPDF,
  onExportExcel,
  hasFilters,
  totalEntries,
}: Props) {
  // Sort shop names alphabetically in ascending order, handling case-insensitivity safely
  const sortedShopNames = [...shopNames].sort((a, b) => 
    a.localeCompare(b, undefined, { sensitivity: "accent", numeric: true })
  );

  const shopOptions = [
    { value: "", label: "All Shops" },
    ...sortedShopNames.map((shop) => ({ value: shop, label: shop })),
  ];

  const sortOptions = [
    { value: "Latest", label: "Latest Date" },
    { value: "Shop", label: "Shop Name" },
    { value: "Birds", label: "Highest Birds" },
    { value: "Weight", label: "Highest Weight" },
    { value: "Amount", label: "Highest Amount" },
    { value: "Rate", label: "Highest Rate" },
  ];

  // Custom styling matching the table's clean modern inputs
  const selectStyles = {
    control: (base: any, state: { isFocused: boolean }) => ({
      ...base,
      borderRadius: "0.5rem",
      borderColor: state.isFocused ? "#3b82f6" : "#cbd5e1",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(59, 130, 246, 0.15)" : "none",
      minHeight: "38px",
      fontSize: "12px",
      fontWeight: 500,
      backgroundColor: "#ffffff",
      transition: "all 0.2s ease",
      "&:hover": {
        borderColor: "#94a3b8",
      },
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      fontSize: "12px",
      fontWeight: isSelected ? 600 : 500,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#eff6ff" : "white",
      color: isSelected ? "white" : "#334155",
      cursor: "pointer",
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 50,
      borderRadius: "0.5rem",
      overflow: "hidden",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
      border: "1px solid #e2e8f0",
    }),
    placeholder: (base: any) => ({
      ...base,
      color: "#94a3b8",
      fontSize: "12px",
    }),
    singleValue: (base: any) => ({
      ...base,
      color: "#1e293b",
      fontSize: "12px",
      fontWeight: 600,
    }),
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 transition-all">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Filter size={15} />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Filter & Export Controls</h3>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
        {/* From Date */}
        <div className="lg:col-span-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            From Date
          </label>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder="Select date"
            className="w-full text-xs"
          />
        </div>

        {/* To Date */}
        <div className="lg:col-span-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            To Date
          </label>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="Select date"
            className="w-full text-xs"
          />
        </div>

        {/* Shop Name Dropdown */}
        <div className="lg:col-span-4">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Shop Name
          </label>
          <Select
            options={shopOptions}
            value={shopOptions.find((x) => x.value === shopName)}
            onChange={(e) => setShopName(e?.value || "")}
            isSearchable
            placeholder="All Shops"
            styles={selectStyles}
          />
        </div>

        {/* Sort By Dropdown */}
        <div className="lg:col-span-4">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Sort By
          </label>
          <Select
            options={sortOptions}
            value={sortOptions.find((x) => x.value === sortBy)}
            onChange={(e) => setSortBy(e?.value || "Latest")}
            styles={selectStyles}
          />
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 gap-3">
        {/* Left Side: Filter Status/Helper text */}
        <div className="text-xs text-slate-500 font-medium">
          {hasFilters ? (
            <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full font-semibold border border-blue-200/60 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              Filters active
            </span>
          ) : (
            <span>Showing all records</span>
          )}
        </div>

        {/* Right Side: Operations Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Button */}
          <button
            type="button"
            onClick={onSearch}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Search size={14} />
            Search
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={onReset}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <RotateCcw size={13} className="text-slate-400" />
            Reset
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={onExportPDF}
            disabled={!hasFilters || totalEntries === 0}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs ${
              !hasFilters || totalEntries === 0
                ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed opacity-60"
                : "border-red-200 bg-red-50/50 hover:bg-red-100/80 text-red-700 cursor-pointer active:scale-95"
            }`}
          >
            <FileText size={14} className={!hasFilters || totalEntries === 0 ? "text-slate-300" : "text-red-600"} />
            PDF Export
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={onExportExcel}
            disabled={!hasFilters || totalEntries === 0}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs ${
              !hasFilters || totalEntries === 0
                ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed opacity-60"
                : "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/80 text-emerald-700 cursor-pointer active:scale-95"
            }`}
          >
            <FileSpreadsheet size={14} className={!hasFilters || totalEntries === 0 ? "text-slate-300" : "text-emerald-600"} />
            Excel Export
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ShopSalesFilters);