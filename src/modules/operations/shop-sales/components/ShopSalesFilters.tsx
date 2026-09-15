import React, { useMemo } from "react";
import { ArrowUpDown, Calendar, RotateCcw, Search, Store } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { BrandRefreshButton } from "../../../../ui";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";
import { cleanDeliveryShopName } from "../../vehicle-trips/utils/shopDisplayName";

interface Props {
  fromDate: string;
  toDate: string;
  shopName: string;
  sortBy: string;
  shopNames: string[];
  searchQuery: string;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setShopName: (value: string) => void;
  setSortBy: (value: string) => void;
  setSearchQuery: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

/**
 * Shop Sales uses the same two-row filter treatment as Trip List: field labels
 * always have a meaningful icon, while search/reset/refresh retain the shared
 * action animations. Values remain raw IDs/names so filtering is unaffected.
 */
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
  searchQuery,
  setSearchQuery,
  onSearch,
  onReset,
  onRefresh,
  refreshing = false,
}: Props) {
  const shopOptions = useMemo<MasterDropdownOption[]>(() => {
    // Use the clean visible shop name as the filter value too. The client
    // filter intentionally uses contains(), so it still matches a legacy
    // "Shop Name 001" API value without exposing that internal code here.
    const sourceByLabel = new Map<string, string>();
    shopNames.filter(Boolean).forEach((shop) => {
      const label = cleanDeliveryShopName(shop) || shop;
      if (!sourceByLabel.has(label)) sourceByLabel.set(label, shop);
    });
    return Array.from(sourceByLabel, ([label, source]) => ({
      value: label,
      label,
      searchText: source,
    })).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "accent", numeric: true }));
  }, [shopNames]);

  const sortOptions = useMemo<MasterDropdownOption[]>(
    () => [
      { value: "latest", label: "Latest Day" },
      { value: "oldest", label: "Oldest Day" },
      { value: "trip_asc", label: "Trip No. A–Z" },
      { value: "trip_desc", label: "Trip No. Z–A" },
      { value: "shop_asc", label: "Shop Name A–Z" },
      { value: "shop_desc", label: "Shop Name Z–A" },
      { value: "birds_desc", label: "Birds: High to Low" },
      { value: "birds_asc", label: "Birds: Low to High" },
      { value: "weight_desc", label: "Weight: High to Low" },
      { value: "weight_asc", label: "Weight: Low to High" },
      { value: "rate_desc", label: "Rate: High to Low" },
      { value: "rate_asc", label: "Rate: Low to High" },
      { value: "amount_desc", label: "Amount: High to Low" },
      { value: "amount_asc", label: "Amount: Low to High" },
      { value: "remark_asc", label: "Remark A–Z" },
      { value: "remark_desc", label: "Remark Z–A" },
    ],
    [],
  );

  return (
    <div className={opsFilterCardClass}>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="shrink-0 text-emerald-500" />
            <span>From Date</span>
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} placeholder="Select date" className="w-full text-xs font-medium" />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="shrink-0 text-emerald-500" />
            <span>To Date</span>
          </label>
          <DatePicker value={toDate} onChange={setToDate} placeholder="Select date" className="w-full text-xs font-medium" />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Store size={17} className="shrink-0 text-amber-500" />
            <span>Shop Name</span>
          </label>
          <MasterDropdown
            hideLabel
            label="Shop Name"
            value={shopName}
            options={shopOptions}
            onChange={setShopName}
            placeholder="All Shops"
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <ArrowUpDown size={17} className="shrink-0 text-violet-500" />
            <span>Sort By</span>
          </label>
          <MasterDropdown
            hideLabel
            label="Sort By"
            value={sortBy}
            options={sortOptions}
            onChange={(value) => setSortBy(value || "latest")}
            placeholder="Latest Day"
            searchable
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-3.5 pt-1 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <label className={opsFilterLabelClass}>
            <Search size={17} className="shrink-0 text-slate-400" />
            <span>Search</span>
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSearch();
                }
              }}
              placeholder="Search trip no., shop name, sale no. or remark"
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 lg:col-span-7">
          <button type="button" onClick={onSearch} className={`group relative ${opsPrimaryButtonClass}`} aria-label="Search shop sales">
            <span className={`inline-flex ${uiActionIconMotionClass.search}`}><Search size={15} /></span>
            Search
          </button>
          <button type="button" onClick={onReset} className={`group relative ${opsSecondaryButtonClass}`} aria-label="Reset shop sales filters">
            <span className={`inline-flex ${uiActionIconMotionClass.reset}`}><RotateCcw size={14} /></span>
            Reset
          </button>
          <BrandRefreshButton onClick={onRefresh} loading={refreshing} ariaLabel="Refresh shop sales">
            Refresh
          </BrandRefreshButton>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ShopSalesFilters);
