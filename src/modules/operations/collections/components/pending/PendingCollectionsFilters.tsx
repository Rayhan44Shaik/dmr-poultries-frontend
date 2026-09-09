import React from "react";
import Select from "react-select";
import { DatePicker } from "../../../../../components/common/DatePicker";
import { RefreshButton, ResetButton } from "../../../../../ui";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsReactSelectStyles,
} from "../../../../../shared/ui/operationsStyles";
import { uiSearchInputClass } from "../../../../../shared/ui/uiTokens";
import { cn } from "../../../../../utils/cn";
import { useId } from "react";
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
  const thresholdId = useId();
  const searchId = useId();
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
            <label className={opsFilterLabelClass} htmlFor={thresholdId}>
              {t("ops.collection.recovery_pct")}
            </label>
            <div className="relative">
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
              <div className="absolute top-[-20px] right-0 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {recoveryThreshold}%
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <label className={opsFilterLabelClass} htmlFor={searchId}>
              {t("common.search")}
            </label>
            <div className="relative">
              <input
                id={searchId}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("ops.collection.search_shop_placeholder")}
                className={cn(uiSearchInputClass, "pl-10")}
              />
            </div>
          </div>

          <div className="lg:col-span-2 flex items-end gap-1.5">
            <ResetButton onClick={onReset}>{t("common.reset")}</ResetButton>
            <RefreshButton compact ariaLabel={t("common.refresh")} onClick={onRefresh} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(PendingCollectionsFilters);