import React from "react";
import {
  FileText,
  FileSpreadsheet,
  Search,
  Calendar,
  Truck,
  User,
  Layers,
  ArrowUpDown,
  Plus,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";
import { BrandRefreshButton, FilterResetButton, countActiveFilters } from "../../../../ui";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";
import type { FuelSortKey } from "../types/fuelExpense";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";

interface Props {
  fromDate: string;
  toDate: string;
  vehicle: string;
  driver: string;
  sourceType: string;
  sortBy: FuelSortKey | null;
  sortDir: "asc" | "desc";
  search: string;
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
  setVehicle: (v: string) => void;
  setDriver: (v: string) => void;
  setSourceType: (v: string) => void;
  setSort: (sortBy: FuelSortKey | null, sortDir: "asc" | "desc") => void;
  setSearch: (v: string) => void;
  onReset: () => void;
  vehicles?: readonly MasterDropdownOption[];
  drivers?: readonly MasterDropdownOption[];
  onAddFuelBill?: () => void;
  isFormOpen?: boolean;
  onExportPDF?: () => void;
  onRefresh?: () => void;
  onExportExcel?: () => void;
  hasFilters?: boolean;
}

function FuelFilters({
  fromDate,
  toDate,
  vehicle,
  driver,
  sourceType,
  sortBy,
  sortDir,
  search,
  setFromDate,
  setToDate,
  setVehicle,
  setDriver,
  setSourceType,
  setSort,
  setSearch,
  onReset,
  vehicles = [],
  drivers = [],
  onAddFuelBill,
  isFormOpen = false,
  onExportPDF,
  onRefresh,
  onExportExcel,
  hasFilters = false,
}: Props) {
  const { t, language } = useI18n();

  const withoutSentinel = (
    options: readonly MasterDropdownOption[],
    sentinel: string
  ) => options.filter((option) => option.value !== sentinel);

  const localizeOptions = (options: readonly MasterDropdownOption[]) =>
    options.map((option) => ({
      ...option,
      label: localizeTripViewText(option.label, language),
      searchText: option.searchText || option.label,
    }));

  const vehicleOptions = localizeOptions(withoutSentinel(vehicles, "All Vehicles"));
  const driverOptions = localizeOptions(withoutSentinel(drivers, "All Drivers"));

  const sourceOptions: MasterDropdownOption[] = [
    { value: "TRIP", label: t("ops.fuel.trip_diesel") },
    { value: "MANUAL", label: t("ops.fuel.manual_bill") },
  ];

  const sortOptions: MasterDropdownOption[] = [
    { value: "billNo:asc", label: `${t("ops.fuel.bill_no")} — ${t("ops.trip.sort_az")}` },
    { value: "billNo:desc", label: `${t("ops.fuel.bill_no")} — ${t("ops.trip.sort_za")}` },
    { value: "date:desc", label: `${t("common.date")} — ${t("ops.trip.sort_latest_first")}` },
    { value: "date:asc", label: `${t("common.date")} — ${t("ops.trip.sort_oldest_first")}` },
    { value: "vehicleNo:asc", label: `${t("common.vehicle")} — ${t("ops.trip.sort_az")}` },
    { value: "vehicleNo:desc", label: `${t("common.vehicle")} — ${t("ops.trip.sort_za")}` },
    { value: "driverName:asc", label: `${t("common.driver")} — ${t("ops.trip.sort_az")}` },
    { value: "driverName:desc", label: `${t("common.driver")} — ${t("ops.trip.sort_za")}` },
    { value: "litres:desc", label: `${t("ops.fuel.litres")} — ${t("ops.trip.sort_high_low")}` },
    { value: "litres:asc", label: `${t("ops.fuel.litres")} — ${t("ops.trip.sort_low_high")}` },
    { value: "rate:desc", label: `${t("ops.fuel.rate_per_l")} — ${t("ops.trip.sort_high_low")}` },
    { value: "rate:asc", label: `${t("ops.fuel.rate_per_l")} — ${t("ops.trip.sort_low_high")}` },
    { value: "amount:desc", label: `${t("ops.fuel.amount_inr")} — ${t("ops.trip.sort_high_low")}` },
    { value: "amount:asc", label: `${t("ops.fuel.amount_inr")} — ${t("ops.trip.sort_low_high")}` },
    { value: "meterReading:desc", label: `${t("ops.fuel.meter_km")} — ${t("ops.trip.sort_high_low")}` },
    { value: "meterReading:asc", label: `${t("ops.fuel.meter_km")} — ${t("ops.trip.sort_low_high")}` },
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
    setSort(key as FuelSortKey, direction === "desc" ? "desc" : "asc");
  };

  return (
    <div className={opsFilterCardClass}>
      {/* ── Top Filters Row: 4 Primary Filters ── */}
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
            <Truck size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("common.vehicle")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.vehicle")}
            value={vehicle === "All Vehicles" ? "" : vehicle}
            options={vehicleOptions}
            onChange={(next) => setVehicle(next || "All Vehicles")}
            placeholder={t("ops.fuel.all_vehicles")}
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <User size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t("common.driver")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.driver")}
            value={driver === "All Drivers" ? "" : driver}
            options={driverOptions}
            onChange={(next) => setDriver(next || "All Drivers")}
            placeholder={t("ops.fuel.all_drivers")}
            searchable
            allowClear
            className="w-full"
          />
        </div>
      </div>

      {/* ── Secondary Row: Source, Sort, Search ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end pt-1">
        <div className="lg:col-span-3">
          <label className={opsFilterLabelClass}>
            <Layers size={17} className="text-indigo-500 flex-shrink-0" />
            <span>{t("ops.fuel.source")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("ops.fuel.source")}
            value={sourceType === "All" ? "" : sourceType}
            options={sourceOptions}
            onChange={(next) => setSourceType(next || "All")}
            placeholder={t("ops.fuel.all_sources")}
            searchable
            allowClear
            className="w-full"
          />
        </div>

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

        <div className="lg:col-span-6">
          <label className={opsFilterLabelClass}>
            <Search size={17} className="text-slate-400 flex-shrink-0" />
            <span>{t("ops.fuel.search_label")}</span>
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("ops.fuel.search_placeholder")}
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>
      </div>

      {/* ── Action Toolbar: Order = Reset, Refresh, Add Fuel Bill, PDF, Excel ── */}
      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 flex-wrap">
        {/* 1. Reset Filters */}
        <FilterResetButton
          count={countActiveFilters(
            search.trim() !== "",
            !/^all\b/i.test(vehicle.trim()) && vehicle !== "",
            !/^all\b/i.test(driver.trim()) && driver !== "",
            !/^all$/i.test(sourceType.trim()) && sourceType !== "",
            fromDate !== "" || toDate !== "",
            sortBy !== null,
          )}
          onClick={onReset}
        />

        {/* 2. Refresh */}
        {onRefresh && <BrandRefreshButton onClick={onRefresh} />}

        {/* 3. Add Fuel Bill */}
        {onAddFuelBill && (
          <button
            type="button"
            onClick={onAddFuelBill}
            className={`group relative ${opsPrimaryButtonClass} active:scale-95 transition-transform duration-150`}
            aria-label={isFormOpen ? t("ops.fuel.hide_form") : t("ops.fuel.add_bill")}
          >
            <span className="inline-flex motion-safe:group-hover:rotate-90 transition-transform duration-200">
              <Plus size={16} />
            </span>
            <span>{isFormOpen ? t("ops.fuel.hide_form") : t("ops.fuel.add_bill")}</span>
          </button>
        )}

        {/* 4. PDF (Enabled only when filter applied) */}
        {onExportPDF && (
          <button
            type="button"
            onClick={onExportPDF}
            disabled={!hasFilters}
            className={`group relative ${opsPdfButtonClass}`}
            aria-label={t("reports.export_pdf") || "PDF"}
            title={!hasFilters ? (language === "te" ? "PDF ఎగుమతి చేయడానికి ఫిల్టర్ వర్తించండి" : "Apply a filter to export PDF") : (language === "te" ? "PDF నివేదిక ఎగుమతి చేయండి" : "Export PDF Report")}
          >
            <span className={`inline-flex ${hasFilters ? "motion-safe:group-hover:animate-[var(--animate-action-pdf)]" : ""}`}>
              <FileText size={15} />
            </span>
            <span>PDF</span>
          </button>
        )}

        {/* 5. Excel (Enabled only when filter applied) */}
        {onExportExcel && (
          <button
            type="button"
            onClick={onExportExcel}
            disabled={!hasFilters}
            className={`group relative ${opsExcelButtonClass}`}
            aria-label={t("reports.export_excel") || "Excel"}
            title={!hasFilters ? (language === "te" ? "Excel ఎగుమతి చేయడానికి ఫిల్టర్ వర్తించండి" : "Apply a filter to export Excel") : (language === "te" ? "Excel నివేదిక ఎగుమతి చేయండి" : "Export Excel Report")}
          >
            <span className={`inline-flex ${hasFilters ? "motion-safe:group-hover:animate-[var(--animate-action-excel)]" : ""}`}>
              <FileSpreadsheet size={15} />
            </span>
            <span>Excel</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default React.memo(FuelFilters);
