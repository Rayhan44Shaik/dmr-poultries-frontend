import React from "react";
import {
  ArrowUpDown,
  Calendar,
  Search,
  Truck,
  User,
  Wrench,
  X,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { useI18n } from "../../../../i18n";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
} from "../../../../shared/ui/operationsStyles";
import { BrandRefreshButton, FilterResetButton, countActiveFilters } from "../../../../ui";
import MasterDropdown, {
  type MasterDropdownOption,
} from "../../../masters/components/MasterDropdown";
import { localizeMaintenanceText } from "../../utils/maintenanceLocalization";

export type MaintenanceSortKey = "date";

type Props = {
  fromDate: string;
  toDate: string;
  vehicle: string;
  driver: string;
  maintenanceType: string;
  sortBy: MaintenanceSortKey;
  sortDir: "asc" | "desc";
  search: string;
  vehicles: readonly MasterDropdownOption[];
  drivers: readonly MasterDropdownOption[];
  maintenanceTypes: readonly string[];
  loading: boolean;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setVehicle: (value: string) => void;
  setDriver: (value: string) => void;
  setMaintenanceType: (value: string) => void;
  setSort: (key: MaintenanceSortKey, direction: "asc" | "desc") => void;
  setSearch: (value: string) => void;
  onReset: () => void;
  onRefresh: () => void;
};

/**
 * A precise two-row maintenance filter surface: the date range, vehicle and
 * driver share the first row; maintenance type, timeline sort and search share
 * the second; Reset and Refresh form a compact third row. Status, Service Type
 * and record-count clutter are intentionally excluded from this workspace.
 */
function MaintenanceFilters({
  fromDate,
  toDate,
  vehicle,
  driver,
  maintenanceType,
  sortBy,
  sortDir,
  search,
  vehicles,
  drivers,
  maintenanceTypes,
  loading,
  setFromDate,
  setToDate,
  setVehicle,
  setDriver,
  setMaintenanceType,
  setSort,
  setSearch,
  onReset,
  onRefresh,
}: Props) {
  const { t, language } = useI18n();
  const sortOptions: MasterDropdownOption[] = [
    {
      value: "date:desc",
      label: `${t("common.date")} — ${t("ops.trip.sort_latest_first")}`,
    },
    {
      value: "date:asc",
      label: `${t("common.date")} — ${t("ops.trip.sort_oldest_first")}`,
    },
  ];
  const sortValue = `${sortBy}:${sortDir}`;
  const localizedMaintenanceTypes = maintenanceTypes.map((type) => ({
    value: type,
    label: localizeMaintenanceText(type, language),
    searchText: type,
  }));
  const selectSort = (value: string) => {
    if (!sortOptions.some((option) => option.value === value)) return;
    const [, direction] = value.split(":");
    setSort("date", direction === "asc" ? "asc" : "desc");
  };

  return (
    <section className={opsFilterCardClass} aria-label={t("common.filter")}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="shrink-0 text-emerald-500" />
            <span>{t("common.from")}</span>
          </label>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder={t("placeholder.enter_date")}
            language={language}
            maxDate={toDate || undefined}
            className="w-full text-xs font-medium"
          />
        </div>
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="shrink-0 text-emerald-500" />
            <span>{t("common.to")}</span>
          </label>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder={t("placeholder.enter_date")}
            language={language}
            minDate={fromDate || undefined}
            className="w-full text-xs font-medium"
          />
        </div>
        <div>
          <label className={opsFilterLabelClass}>
            <Truck size={17} className="shrink-0 text-emerald-500" />
            <span>{t("common.vehicle")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.vehicle")}
            value={vehicle}
            options={vehicles}
            onChange={setVehicle}
            placeholder={t("fleet.maintenance_history.all_vehicles")}
            searchable
            allowClear
            className="w-full"
          />
        </div>
        <div>
          <label className={opsFilterLabelClass}>
            <User size={17} className="shrink-0 text-emerald-500" />
            <span>{t("common.driver")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.driver")}
            value={driver}
            options={drivers}
            onChange={setDriver}
            placeholder={t("fleet.maintenance_history.all_drivers")}
            searchable
            allowClear
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <label className={opsFilterLabelClass}>
            <Wrench size={17} className="shrink-0 text-violet-500" />
            <span>{t("operations.maintenance_type")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("operations.maintenance_type")}
            value={maintenanceType}
            options={localizedMaintenanceTypes}
            onChange={setMaintenanceType}
            placeholder={t("fleet.maintenance_history.all_maintenance_types")}
            searchable
            allowClear
            className="w-full"
          />
        </div>
        <div>
          <label className={opsFilterLabelClass}>
            <ArrowUpDown size={17} className="shrink-0 text-violet-500" />
            <span>{t("common.sort_by")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.sort_by")}
            value={sortValue}
            options={sortOptions}
            onChange={selectSort}
            placeholder={t("ops.trip.no_sorting")}
            searchable
            className="w-full"
          />
        </div>
        <div>
          <label className={opsFilterLabelClass}>
            <Search size={17} className="shrink-0 text-slate-400" />
            <span>{t("common.search")}</span>
          </label>
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("fleet.maintenance_history.search_placeholder")}
              className={`${opsInputClass} pl-10 pr-10`}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="group absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label={t("fleet.maintenance_table.clear_search")}
                title={t("fleet.maintenance_table.clear_search")}
              >
                <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]">
                  <X size={15} />
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
        <FilterResetButton
          count={countActiveFilters(
            search.trim() !== "",
            vehicle !== "" && vehicle !== "all",
            driver !== "" && driver !== "all",
            maintenanceType !== "" && maintenanceType !== "all",
            fromDate !== "" || toDate !== "",
            !(sortBy === "date" && sortDir === "desc"),
          )}
          onClick={onReset}
        />
        <BrandRefreshButton loading={loading} onClick={onRefresh} />
      </div>
    </section>
  );
}

export default React.memo(MaintenanceFilters);
