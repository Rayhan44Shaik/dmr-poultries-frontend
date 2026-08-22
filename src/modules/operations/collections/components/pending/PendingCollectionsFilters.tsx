import React from "react";
import Select from "react-select";
import { RotateCcw, RefreshCw, Search } from "lucide-react";
import { DatePicker } from "../../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsSecondaryButtonClass,
  opsReactSelectStyles,
  opsIconButtonClass,
} from "../../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../../i18n";

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
  hasFilters: boolean;
}

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
  hasFilters,
}: Props) {
  const { t } = useI18n();
  const sortedShopNames = [...shopNames].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "accent", numeric: true })
  );

  const shopOptions = [
    { value: "", label: t("ops.collection.all_shops") },
    ...sortedShopNames.map((shop) => ({ value: shop, label: shop })),
  ];

  const sortOptions = [
    { value: "alphabeticalAZ", label: t("ops.collection.sort_az") },
    { value: "alphabeticalZA", label: t("ops.collection.sort_za") },
    { value: "highestBalance", label: t("ops.collection.sort_highest_balance") },
    { value: "lowestBalance", label: t("ops.collection.sort_lowest_balance") },
    { value: "latestCollection", label: t("ops.collection.sort_latest_collection") },
    { value: "oldestCollection", label: t("ops.collection.sort_oldest_collection") },
  ];

  const selectStyles = opsReactSelectStyles();

  return (
    <div className={opsFilterCardClass}>
      {/* Row 1: From Date | To Date | Shop Name | Sort By */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
        <div className="lg:col-span-2">
          <label className={opsFilterLabelClass}>{t("common.from")}</label>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder={t("placeholder.enter_date")}
            className="w-full text-xs"
          />
        </div>

        <div className="lg:col-span-2">
          <label className={opsFilterLabelClass}>{t("common.to")}</label>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder={t("placeholder.enter_date")}
            className="w-full text-xs"
          />
        </div>

        <div className="lg:col-span-4">
          <label className={opsFilterLabelClass}>{t("operations.shop_name")}</label>
          <Select
            options={shopOptions}
            value={shopOptions.find((x) => x.value === shopName)}
            onChange={(e) => setShopName(e?.value || "")}
            isSearchable
            placeholder={t("ops.collection.all_shops")}
            styles={selectStyles}
          />
        </div>

        <div className="lg:col-span-4">
          <label className={opsFilterLabelClass}>{t("ops.collection.sort_by")}</label>
          <Select
            options={sortOptions}
            value={sortOptions.find((x) => x.value === sortBy)}
            onChange={(e) => setSortBy(e?.value || "alphabeticalAZ")}
            styles={selectStyles}
          />
        </div>
      </div>

      {/* Row 2: Recovery % | Search input | Reset | Refresh */}
      <div className="pt-2 border-t border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          <div className="lg:col-span-3">
            <label className={opsFilterLabelClass}>{t("ops.collection.recovery_pct")}</label>
            <div className="relative">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={recoveryThreshold}
                onChange={(e) => setRecoveryThreshold(Number(e.target.value))}
                className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600"
              />
              <div className="absolute top-[-20px] right-0 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {recoveryThreshold}%
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <label className={opsFilterLabelClass}>{t("common.search")}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("ops.collection.search_shop_placeholder")}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex items-end gap-1.5">
            <button type="button" onClick={onReset} className={opsSecondaryButtonClass} style={{ minWidth: "90px" }}>
              <RotateCcw size={12} className="mr-1" />
              {t("common.reset")}
            </button>
            <button type="button" onClick={onRefresh} className={opsIconButtonClass} title={t("common.refresh")}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(PendingCollectionsFilters);