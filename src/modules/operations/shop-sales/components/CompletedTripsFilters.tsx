import React from "react";
import { Search, IndianRupee, Calendar, Truck, UserCog } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { useI18n } from "../../../../i18n";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { BrandRefreshButton, FilterResetButton, countActiveFilters } from "../../../../ui";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";
import { displayRateEntryName } from "../utils/rateEntryDisplay";

interface Props {
  fromDate: string;
  toDate: string;
  search: string;
  vehicle: string;
  supervisor: string;
  vehicleList: readonly (string | MasterDropdownOption)[];
  supervisorList: readonly (string | MasterDropdownOption)[];
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setSearch: (value: string) => void;
  setVehicle: (value: string) => void;
  setSupervisor: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  pendingTrips?: number;
  hasFilters?: boolean;
  onRateEntry?: () => void;
  rateEntryEnabled?: boolean;
}

function withoutSentinel(
  options: readonly (string | MasterDropdownOption)[],
  sentinel: string,
): readonly (string | MasterDropdownOption)[] {
  return options.filter((option) => (typeof option === "string" ? option !== sentinel : option.value !== sentinel));
}

function CompletedTripsFilters({
  fromDate,
  toDate,
  search,
  vehicle,
  supervisor,
  vehicleList,
  supervisorList,
  setFromDate,
  setToDate,
  setSearch,
  setVehicle,
  setSupervisor,
  onSearch,
  onReset,
  onRefresh,
  refreshing = false,
  pendingTrips = 0,
  hasFilters = false,
  onRateEntry,
  rateEntryEnabled = false,
}: Props) {
  const { t, language } = useI18n();
  // Exports should be available whenever there is data, not only when filtered
  void hasFilters;
  const localizeOptions = (options: readonly (string | MasterDropdownOption)[]) => options.map((option) => {
    const raw = typeof option === "string" ? option : option.label;
    return typeof option === "string"
      ? { value: option, label: displayRateEntryName(raw, language), searchText: raw }
      : { ...option, label: displayRateEntryName(raw, language), searchText: option.searchText || raw };
  });
  const vehicleOptions = localizeOptions(withoutSentinel(vehicleList || [], "All Vehicles"));
  const supervisorOptions = localizeOptions(withoutSentinel(supervisorList || [], "All Supervisors"));

  return (
    <div className={opsFilterCardClass}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("ops.rate.from_date")}</span>
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
            <span>{t("ops.rate.to_date")}</span>
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
            <Truck size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("common.vehicle")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.vehicle")}
            value={vehicle}
            options={vehicleOptions}
            onChange={setVehicle}
            placeholder={t("ops.trip.all_vehicles")}
            searchable
            allowClear
            className="w-full"
            triggerClassName="h-10 rounded-lg border-slate-300 text-[13px]"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <UserCog size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("common.supervisor")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.supervisor")}
            value={supervisor}
            options={supervisorOptions}
            onChange={setSupervisor}
            placeholder={t("ops.trip.all_supervisors")}
            searchable
            allowClear
            className="w-full"
            triggerClassName="h-10 rounded-lg border-slate-300 text-[13px]"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Search size={17} className="text-slate-400 flex-shrink-0" />
            <span>{t("ops.rate.search_label")}</span>
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onSearch();
              }}
              placeholder={t("ops.rate.search_placeholder")}
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
        <div className="text-[14px] font-bold text-slate-700">
          {t("ops.rate.pending_trips")} : <span className="font-extrabold text-orange-600 text-[16px] tabular-nums">{pendingTrips}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button type="button" onClick={onSearch} className={`group relative ${opsPrimaryButtonClass}`} aria-label={t("ops.rate.search_tooltip")}>
            <span className={`inline-flex ${uiActionIconMotionClass.search}`}><Search size={15} /></span>
            {t("common.search")}
          </button>
          <FilterResetButton
            count={countActiveFilters(
              search.trim() !== "",
              vehicle !== "" && vehicle !== "All Vehicles",
              supervisor !== "" && supervisor !== "All Supervisors",
              fromDate !== "" || toDate !== "",
            )}
            onClick={onReset}
            title={t("ops.rate.reset_tooltip")}
          />
          {onRefresh && (
            <BrandRefreshButton onClick={onRefresh} loading={refreshing} ariaLabel={t("common.refresh")}>
              {t("common.refresh")}
            </BrandRefreshButton>
          )}
          {onRateEntry && (
            <button type="button" onClick={onRateEntry} disabled={!rateEntryEnabled} className={`group relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-semibold h-9 px-3.5 text-[13px] border border-emerald-200 bg-emerald-50 text-emerald-800 shadow-xs transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out hover:bg-emerald-100 active:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none ${rateEntryEnabled ? "shadow-emerald-200/70 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95" : ""}`}>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border transition-all ${rateEntryEnabled ? `border-emerald-200 bg-white/80 text-emerald-700 ${uiActionIconMotionClass.edit}` : "border-slate-200 bg-slate-50 text-slate-400"}`}><IndianRupee size={14} /></span>
              Rate Entry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(CompletedTripsFilters);
