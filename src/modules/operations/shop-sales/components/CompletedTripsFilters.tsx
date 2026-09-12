import React from "react";
import { Search, FileText, FileSpreadsheet, Calendar, Truck, UserCog, RotateCcw } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { useI18n } from "../../../../i18n";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { BrandRefreshButton } from "../../../../ui";
import { ActionTooltip } from "../../../../ui/ActionTooltip";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";

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
  onExportPDF?: () => void;
  onExportExcel?: () => void;
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
  onExportPDF,
  onExportExcel,
}: Props) {
  const { t } = useI18n();
  const enableExports = hasFilters && pendingTrips > 0;
  const vehicleOptions = withoutSentinel(vehicleList || [], "All Vehicles");
  const supervisorOptions = withoutSentinel(supervisorList || [], "All Supervisors");

  return (
    <div className={opsFilterCardClass}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={13} className="text-emerald-500 flex-shrink-0" />
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
            <Calendar size={13} className="text-emerald-500 flex-shrink-0" />
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
            <Truck size={13} className="text-emerald-500 flex-shrink-0" />
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
            <UserCog size={13} className="text-emerald-500 flex-shrink-0" />
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
            <Search size={13} className="text-slate-400 flex-shrink-0" />
            <span>{t("ops.rate.search_label")}</span>
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("ops.rate.search_placeholder")}
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
        <div className="text-xs font-semibold text-slate-600">
          {t("ops.rate.pending_trips")} : <span className="font-bold text-orange-600">{pendingTrips}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button type="button" onClick={onSearch} className={`group relative ${opsPrimaryButtonClass}`} aria-label={t("ops.rate.search_tooltip")}>
            <span className={`inline-flex ${uiActionIconMotionClass.search}`}><Search size={15} /></span>
            {t("common.search")}
            <ActionTooltip label={t("ops.rate.search_tooltip")} />
          </button>
          <button type="button" onClick={onReset} className={`group relative ${opsSecondaryButtonClass}`} aria-label={t("ops.rate.reset_tooltip")}>
            <span className={`inline-flex ${uiActionIconMotionClass.reset}`}><RotateCcw size={14} /></span>
            {t("common.reset")}
            <ActionTooltip label={t("ops.rate.reset_tooltip")} />
          </button>
          {onRefresh && (
            <BrandRefreshButton onClick={onRefresh} loading={refreshing} ariaLabel={t("common.refresh")}>
              {t("common.refresh")}
            </BrandRefreshButton>
          )}
          {onExportPDF && (
            <button type="button" onClick={onExportPDF} disabled={!enableExports} className={`group relative ${opsPdfButtonClass}`} aria-label={t("ops.rate.export_pdf")}>
              <span className={`inline-flex ${enableExports ? uiActionIconMotionClass.pdf : ""}`}><FileText size={15} /></span>
              PDF
              <ActionTooltip label={t("ops.rate.export_pdf")} />
            </button>
          )}
          {onExportExcel && (
            <button type="button" onClick={onExportExcel} disabled={!enableExports} className={`group relative ${opsExcelButtonClass}`} aria-label={t("ops.rate.export_excel")}>
              <span className={`inline-flex ${enableExports ? uiActionIconMotionClass.excel : ""}`}><FileSpreadsheet size={15} /></span>
              Excel
              <ActionTooltip label={t("ops.rate.export_excel")} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(CompletedTripsFilters);
