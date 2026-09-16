import React from "react";
import { FileText, FileSpreadsheet, Search, Eye, Calendar, Truck, UserCog, Warehouse, RotateCcw, ArrowUpDown } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
  opsViewButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";
import { BrandRefreshButton } from "../../../../ui";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";
import type { TripSortKey } from "./TripMasterTable";
import { localizeTripViewText } from "../utils/tripViewLocalization";

interface Props {
  fromDate: string;
  toDate: string;
  vehicle: string;
  supervisor: string;
  farm: string;
  sortBy: TripSortKey | null;
  sortDir: "asc" | "desc";
  search: string;
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
  setVehicle: (v: string) => void;
  setSupervisor: (v: string) => void;
  setFarm: (v: string) => void;
  setSort: (sortBy: TripSortKey | null, sortDir: "asc" | "desc") => void;
  setSearch: (v: string) => void;
  onReset: () => void;
  vehicles?: readonly (string | MasterDropdownOption)[];
  supervisors?: readonly (string | MasterDropdownOption)[];
  farms?: readonly (string | MasterDropdownOption)[];
  onExportPDF?: () => void;
  onRefresh?: () => void;
  onExportExcel?: () => void;
  onViewSelected?: () => void;
  showViewButton?: boolean;
  hasFilters?: boolean;
  viewButtonRef?: React.Ref<HTMLButtonElement>;
  totalCount?: number;
}

function TripFilters({
  fromDate,
  toDate,
  vehicle,
  supervisor,
  farm,
  sortBy,
  sortDir,
  search,
  setFromDate,
  setToDate,
  setVehicle,
  setSupervisor,
  setFarm,
  setSort,
  setSearch,
  onReset,
  vehicles = [],
  supervisors = [],
  farms = [],
  onExportPDF,
  onRefresh,
  onExportExcel,
  onViewSelected,
  showViewButton = false,
  hasFilters = false,
  viewButtonRef,
}: Props) {
  const { t, language } = useI18n();
  // Option lists may be either legacy strings or id-backed dropdown options.
  // The "All ..." sentinels are represented as an empty value so the dropdown
  // shows its placeholder and the clear affordance behaves correctly.
  const withoutSentinel = (
    options: readonly (string | MasterDropdownOption)[],
    sentinel: string
  ) => options.filter((option) => (typeof option === "string" ? option !== sentinel : option.value !== sentinel));
  const localizeOptions = (options: readonly (string | MasterDropdownOption)[]) => options.map((option) => {
    const raw = typeof option === "string" ? option : option.label;
    return typeof option === "string"
      ? { value: option, label: localizeTripViewText(raw, language), searchText: raw }
      : { ...option, label: localizeTripViewText(raw, language), searchText: option.searchText || raw };
  });
  const vehicleOptions = localizeOptions(withoutSentinel(vehicles || [], "All Vehicles"));
  const supervisorOptions = localizeOptions(withoutSentinel(supervisors || [], "All Supervisors"));
  const farmOptions = localizeOptions(withoutSentinel(farms || [], "All Sources"));
  // Field name + direction, both translated: the whole option list is built
  // from dictionary keys, so a Telugu session never reads "Weight (kg) —
  // Low to high" in English. "A to Z" keeps its Latin letters on purpose —
  // in Telugu it reads the same and stays an ordering symbol, not prose.
  const sortOptions: MasterDropdownOption[] = [
    { value: "tripNo:asc", label: `${t("operations.trip_no")} — ${t("ops.trip.sort_az")}` },
    { value: "tripNo:desc", label: `${t("operations.trip_no")} — ${t("ops.trip.sort_za")}` },
    { value: "tripDate:asc", label: `${t("ops.trip.day")} — ${t("ops.trip.sort_oldest_first")}` },
    { value: "tripDate:desc", label: `${t("ops.trip.day")} — ${t("ops.trip.sort_latest_first")}` },
    { value: "vehicleNo:asc", label: `${t("common.vehicle")} — ${t("ops.trip.sort_az")}` },
    { value: "vehicleNo:desc", label: `${t("common.vehicle")} — ${t("ops.trip.sort_za")}` },
    { value: "driverName:asc", label: `${t("common.driver")} — ${t("ops.trip.sort_az")}` },
    { value: "driverName:desc", label: `${t("common.driver")} — ${t("ops.trip.sort_za")}` },
    { value: "supervisorName:asc", label: `${t("common.supervisor")} — ${t("ops.trip.sort_az")}` },
    { value: "supervisorName:desc", label: `${t("common.supervisor")} — ${t("ops.trip.sort_za")}` },
    { value: "sourceFarm:asc", label: `${t("ops.trip.source_farm")} — ${t("ops.trip.sort_az")}` },
    { value: "sourceFarm:desc", label: `${t("ops.trip.source_farm")} — ${t("ops.trip.sort_za")}` },
    { value: "totalShops:asc", label: `${t("ops.trip.shops")} — ${t("ops.trip.sort_low_high")}` },
    { value: "totalShops:desc", label: `${t("ops.trip.shops")} — ${t("ops.trip.sort_high_low")}` },
    { value: "totalBirds:asc", label: `${t("common.birds")} — ${t("ops.trip.sort_low_high")}` },
    { value: "totalBirds:desc", label: `${t("common.birds")} — ${t("ops.trip.sort_high_low")}` },
    { value: "totalWeight:asc", label: `${t("ops.trip.weight_kg")} — ${t("ops.trip.sort_low_high")}` },
    { value: "totalWeight:desc", label: `${t("ops.trip.weight_kg")} — ${t("ops.trip.sort_high_low")}` },
    { value: "totalMortality:asc", label: `${t("operations.mortality_count")} — ${t("ops.trip.sort_low_high")}` },
    { value: "totalMortality:desc", label: `${t("operations.mortality_count")} — ${t("ops.trip.sort_high_low")}` },
  ];
  const sortValue = sortBy ? `${sortBy}:${sortDir}` : "";
  const setSortValue = (value: string) => {
    if (!value) {
      setSort(null, "asc");
      return;
    }
    const [key, direction] = value.split(":");
    const selected = sortOptions.some((option) => option.value === value);
    if (!selected) return;
    setSort(key as TripSortKey, direction === "desc" ? "desc" : "asc");
  };

  return (
    <div className={opsFilterCardClass}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
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
            <Truck size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("common.vehicle")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.vehicle")}
            value={vehicle === "All Vehicles" ? "" : vehicle}
            options={vehicleOptions}
            onChange={(next) => setVehicle(next || "All Vehicles")}
            placeholder={t("ops.trip.all_vehicles")}
            searchable
            allowClear
            className="w-full"
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
            value={supervisor === "All Supervisors" ? "" : supervisor}
            options={supervisorOptions}
            onChange={(next) => setSupervisor(next || "All Supervisors")}
            placeholder={t("ops.trip.all_supervisors")}
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Warehouse size={17} className="text-amber-500 flex-shrink-0" />
            <span>{t("ops.trip.source_farm")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("ops.trip.source_farm")}
            value={farm === "All Sources" ? "" : farm}
            options={farmOptions}
            onChange={(next) => setFarm(next || "All Sources")}
            placeholder={t("ops.trip.all_sources")}
            searchable
            allowClear
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end pt-1">
        <div className="lg:col-span-3">
          <label className={opsFilterLabelClass}>
            <ArrowUpDown size={17} className="text-violet-500 flex-shrink-0" />
            <span>{t("ops.trip.sort_by")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("ops.trip.sort_by")}
            value={sortValue}
            options={sortOptions}
            onChange={setSortValue}
            placeholder={t("ops.trip.no_sorting")}
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div className="lg:col-span-5">
          <label className={opsFilterLabelClass}>
            <Search size={17} className="text-slate-400 flex-shrink-0" />
            <span>{t("common.search")}</span>
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("ops.trip.search_trips_placeholder")}
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>

        <div className="lg:col-span-4 flex items-center gap-2 justify-end flex-wrap">
          {showViewButton && onViewSelected && (
            <button
              ref={viewButtonRef}
              type="button"
              onClick={onViewSelected}
              className={`group relative ${opsViewButtonClass}`}
              aria-label={t("ops.trip.view_selected")}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-view)]"><Eye size={15} /></span>
              {t("ops.trip.view_selected")}
            </button>
          )}
          <button type="button" onClick={onReset} className={`group relative ${opsSecondaryButtonClass}`} aria-label={t("common.reset")}>
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={14} /></span>
            {t("common.reset")}
          </button>
          {onRefresh && <BrandRefreshButton onClick={onRefresh} />}
          {onExportPDF && (
            <button type="button" onClick={onExportPDF} disabled={!hasFilters} className={`group relative ${opsPdfButtonClass}`} aria-label={t("reports.export_pdf") || "PDF"}>
              <span className={`inline-flex ${hasFilters ? "motion-safe:group-hover:animate-[var(--animate-action-pdf)]" : ""}`}><FileText size={15} /></span>
              PDF
            </button>
          )}
          {onExportExcel && (
            <button type="button" onClick={onExportExcel} disabled={!hasFilters} className={`group relative ${opsExcelButtonClass}`} aria-label={t("reports.export_excel") || "Excel"}>
              <span className={`inline-flex ${hasFilters ? "motion-safe:group-hover:animate-[var(--animate-action-excel)]" : ""}`}><FileSpreadsheet size={15} /></span>
              Excel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripFilters);