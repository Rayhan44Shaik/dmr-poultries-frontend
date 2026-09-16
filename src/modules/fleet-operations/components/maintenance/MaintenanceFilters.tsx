import React from "react";
import {
  ArrowUpDown,
  Calendar,
  Eye,
  RotateCcw,
  Search,
  Store,
  Truck,
  User,
  Wrench,
  X,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { useI18n, translateStatus } from "../../../../i18n";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
  opsViewButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { BrandRefreshButton } from "../../../../ui";
import MasterDropdown, {
  type MasterDropdownOption,
} from "../../../masters/components/MasterDropdown";
import { localizeMaintenanceText } from "../../utils/maintenanceLocalization";
import type { MaintenanceSortKey } from "./MaintenanceMasterTable";

const STATUS_OPTIONS = ["Approved", "Pending", "Deleted"] as const;

type Props = {
  fromDate: string;
  toDate: string;
  vehicle: string;
  driver: string;
  maintenanceType: string;
  serviceType: string;
  status: string;
  sortBy: MaintenanceSortKey | null;
  sortDir: "asc" | "desc";
  search: string;
  vehicles: readonly MasterDropdownOption[];
  drivers: readonly MasterDropdownOption[];
  maintenanceTypes: readonly string[];
  serviceTypes: readonly string[];
  resultCount: number;
  loading: boolean;
  showViewButton: boolean;
  viewButtonRef?: React.Ref<HTMLButtonElement>;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setVehicle: (value: string) => void;
  setDriver: (value: string) => void;
  setMaintenanceType: (value: string) => void;
  setServiceType: (value: string) => void;
  setStatus: (value: string) => void;
  setSort: (key: MaintenanceSortKey | null, direction: "asc" | "desc") => void;
  setSearch: (value: string) => void;
  onReset: () => void;
  onRefresh: () => void;
  onViewSelected: () => void;
};

/**
 * Maintenance List's direct-manipulation filters intentionally use the exact
 * Trip List surface: calendar/dropdown labels, one responsive toolbar, a
 * clearable search, reset motion, the branded hen refresh control and a
 * selected-row View action.  Values apply as they change; nothing waits for a
 * second "Search" submit button.
 */
function MaintenanceFilters({
  fromDate,
  toDate,
  vehicle,
  driver,
  maintenanceType,
  serviceType,
  status,
  sortBy,
  sortDir,
  search,
  vehicles,
  drivers,
  maintenanceTypes,
  serviceTypes,
  resultCount,
  loading,
  showViewButton,
  viewButtonRef,
  setFromDate,
  setToDate,
  setVehicle,
  setDriver,
  setMaintenanceType,
  setServiceType,
  setStatus,
  setSort,
  setSearch,
  onReset,
  onRefresh,
  onViewSelected,
}: Props) {
  const { t, language } = useI18n();
  const sortOptions: MasterDropdownOption[] = [
    {
      value: "billNumber:asc",
      label: `${t("fleet.maintenance_table.mnt_no")} — ${t("ops.trip.sort_az")}`,
    },
    {
      value: "billNumber:desc",
      label: `${t("fleet.maintenance_table.mnt_no")} — ${t("ops.trip.sort_za")}`,
    },
    {
      value: "date:desc",
      label: `${t("common.date")} — ${t("ops.trip.sort_latest_first")}`,
    },
    {
      value: "date:asc",
      label: `${t("common.date")} — ${t("ops.trip.sort_oldest_first")}`,
    },
    {
      value: "vehicleNo:asc",
      label: `${t("common.vehicle")} — ${t("ops.trip.sort_az")}`,
    },
    {
      value: "vehicleNo:desc",
      label: `${t("common.vehicle")} — ${t("ops.trip.sort_za")}`,
    },
    {
      value: "driverName:asc",
      label: `${t("common.driver")} — ${t("ops.trip.sort_az")}`,
    },
    {
      value: "driverName:desc",
      label: `${t("common.driver")} — ${t("ops.trip.sort_za")}`,
    },
    {
      value: "maintenanceType:asc",
      label: `${t("operations.maintenance_type")} — ${t("ops.trip.sort_az")}`,
    },
    {
      value: "maintenanceType:desc",
      label: `${t("operations.maintenance_type")} — ${t("ops.trip.sort_za")}`,
    },
    {
      value: "serviceType:asc",
      label: `${t("fleet.maintenance_form.service_type")} — ${t("ops.trip.sort_az")}`,
    },
    {
      value: "serviceType:desc",
      label: `${t("fleet.maintenance_form.service_type")} — ${t("ops.trip.sort_za")}`,
    },
    {
      value: "totalCost:asc",
      label: `${t("fleet.maintenance_history.total_cost")} — ${t("ops.trip.sort_low_high")}`,
    },
    {
      value: "totalCost:desc",
      label: `${t("fleet.maintenance_history.total_cost")} — ${t("ops.trip.sort_high_low")}`,
    },
  ];
  const sortValue = sortBy ? `${sortBy}:${sortDir}` : "";

  const selectSort = (value: string) => {
    if (!value) {
      setSort(null, "asc");
      return;
    }
    const [key, direction] = value.split(":");
    if (!sortOptions.some((option) => option.value === value)) return;
    setSort(key as MaintenanceSortKey, direction === "desc" ? "desc" : "asc");
  };

  const localizedMaintenanceTypes = maintenanceTypes.map((type) => ({
    value: type,
    label: localizeMaintenanceText(type, language),
    searchText: type,
  }));
  const localizedServiceTypes = serviceTypes.map((type) => ({
    value: type,
    label: localizeMaintenanceText(type, language),
    searchText: type,
  }));

  return (
    <section className={opsFilterCardClass} aria-label={t("common.filter")}>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
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
            <Store size={17} className="shrink-0 text-amber-500" />
            <span>{t("fleet.maintenance_form.service_type")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("fleet.maintenance_form.service_type")}
            value={serviceType}
            options={localizedServiceTypes}
            onChange={setServiceType}
            placeholder={t("fleet.maintenance_history.all_service_types")}
            searchable
            allowClear
            className="w-full"
          />
        </div>
        <div>
          <label className={opsFilterLabelClass}>
            <CheckStatusIcon />
            <span>{t("common.status")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.status")}
            value={status}
            options={STATUS_OPTIONS.map((item) => ({
              value: item,
              label: translateStatus(t, item),
            }))}
            onChange={setStatus}
            placeholder={t("fleet.maintenance_history.all_statuses")}
            searchable
            allowClear
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-end gap-3.5 pt-1 lg:grid-cols-12">
        <div className="lg:col-span-3">
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
            allowClear
            className="w-full"
          />
        </div>
        <div className="lg:col-span-5">
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
          <p
            className="mt-1 min-h-4 text-[11px] font-medium text-slate-400"
            aria-live="polite"
          >
            {loading
              ? t("common.loading")
              : `${resultCount.toLocaleString("en-IN")} ${t("common.results")}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 lg:col-span-4">
          {showViewButton ? (
            <button
              ref={viewButtonRef}
              type="button"
              onClick={onViewSelected}
              className={`group relative ${opsViewButtonClass}`}
              aria-label={t("common.view")}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-view)]">
                <Eye size={15} />
              </span>
              {t("common.view")}
            </button>
          ) : null}
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
          <BrandRefreshButton loading={loading} onClick={onRefresh} />
        </div>
      </div>
    </section>
  );
}

function CheckStatusIcon() {
  return (
    <span
      className="inline-flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border-2 border-emerald-500"
      aria-hidden="true"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
    </span>
  );
}

export default React.memo(MaintenanceFilters);
