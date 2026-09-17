import React, { useId } from "react";
import {
  ArrowUpDown,
  Calendar,
  Percent,
  Search,
  Store,
} from "lucide-react";
import { DatePicker } from "../../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
} from "../../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../../i18n";
import { BrandRefreshButton, FilterResetButton, countActiveFilters } from "../../../../../ui";
import { weekRange } from "../../../../../utils/businessDate";
import MasterDropdown, {
  type MasterDropdownOption,
} from "../../../../masters/components/MasterDropdown";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";
import type { PendingShopSortDir, PendingShopSortKey } from "../../types/collection";

/** The default window is THIS week (Mon → Sun); anything else counts as a filter. */
const isDefaultWeek = (fromDate: string, toDate: string) => {
  if (!fromDate && !toDate) return true;
  const { from, to } = weekRange();
  return fromDate === from && toDate === to;
};

interface Props {
  fromDate: string;
  toDate: string;
  shopName: string;
  /** Null means "no column order" — the register's own sequence. */
  sortBy: PendingShopSortKey | null;
  sortDir: PendingShopSortDir;
  shopNames: string[];
  recoveryThreshold: number;
  searchQuery: string;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setShopName: (value: string) => void;
  /** One setter for both halves of the order, exactly like Trip List's filter. */
  setSort: (key: PendingShopSortKey | null, dir: PendingShopSortDir) => void;
  setRecoveryThreshold: (value: number) => void;
  setSearchQuery: (value: string) => void;
  onReset: () => void;
  onRefresh: () => void;
  /** True while a refresh is reading — the brand pill dances, the page stays. */
  refreshing?: boolean;
}

/**
 * Pending Collections filter bar — the Trip List filter bar, field for field.
 *
 * Same card, same 40px control row, same labelled-with-icon header on every
 * control, same two-row rhythm (reference fields on top, Sort By + Search +
 * the action cluster underneath), same animated Reset and brand Refresh. The
 * only field Trip List has that this page does not need is the vehicle /
 * supervisor / farm trio; Recovery % takes their place, on the same grid.
 *
 * The Shop dropdown is the shared MasterDropdown (the control Trip List uses
 * for Vehicle/Supervisor/Farm) instead of the older react-select instance, so
 * the two pages are pixel-identical and the shop list picks up type-ahead
 * search, a clear affordance and Telugu labels via `localizeTripViewText`
 * while still matching on the stored English name.
 */
function PendingCollectionsFilters({
  fromDate,
  toDate,
  shopName,
  sortBy,
  sortDir,
  shopNames,
  recoveryThreshold,
  searchQuery,
  setFromDate,
  setToDate,
  setShopName,
  setSort,
  setRecoveryThreshold,
  setSearchQuery,
  onReset,
  onRefresh,
  refreshing = false,
}: Props) {
  const { t, language } = useI18n();
  const thresholdId = useId();
  const searchId = useId();

  const sortedShopNames = [...shopNames].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "accent", numeric: true })
  );

  // Label in the active language, raw name kept for type-ahead: a Telugu
  // session sees "గాయత్రీ బ్రాయిలర్ మార్ట్" and typing "gayatri" still finds it.
  const shopOptions: MasterDropdownOption[] = sortedShopNames.map((shop) => ({
    value: shop,
    label: localizeTripViewText(shop, language),
    searchText: shop,
  }));

  /**
   * Sort By — every column the table can order by, in `key:dir` form. This is
   * Trip List's list, field for field: the same column-plus-direction labels,
   * the same two options per column, so a header click and a selection here
   * are one and the same order and the two affordances never disagree.
   */
  const sortOptions: MasterDropdownOption[] = [
    { value: "shopName:asc", label: `${t("operations.shop_name")} — ${t("ops.collection.sort_az")}` },
    { value: "shopName:desc", label: `${t("operations.shop_name")} — ${t("ops.collection.sort_za")}` },
    { value: "balance:desc", label: `${t("common.balance")} — ${t("ops.collection.sort_high_low")}` },
    { value: "balance:asc", label: `${t("common.balance")} — ${t("ops.collection.sort_low_high")}` },
    { value: "weeklySales:desc", label: `${t("operations.recent_sales")} — ${t("ops.collection.sort_high_low")}` },
    { value: "weeklySales:asc", label: `${t("operations.recent_sales")} — ${t("ops.collection.sort_low_high")}` },
    { value: "weeklyApprovedCollections:desc", label: `${t("operations.recent_collections")} — ${t("ops.collection.sort_high_low")}` },
    { value: "weeklyApprovedCollections:asc", label: `${t("operations.recent_collections")} — ${t("ops.collection.sort_low_high")}` },
    { value: "recoveryPercentage:desc", label: `${t("ops.collection.recovery_pct")} — ${t("ops.collection.sort_high_low")}` },
    { value: "recoveryPercentage:asc", label: `${t("ops.collection.recovery_pct")} — ${t("ops.collection.sort_low_high")}` },
    { value: "lastCollectionDate:desc", label: `${t("ops.collection.last_collection")} — ${t("ops.collection.sort_latest_first")}` },
    { value: "lastCollectionDate:asc", label: `${t("ops.collection.last_collection")} — ${t("ops.collection.sort_oldest_first")}` },
    { value: "overdueDays:desc", label: `${t("ops.collection.overdue")} — ${t("ops.collection.sort_overdue_days")}` },
    { value: "overdueDays:asc", label: `${t("ops.collection.overdue")} — ${t("ops.collection.sort_least_overdue")}` },
  ];
  // `""` when no column order is active: the control reads its label, the
  // table keeps the register sequence — Trip List behaves the same way.
  const sortValue = sortBy ? `${sortBy}:${sortDir}` : "";
  const setSortValue = (value: string) => {
    if (!value) {
      setSort(null, "asc");
      return;
    }
    const match = sortOptions.find((option) => option.value === value);
    if (!match) return;
    const [key, direction] = value.split(":");
    setSort(key as PendingShopSortKey, direction === "desc" ? "desc" : "asc");
  };

  return (
    <div className={opsFilterCardClass}>
      {/* Row 1 — the reference fields, on one grid line: From | To | Shop | Recovery % */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("common.from")}</span>
          </label>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder={t("placeholder.enter_date")}
            className="w-full text-xs font-medium"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("common.to")}</span>
          </label>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder={t("placeholder.enter_date")}
            className="w-full text-xs font-medium"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Store size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("operations.shop_name")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("operations.shop_name")}
            value={shopName}
            options={shopOptions}
            onChange={setShopName}
            placeholder={t("ops.collection.all_shops")}
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass} htmlFor={thresholdId}>
            <Percent size={17} className="text-amber-500 flex-shrink-0" />
            <span>{t("ops.collection.recovery_pct")}</span>
            <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700">
              {recoveryThreshold}%
            </span>
          </label>
          {/* Same 40px control box as every input beside it, so the slider sits
              on the same grid line instead of floating against the label. */}
          <div className="flex h-10 w-full items-center rounded-lg border border-slate-300 bg-white px-3">
            <input
              id={thresholdId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={recoveryThreshold}
              aria-valuetext={`${recoveryThreshold}%`}
              onChange={(e) => setRecoveryThreshold(Number(e.target.value))}
              className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Row 2 — Sort By | Search | Reset + Refresh, exactly as Trip List lays them out */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end pt-1">
        <div className="lg:col-span-3">
          <label className={opsFilterLabelClass}>
            <ArrowUpDown size={17} className="text-violet-500 flex-shrink-0" />
            <span>{t("ops.collection.sort_by")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("ops.collection.sort_by")}
            value={sortValue}
            options={sortOptions}
            onChange={setSortValue}
            searchable
            className="w-full"
          />
        </div>

        <div className="lg:col-span-5">
          <label className={opsFilterLabelClass} htmlFor={searchId}>
            <Search size={17} className="text-slate-400 flex-shrink-0" />
            <span>{t("common.search")}</span>
          </label>
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id={searchId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("ops.collection.search_shop_placeholder")}
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-wrap items-center justify-end gap-2">
          <FilterResetButton
            count={countActiveFilters(
              searchQuery.trim() !== "",
              shopName !== "",
              recoveryThreshold !== 0,
              !(sortBy === "shopName" && sortDir === "asc"),
              !isDefaultWeek(fromDate, toDate),
            )}
            onClick={onReset}
          />
          <BrandRefreshButton onClick={onRefresh} loading={refreshing} />
        </div>
      </div>
    </div>
  );
}

export default React.memo(PendingCollectionsFilters);
