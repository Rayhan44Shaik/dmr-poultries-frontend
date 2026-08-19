// src/modules/operations/shop-sales/components/ShopSalesFilters.tsx

import React from "react";
import Select from "react-select";
import { Search, FileText, FileSpreadsheet, RotateCcw, Filter } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
  opsReactSelectStyles,
} from "../../../../shared/ui/operationsStyles";

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

  const selectStyles = opsReactSelectStyles();
  const exportDisabled = !hasFilters || totalEntries === 0;

  return (
    <div className={opsFilterCardClass}>
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Filter size={15} />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Filter & Export Controls</h3>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
        <div className="lg:col-span-2">
          <label className={opsFilterLabelClass}>From Date</label>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder="Select date"
            className="w-full text-xs"
          />
        </div>

        <div className="lg:col-span-2">
          <label className={opsFilterLabelClass}>To Date</label>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="Select date"
            className="w-full text-xs"
          />
        </div>

        <div className="lg:col-span-4">
          <label className={opsFilterLabelClass}>Shop Name</label>
          <Select
            options={shopOptions}
            value={shopOptions.find((x) => x.value === shopName)}
            onChange={(e) => setShopName(e?.value || "")}
            isSearchable
            placeholder="All Shops"
            styles={selectStyles}
          />
        </div>

        <div className="lg:col-span-4">
          <label className={opsFilterLabelClass}>Sort By</label>
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
        <div className="text-xs text-slate-500 font-medium">
          {hasFilters ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold border border-emerald-200/60 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Filters active
            </span>
          ) : (
            <span>Showing all records</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={onSearch} className={opsPrimaryButtonClass}>
            <Search size={14} />
            Search
          </button>

          <button type="button" onClick={onReset} className={opsSecondaryButtonClass}>
            <RotateCcw size={13} />
            Reset
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

          <button type="button" onClick={onExportPDF} disabled={exportDisabled} className={opsPdfButtonClass}>
            <FileText size={14} />
            PDF Export
          </button>

          <button type="button" onClick={onExportExcel} disabled={exportDisabled} className={opsExcelButtonClass}>
            <FileSpreadsheet size={14} />
            Excel Export
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ShopSalesFilters);