import React, { useId } from "react";
import {
  ArrowUpDown,
  Calendar,
  Percent,
  RotateCcw,
  Search,
  Store,
} from "lucide-react";
import { DatePicker } from "../../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
} from "../../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../../i18n";
import { BrandRefreshButton } from "../../../../../ui";
import MasterDropdown, {
  type MasterDropdownOption,
} from "../../../../masters/components/MasterDropdown";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";

interface Props {
  fromDate: string;
  toDate: string;
  shopName: string;
  sortBy: string;
  shopNames: string[];
  recoveryThreshold: number;
  searchQuery: string;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setShopName: (value: string) => void;
  setSortBy: (value: string) => void;
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
  shopNames,
  recoveryThreshold,
  searchQuery,
  setFromDate,
  setToDate,
  setShopName,
  setSortBy,
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

  const sortOptions: MasterDropdownOption[] = [
    { value: "alphabeticalAZ", label: t("ops.collection.sort_az") },
    { value: "alphabeticalZA", label: t("ops.collection.sort_za") },
    { value: "highestBalance", label: t("ops.collection.sort_highest_balance") },
    { value: "lowestBalance", label: t("ops.collection.sort_lowest_balance") },
    { value: "latestCollection", label: t("ops.collection.sort_latest_collection") },
    { value: "oldestCollection", label: t("ops.collection.sort_oldest_collection") },
  ];

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
            value={sortBy}
            options={sortOptions}
            onChange={(next) => setSortBy(next || "alphabeticalAZ")}
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
          <button
            type="button"
            onClick={onReset}
            className={`group relative ${opsSecondaryButtonClass}`}
            aria-label={t("common.reset")}
          >
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]">
              <RotateCcw size={14} />
            </span>
            {t("common.reset")}
          </button>
          <BrandRefreshButton onClick={onRefresh} loading={refreshing} />
        </div>
      </div>
    </div>
  );
}

export default React.memo(PendingCollectionsFilters);
