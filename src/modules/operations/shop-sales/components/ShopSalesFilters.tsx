import React, { useMemo } from "react";
import { AlertTriangle, ArrowUpDown, Calendar, Search, Store } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
} from "../../../../shared/ui/operationsStyles";
import { BrandRefreshButton, FilterResetButton, countActiveFilters } from "../../../../ui";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";
import { cleanDeliveryShopName } from "../../vehicle-trips/utils/shopDisplayName";
import { useI18n } from "../../../../i18n";

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
  onReset: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  /** One active trip-level reassignment notice, if an allocation is incomplete. */
  unassignedBirds?: number | null;
  assignmentTripNo?: string | null;
}

/**
 * Shop Sales uses the same two-row filter treatment as Trip List: field labels
 * always have a meaningful icon, while reset/refresh retain the shared action
 * animations. Values remain raw IDs/names so filtering is unaffected.
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
  onReset,
  onRefresh,
  refreshing = false,
  unassignedBirds = null,
  assignmentTripNo = null,
}: Props) {
  const { t } = useI18n();
  const assignmentCount = Number(unassignedBirds);
  const hasAssignmentNotice = Number.isSafeInteger(assignmentCount) && assignmentCount > 0 && Boolean(assignmentTripNo);
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
      { value: "sale_asc", label: "Shop Sale No. A–Z" },
      { value: "sale_desc", label: "Shop Sale No. Z–A" },
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
              placeholder="Search trip no., shop name, sale no. or remark"
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>

        {hasAssignmentNotice && (
          <div className="flex min-w-0 items-center lg:col-span-3">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 whitespace-nowrap">
              <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
              {t("ops.shop_sales.unassigned_for_trip", { count: assignmentCount, trip: assignmentTripNo ?? "" })}
            </span>
          </div>
        )}

        <div className={`flex flex-wrap items-center justify-end gap-2 ${hasAssignmentNotice ? "lg:col-span-4" : "lg:col-span-7"}`}>
          <FilterResetButton
            count={countActiveFilters(
              searchQuery.trim() !== "",
              shopName !== "",
              sortBy !== "latest",
              fromDate !== "" || toDate !== "",
            )}
            onClick={onReset}
          />
          <BrandRefreshButton onClick={onRefresh} loading={refreshing} ariaLabel="Refresh shop sales">
            Refresh
          </BrandRefreshButton>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ShopSalesFilters);
