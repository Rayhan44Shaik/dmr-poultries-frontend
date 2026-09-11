import React, { useCallback, useMemo, useState } from "react";
import { FileText, Truck, User, ShieldAlert, MapPin, Calendar, Gauge, DollarSign, MessageSquare } from "lucide-react";
import type { Trip } from "../types/trip";
import { DatePicker } from "../../../../components/common/DatePicker";
import { useFuelKMValidator } from "../../../operations/fuel-expenses/hooks/useFuelKMValidator";
import { useI18n } from "../../../../i18n";
import MasterDropdown from "../../../masters/components/MasterDropdown";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateField: (field: keyof Trip, value: any) => void;
  vehicles: any[];
  drivers: any[];
  supervisors: any[];
  farms: any[];
}

function TripInformation({
  trip,
  setTrip,
  updateField,
  vehicles,
  drivers,
  supervisors,
  farms,
}: Props) {
  const { t } = useI18n();
  const [openingKmError, setOpeningKmError] = useState<string | null>(null);
  const [closingKmError, setClosingKmError] = useState<string | null>(null);

  const validator = useFuelKMValidator(trip.vehicleNo);

  // ---- Options ----
  const vehicleOptions = useMemo(
    () => vehicles.map((v) => v.vehicleNumber),
    [vehicles]
  );

  const driverOptions = useMemo(
    () => drivers.map((d) => d.employeeName),
    [drivers]
  );

  const supervisorOptions = useMemo(
    () => supervisors.map((s) => s.employeeName),
    [supervisors]
  );

  // ---- Handlers ----
  const handleVehicleSelect = (selected: string) => {
    const vehicle = vehicles.find((v) => v.vehicleNumber === selected);
    if (!vehicle) {
      setTrip((prev) => ({ ...prev, vehicleId: 0, vehicleNo: "" }));
      return;
    }
    setTrip((prev) => ({
      ...prev,
      vehicleId: vehicle.id,
      vehicleNo: vehicle.vehicleNumber,
    }));
  };

  const handleDriverSelect = (selected: string) => {
    setTrip((prev) => ({
      ...prev,
      driverName: selected || "",
    }));
  };

  const handleSupervisorSelect = (selected: string) => {
    setTrip((prev) => ({
      ...prev,
      supervisorName: selected || "",
    }));
  };

  const handleFarmChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const farm = farms.find((f) => f.id === Number(e.target.value));
      if (!farm) return;
      setTrip((prev) => ({
        ...prev,
        sourceFarmId: farm.id,
        sourceFarm: farm.farmName,
      }));
    },
    [farms, setTrip]
  );

  const handleNumericChange = useCallback(
    (field: keyof Trip, value: string) => {
      const num = value === "" ? 0 : Number(value);
      if (isNaN(num)) return;
      updateField(field, num);
    },
    [updateField]
  );

  const handleOpeningMeterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === "") {
        setTrip((prev) => ({
          ...prev,
          openingMeter: 0,
          totalKm: prev.closingMeter - 0,
        }));
        setOpeningKmError(null);
        return;
      }
      const num = parseFloat(val);
      if (isNaN(num)) return;
      const rounded = Math.round(num * 100) / 100;
      
      // Always update the field value
      setTrip((prev) => ({
        ...prev,
        openingMeter: rounded,
        totalKm: Math.round((prev.closingMeter - rounded) * 100) / 100,
      }));
      
      // Validate and show error if needed
      const { valid, message } = validator.validateKM(rounded);
      if (!valid) {
        setOpeningKmError(message || "Invalid KM");
      } else {
        setOpeningKmError(null);
      }
    },
    [setTrip, validator]
  );

  const handleClosingMeterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === "") {
        setTrip((prev) => ({
          ...prev,
          closingMeter: 0,
          totalKm: 0 - (prev.openingMeter ?? 0),
        }));
        setClosingKmError(null);
        return;
      }
      const num = parseFloat(val);
      if (isNaN(num)) return;
      const rounded = Math.round(num * 100) / 100;
      
      // Always update the field value
      setTrip((prev) => ({
        ...prev,
        closingMeter: rounded,
        totalKm: Math.round((rounded - (prev.openingMeter ?? 0)) * 100) / 100,
      }));
      
      // Validate and show error if needed
      const { valid, message } = validator.validateKM(rounded);
      if (!valid) {
        setClosingKmError(message || "Invalid KM");
      } else {
        setClosingKmError(null);
      }
    },
    [setTrip, validator]
  );

  const handleDcWeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === "") {
        updateField("dcWeight", 0);
        return;
      }
      const num = parseFloat(val);
      if (isNaN(num)) return;
      const rounded = Math.round(num * 100) / 100;
      updateField("dcWeight", rounded);
    },
    [updateField]
  );

  const handleTotalBirdsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === "") {
        updateField("totalBirds", 0);
        return;
      }
      const num = parseInt(val, 10);
      if (isNaN(num)) return;
      updateField("totalBirds", num);
    },
    [updateField]
  );

  const displayValue = (val: number | null | undefined) => (val == null || val === 0 ? "" : val);


  return (
    <>
      <style>{`
        .no-spinner::-webkit-inner-spin-button,
        .no-spinner::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinner {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden transition-all duration-300">
        {/* Header Section */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-400/20 text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">{t("ops.trip.trip_information")}</h3>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50/70 text-emerald-500 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-100/60 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t("ops.trip.active_log_entry")}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Trip No */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {t("operations.trip_no")} <span className="text-rose-500">*</span>
              </label>
              <input
                value={trip.tripNo}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-100/70 px-4 py-2.5 text-sm font-bold text-slate-700 cursor-not-allowed shadow-inner transition-all outline-none"
              />
            </div>

            {/* 2. Trip Date */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {t("ops.trip.field.trip_date")} <span className="text-rose-500">*</span>
              </label>
              <DatePicker
                value={trip.tripDate}
                onChange={(value) => updateField("tripDate", value)}
                placeholder={t("placeholder.enter_date")}
                className="w-full rounded-xl"
              />
            </div>

            {/* 3. Source Farm */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {t("ops.trip.source_farm")} <span className="text-rose-500">*</span>
              </label>
              <select
                value={trip.sourceFarmId || ""}
                onChange={handleFarmChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-700 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-400/10 outline-none transition-all cursor-pointer shadow-xs"
              >
                <option value="">{t("operations.select_farm")}</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.farmName}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Vehicle */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                {t("common.vehicle")} <span className="text-rose-500">*</span>
              </label>
              <MasterDropdown
                hideLabel
                label={t("common.vehicle")}
                value={trip.vehicleNo || ""}
                options={vehicleOptions}
                onChange={handleVehicleSelect}
                placeholder={t("ops.trip.search_vehicle")}
                searchable
                allowClear
                className="w-full"
              />
            </div>

            {/* 5. Supervisor */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {t("common.supervisor")} <span className="text-rose-500">*</span>
              </label>
              <MasterDropdown
                hideLabel
                label={t("common.supervisor")}
                value={trip.supervisorName || ""}
                options={supervisorOptions}
                onChange={handleSupervisorSelect}
                placeholder={t("ops.trip.search_supervisor")}
                searchable
                allowClear
                className="w-full"
              />
            </div>

            {/* 6. Driver */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {t("common.driver")} <span className="text-rose-500">*</span>
              </label>
              <MasterDropdown
                hideLabel
                label={t("common.driver")}
                value={trip.driverName || ""}
                options={driverOptions}
                onChange={handleDriverSelect}
                placeholder={t("ops.trip.search_driver")}
                searchable
                allowClear
                className="w-full"
              />
            </div>

            {/* 7. DC Weight */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {t("ops.trip.dc_weight")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={trip.dcWeight !== undefined && trip.dcWeight !== 0 ? trip.dcWeight : ""}
                onChange={handleDcWeightChange}
                placeholder="0.00"
                className="no-spinner w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-400/10 outline-none transition-all shadow-xs"
              />
            </div>

            {/* 8. Total Birds */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {t("ops.trip.total_birds")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="1"
                required
                value={trip.totalBirds !== undefined && trip.totalBirds !== 0 ? trip.totalBirds : ""}
                onChange={handleTotalBirdsChange}
                placeholder="0"
                className="no-spinner w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-400/10 outline-none transition-all shadow-xs"
              />
            </div>

            {/* 9. Mortality */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                {t("operations.total_mortality")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                value={displayValue(trip.totalMortality)}
                onChange={(e) => handleNumericChange("totalMortality", e.target.value)}
                placeholder="0"
                className="no-spinner w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-400/10 outline-none transition-all shadow-xs"
              />
            </div>

            {/* 10. Opening KM */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                {t("ops.trip.opening_km")}
              </label>
              <div>
                <input
                  type="number"
                  step="0.01"
                  value={displayValue(trip.openingMeter)}
                  onChange={handleOpeningMeterChange}
                  placeholder="0.00"
                  className={`no-spinner w-full rounded-xl border ${openingKmError ? 'border-red-500' : 'border-slate-200'} bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-400/10 outline-none transition-all shadow-xs`}
                />
                {openingKmError && <p className="mt-1 text-xs text-red-500">{openingKmError}</p>}
              </div>
            </div>

            {/* 11. Closing KM */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                {t("ops.trip.closing_km")}
              </label>
              <div>
                <input
                  type="number"
                  step="0.01"
                  value={displayValue(trip.closingMeter)}
                  onChange={handleClosingMeterChange}
                  placeholder="0.00"
                  className={`no-spinner w-full rounded-xl border ${closingKmError ? 'border-red-500' : 'border-slate-200'} bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-400/10 outline-none transition-all shadow-xs`}
                />
                {closingKmError && <p className="mt-1 text-xs text-red-500">{closingKmError}</p>}
              </div>
            </div>

            {/* 12. Total KM */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                {t("operations.total_km")}
              </label>
              <input
                value={trip.totalKm}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-100/70 px-4 py-2.5 text-sm font-bold text-slate-700 cursor-not-allowed shadow-inner outline-none"
              />
            </div>

            {/* 13. Total Expense */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                {t("ops.trip.total_expense")}
              </label>
              <input
                type="number"
                value={displayValue(trip.expense)}
                onChange={(e) => handleNumericChange("expense", e.target.value)}
                placeholder="0.00"
                className="no-spinner w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-400/10 outline-none transition-all shadow-xs"
              />
            </div>

            {/* 14. Remarks */}
            <div className="group">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                {t("common.remarks")}
              </label>
              <input
                value={trip.remarks}
                placeholder={t("ops.trip.optional_notes")}
                onChange={(e) => updateField("remarks", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-400/10 outline-none transition-all shadow-xs"
              />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default React.memo(TripInformation);