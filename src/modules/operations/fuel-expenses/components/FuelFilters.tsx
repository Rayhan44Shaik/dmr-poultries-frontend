import React from "react";
import {
  FileText,
  FileSpreadsheet,
  Search,
  Eye,
  Calendar,
  Truck,
  User,
  UserCog,
  Layers,
  RotateCcw,
  ArrowUpDown,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
  opsPrimaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
  opsViewButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";
import { BrandRefreshButton } from "../../../../ui";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";
import type { FuelSortKey } from "../types/fuelExpense";

interface Props {
  fromDate: string;
  toDate: string;
  vehicle: string;
  driver: string;
  supervisor: string;
  sourceType: string;
  status: string;
  sortBy: FuelSortKey | null;
  sortDir: "asc" | "desc";
  search: string;
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
  setVehicle: (v: string) => void;
  setDriver: (v: string) => void;
  setSupervisor: (v: string) => void;
  setSourceType: (v: string) => void;
  setStatus: (v: string) => void;
  setSort: (sortBy: FuelSortKey | null, sortDir: "asc" | "desc") => void;
  setSearch: (v: string) => void;
  onReset: () => void;
  vehicles?: readonly MasterDropdownOption[];
  drivers?: readonly MasterDropdownOption[];
  supervisors?: readonly MasterDropdownOption[];
  onAddFuelBill?: () => void;
  isFormOpen?: boolean;
  onExportPDF?: () => void;
  onRefresh?: () => void;
  onExportExcel?: () => void;
  onViewSelected?: () => void;
  showViewButton?: boolean;
  hasFilters?: boolean;
  viewButtonRef?: React.Ref<HTMLButtonElement>;
}

function FuelFilters({
  fromDate,
  toDate,
  vehicle,
  driver,
  supervisor,
  sourceType,
  status,
  sortBy,
  sortDir,
  search,
  setFromDate,
  setToDate,
  setVehicle,
  setDriver,
  setSupervisor,
  setSourceType,
  setStatus,
  setSort,
  setSearch,
  onReset,
  vehicles = [],
  drivers = [],
  supervisors = [],
  onAddFuelBill,
  isFormOpen = false,
  onExportPDF,
  onRefresh,
  onExportExcel,
  onViewSelected,
  showViewButton = false,
  hasFilters = false,
  viewButtonRef,
}: Props) {
  const { t } = useI18n();

  const withoutSentinel = (
    options: readonly MasterDropdownOption[],
    sentinel: string
  ) => options.filter((option) => option.value !== sentinel);

  const vehicleOptions = withoutSentinel(vehicles, "All Vehicles");
  const driverOptions = withoutSentinel(drivers, "All Drivers");
  const supervisorOptions = withoutSentinel(supervisors, "All Supervisors");

  const sourceOptions: MasterDropdownOption[] = [
    { value: "TRIP", label: "TRIP (Trip Diesel)" },
    { value: "MANUAL", label: "MANUAL (Direct Entry)" },
  ];

  const statusOptions: MasterDropdownOption[] = [
    { value: "Pending", label: "Pending Approval" },
    { value: "Approved", label: "Approved" },
    { value: "Rejected", label: "Rejected" },
  ];

  const sortOptions: MasterDropdownOption[] = [
    { value: "billNo:asc", label: `Bill No — A to Z` },
    { value: "billNo:desc", label: `Bill No — Z to A` },
    { value: "date:desc", label: `Date — Newest First` },
    { value: "date:asc", label: `Date — Oldest First` },
    { value: "vehicleNo:asc", label: `${t("common.vehicle")} — A to Z` },
    { value: "vehicleNo:desc", label: `${t("common.vehicle")} — Z to A` },
    { value: "driverName:asc", label: `${t("common.driver")} — A to Z` },
    { value: "driverName:desc", label: `${t("common.driver")} — Z to A` },
    { value: "litres:desc", label: `Litres — High to Low` },
    { value: "litres:asc", label: `Litres — Low to High` },
    { value: "rate:desc", label: `Rate (₹/L) — High to Low` },
    { value: "rate:asc", label: `Rate (₹/L) — Low to High` },
    { value: "amount:desc", label: `Amount (₹) — High to Low` },
    { value: "amount:asc", label: `Amount (₹) — Low to High` },
    { value: "meterReading:desc", label: `Meter (KM) — High to Low` },
    { value: "meterReading:asc", label: `Meter (KM) — Low to High` },
    { value: "status:asc", label: `Status — A to Z` },
    { value: "status:desc", label: `Status — Z to A` },
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
      {/* ── Top Filters Row ── */}
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
            placeholder={t("ops.trip.all_vehicles") || "All Vehicles"}
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
            placeholder="All Drivers"
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <UserCog size={17} className="text-purple-500 flex-shrink-0" />
            <span>{t("common.supervisor")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.supervisor")}
            value={supervisor === "All Supervisors" ? "" : supervisor}
            options={supervisorOptions}
            onChange={(next) => setSupervisor(next || "All Supervisors")}
            placeholder="All Supervisors"
            searchable
            allowClear
            className="w-full"
          />
        </div>
      </div>

      {/* ── Secondary Row: Source, Status, Sort, Search, Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end pt-1">
        <div className="lg:col-span-2">
          <label className={opsFilterLabelClass}>
            <Layers size={17} className="text-indigo-500 flex-shrink-0" />
            <span>Source</span>
          </label>
          <MasterDropdown
            hideLabel
            label="Source"
            value={sourceType === "All" ? "" : sourceType}
            options={sourceOptions}
            onChange={(next) => setSourceType(next || "All")}
            placeholder="All Sources"
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div className="lg:col-span-2">
          <label className={opsFilterLabelClass}>
            <CheckCircle2 size={17} className="text-amber-500 flex-shrink-0" />
            <span>Status</span>
          </label>
          <MasterDropdown
            hideLabel
            label="Status"
            value={status === "All" ? "" : status}
            options={statusOptions}
            onChange={(next) => setStatus(next || "All")}
            placeholder="All Statuses"
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div className="lg:col-span-2">
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
            <span>Search Fuel Bills</span>
          </label>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by Bill No, Trip No, Vehicle, Driver, Petrol Bunk..."
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>
      </div>

      {/* ── Action Toolbar: All on ONE unified line with animations ── */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          {onAddFuelBill && (
            <button
              type="button"
              onClick={onAddFuelBill}
              className={`group relative ${opsPrimaryButtonClass}`}
              aria-label="Add Fuel Bill"
            >
              <span className="inline-flex motion-safe:group-hover:scale-110 transition-transform">
                <Plus size={16} />
              </span>
              <span>{isFormOpen ? "Hide Fuel Form" : "Add Fuel Bill"}</span>
            </button>
          )}

          {showViewButton && onViewSelected && (
            <button
              ref={viewButtonRef}
              type="button"
              onClick={onViewSelected}
              className={`group relative ${opsViewButtonClass}`}
              aria-label={t("ops.trip.view_selected")}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-view)]">
                <Eye size={15} />
              </span>
              <span>{t("ops.trip.view_selected")}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end flex-wrap">
          <button
            type="button"
            onClick={onReset}
            className={`group relative ${opsSecondaryButtonClass}`}
            aria-label={t("common.reset")}
          >
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]">
              <RotateCcw size={14} />
            </span>
            <span>{t("common.reset")}</span>
          </button>

          {onRefresh && <BrandRefreshButton onClick={onRefresh} />}

          {onExportPDF && (
            <button
              type="button"
              onClick={onExportPDF}
              disabled={!hasFilters}
              className={`group relative ${opsPdfButtonClass}`}
              aria-label={t("reports.export_pdf") || "PDF"}
            >
              <span className={`inline-flex ${hasFilters ? "motion-safe:group-hover:animate-[var(--animate-action-pdf)]" : ""}`}>
                <FileText size={15} />
              </span>
              <span>PDF</span>
            </button>
          )}

          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              disabled={!hasFilters}
              className={`group relative ${opsExcelButtonClass}`}
              aria-label={t("reports.export_excel") || "Excel"}
            >
              <span className={`inline-flex ${hasFilters ? "motion-safe:group-hover:animate-[var(--animate-action-excel)]" : ""}`}>
                <FileSpreadsheet size={15} />
              </span>
              <span>Excel</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(FuelFilters);
