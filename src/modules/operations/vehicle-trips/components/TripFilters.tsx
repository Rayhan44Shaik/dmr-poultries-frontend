import React from "react";
import { FileText, FileSpreadsheet, Search, Eye, Calendar, Truck, UserCog, Warehouse, RotateCcw } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";
import { BrandRefreshButton } from "../../../../ui";
import MasterDropdown from "../../../masters/components/MasterDropdown";

interface Props {
  fromDate: string;
  toDate: string;
  vehicle: string;
  supervisor: string;
  farm: string;
  search: string;
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
  setVehicle: (v: string) => void;
  setSupervisor: (v: string) => void;
  setFarm: (v: string) => void;
  setSearch: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
  vehicles?: string[];
  supervisors?: string[];
  farms?: string[];
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
  search,
  setFromDate,
  setToDate,
  setVehicle,
  setSupervisor,
  setFarm,
  setSearch,
  onSearch,
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
  const { t } = useI18n();
  // Plain string lists; MasterDropdown accepts string[] directly. The
  // "All ..." sentinels are represented as an empty value so the dropdown
  // shows its placeholder and the clear affordance behaves correctly.
  const vehicleOptions = (vehicles || []).filter((v) => v !== "All Vehicles");
  const supervisorOptions = (supervisors || []).filter((v) => v !== "All Supervisors");
  const farmOptions = (farms || []).filter((v) => v !== "All Sources");

  return (
    <div className={opsFilterCardClass}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={13} className="text-emerald-500 flex-shrink-0" />
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
            <Calendar size={13} className="text-emerald-500 flex-shrink-0" />
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
            <Truck size={13} className="text-emerald-500 flex-shrink-0" />
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
            <UserCog size={13} className="text-emerald-500 flex-shrink-0" />
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
            <Warehouse size={13} className="text-emerald-500 flex-shrink-0" />
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
        <div className="lg:col-span-5">
          <label className={opsFilterLabelClass}>
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <span>{t("common.search")}</span>
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("ops.trip.search_trips_placeholder")}
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>

        <div className="lg:col-span-7 flex items-center gap-2 justify-end flex-wrap">
          {showViewButton && onViewSelected && (
            <button
              ref={viewButtonRef}
              onClick={onViewSelected}
              className={opsPrimaryButtonClass}
            >
              <Eye size={15} />
              {t("ops.trip.view_selected")}
            </button>
          )}
          <button onClick={onSearch} className={`group ${opsPrimaryButtonClass}`}>
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-brand-dance)]"><Search size={15} /></span>
            {t("common.search")}
          </button>
          <button onClick={onReset} className={`group ${opsSecondaryButtonClass}`}>
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-brand-dance)]"><RotateCcw size={14} /></span>
            {t("common.reset")}
          </button>
          {onRefresh && <BrandRefreshButton onClick={onRefresh} />}
          {onExportPDF && (
            <button onClick={onExportPDF} disabled={!hasFilters} className={opsPdfButtonClass}>
              <FileText size={15} />
              PDF
            </button>
          )}
          {onExportExcel && (
            <button onClick={onExportExcel} disabled={!hasFilters} className={opsExcelButtonClass}>
              <FileSpreadsheet size={15} />
              Excel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripFilters);