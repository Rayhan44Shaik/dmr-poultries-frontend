import React from "react";
import { Search, FileText, FileSpreadsheet, Calendar, Truck, UserCog, Hash, RotateCcw } from "lucide-react";
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
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { BrandRefreshButton } from "../../../../ui";
import { ActionTooltip } from "../../../../ui/ActionTooltip";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";

interface Props {
  fromDate: string;
  toDate: string;
  tripNo: string;
  vehicle: string;
  supervisor: string;
  vehicleList: readonly (string | MasterDropdownOption)[];
  supervisorList: readonly (string | MasterDropdownOption)[];
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  setTripNo: (value: string) => void;
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
  tripNo,
  vehicle,
  supervisor,
  vehicleList,
  supervisorList,
  setFromDate,
  setToDate,
  setTripNo,
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
  const enableExports = hasFilters && pendingTrips > 0;
  const vehicleOptions = withoutSentinel(vehicleList || [], "All Vehicles");
  const supervisorOptions = withoutSentinel(supervisorList || [], "All Supervisors");

  return (
    <div className={opsFilterCardClass}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={13} className="text-emerald-500 flex-shrink-0" />
            <span>From Date</span>
          </label>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder="Select date"
            className="w-full text-xs font-medium"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={13} className="text-emerald-500 flex-shrink-0" />
            <span>To Date</span>
          </label>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="Select date"
            className="w-full text-xs font-medium"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Truck size={13} className="text-emerald-500 flex-shrink-0" />
            <span>Vehicle</span>
          </label>
          <MasterDropdown
            hideLabel
            label="Vehicle"
            value={vehicle}
            options={vehicleOptions}
            onChange={setVehicle}
            placeholder="All Vehicles"
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <UserCog size={13} className="text-emerald-500 flex-shrink-0" />
            <span>Supervisor</span>
          </label>
          <MasterDropdown
            hideLabel
            label="Supervisor"
            value={supervisor}
            options={supervisorOptions}
            onChange={setSupervisor}
            placeholder="All Supervisors"
            searchable
            allowClear
            className="w-full"
          />
        </div>

        <div>
          <label className={opsFilterLabelClass}>
            <Hash size={13} className="text-slate-400 flex-shrink-0" />
            <span>Trip No</span>
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={tripNo}
              onChange={(event) => setTripNo(event.target.value)}
              placeholder="Trip Number..."
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
        <div className="text-xs font-semibold text-slate-600">
          Pending Trips : <span className="font-bold text-orange-600">{pendingTrips}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button type="button" onClick={onSearch} className={`group relative ${opsPrimaryButtonClass}`} aria-label="Search rate entries">
            <span className={`inline-flex ${uiActionIconMotionClass.search}`}><Search size={15} /></span>
            Search
            <ActionTooltip label="Search" />
          </button>
          <button type="button" onClick={onReset} className={`group relative ${opsSecondaryButtonClass}`} aria-label="Reset rate entry filters">
            <span className={`inline-flex ${uiActionIconMotionClass.reset}`}><RotateCcw size={14} /></span>
            Reset
            <ActionTooltip label="Reset" />
          </button>
          {onRefresh && <BrandRefreshButton onClick={onRefresh} loading={refreshing} />}
          {onExportPDF && (
            <button type="button" onClick={onExportPDF} disabled={!enableExports} className={`group relative ${opsPdfButtonClass}`} aria-label="Export rate entries PDF">
              <span className={`inline-flex ${enableExports ? uiActionIconMotionClass.pdf : ""}`}><FileText size={15} /></span>
              PDF
              <ActionTooltip label="Export PDF" />
            </button>
          )}
          {onExportExcel && (
            <button type="button" onClick={onExportExcel} disabled={!enableExports} className={`group relative ${opsExcelButtonClass}`} aria-label="Export rate entries Excel">
              <span className={`inline-flex ${enableExports ? uiActionIconMotionClass.excel : ""}`}><FileSpreadsheet size={15} /></span>
              Excel
              <ActionTooltip label="Export Excel" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(CompletedTripsFilters);
