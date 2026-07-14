import React, { useCallback, useMemo } from "react";
import { FileText } from "lucide-react";
import Select from "react-select";
import type { Trip } from "../types/trip";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateField: (field: keyof Trip, value: any) => void;
  vehicles: any[];
  drivers: any[];
  supervisors: any[];
  farms: any[];
}

const containsFilter = (option: any, inputValue: string) => {
  if (!inputValue) return true;
  return option.label.toLowerCase().includes(inputValue.toLowerCase());
};

const startsWithFilter = (option: any, inputValue: string) => {
  if (!inputValue) return true;
  return option.label.toLowerCase().startsWith(inputValue.toLowerCase());
};

function TripInformation({
  trip,
  setTrip,
  updateField,
  vehicles,
  drivers,
  supervisors,
  farms,
}: Props) {
  // ---- Create options using names as values ----
  const vehicleOptions = useMemo(
    () => vehicles.map((v) => ({ value: v.id, label: v.vehicleNumber })),
    [vehicles]
  );

  // ✅ Use employeeName as value instead of ID
  const driverOptions = useMemo(
    () => drivers.map((d) => ({ value: d.employeeName, label: d.employeeName })),
    [drivers]
  );

  const supervisorOptions = useMemo(
    () => supervisors.map((s) => ({ value: s.employeeName, label: s.employeeName })),
    [supervisors]
  );

  // ---- Handlers for react-select ----
  const handleVehicleSelect = (selected: any) => {
    const vehicle = vehicles.find((v) => v.id === selected?.value);
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

  const handleDriverSelect = (selected: any) => {
    // ✅ Set driverName directly from selected label
    setTrip((prev) => ({
      ...prev,
      driverName: selected?.value || "",
    }));
  };

  const handleSupervisorSelect = (selected: any) => {
    // ✅ Set supervisorName directly
    setTrip((prev) => ({
      ...prev,
      supervisorName: selected?.value || "",
    }));
  };

  // ---- Farm select (native) ----
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
      const opening = val === "" ? 0 : Number(val);
      if (isNaN(opening)) return;
      setTrip((prev) => ({
        ...prev,
        openingMeter: opening,
        totalKm: prev.closingMeter - opening,
      }));
    },
    [setTrip]
  );

  const handleClosingMeterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const closing = val === "" ? 0 : Number(val);
      if (isNaN(closing)) return;
      setTrip((prev) => ({
        ...prev,
        closingMeter: closing,
        totalKm: closing - prev.openingMeter,
      }));
    },
    [setTrip]
  );

  const displayValue = (val: number) => (val === 0 ? "" : val);

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderRadius: 8,
      borderColor: "#cbd5e1",
      boxShadow: "none",
      minHeight: 38,
      fontSize: "14px",
      "&:hover": { borderColor: "#94a3b8" },
      "&:focus-within": {
        borderColor: "#3b82f6",
        boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.15)",
      },
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#eff6ff" : "white",
      color: isSelected ? "white" : "#1e293b",
    }),
    menu: (base: any) => ({ ...base, zIndex: 50 }),
    placeholder: (base: any) => ({
      ...base,
      color: "#94a3b8",
    }),
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-slate-50">
        <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
          <FileText className="w-4 h-4 text-green-700" />
        </div>
        <h3 className="text-base font-semibold text-slate-700">Trip Information</h3>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Trip No */}
          <div>
            <label className="text-xs font-medium text-slate-600">
              Trip No <span className="text-red-500">*</span>
            </label>
            <input
              value={trip.tripNo}
              readOnly
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold cursor-not-allowed focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">
              Trip Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={trip.tripDate}
              onChange={(e) => updateField("tripDate", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>

          {/* Vehicle */}
          <div>
            <label className="text-xs font-medium text-slate-600">
              Vehicle <span className="text-red-500">*</span>
            </label>
            <Select
              options={vehicleOptions}
              value={vehicleOptions.find((opt) => opt.value === trip.vehicleId) || null}
              onChange={handleVehicleSelect}
              isSearchable
              filterOption={containsFilter}
              placeholder="Search Vehicle..."
              styles={selectStyles}
            />
          </div>

          {/* Driver – using name as value */}
          <div>
            <label className="text-xs font-medium text-slate-600">
              Driver <span className="text-red-500">*</span>
            </label>
            <Select
              options={driverOptions}
              value={driverOptions.find((opt) => opt.value === trip.driverName) || null}
              onChange={handleDriverSelect}
              isSearchable
              filterOption={startsWithFilter}
              placeholder="Search Driver..."
              styles={selectStyles}
            />
          </div>

          {/* Supervisor – using name as value */}
          <div>
            <label className="text-xs font-medium text-slate-600">
              Supervisor <span className="text-red-500">*</span>
            </label>
            <Select
              options={supervisorOptions}
              value={supervisorOptions.find((opt) => opt.value === trip.supervisorName) || null}
              onChange={handleSupervisorSelect}
              isSearchable
              filterOption={startsWithFilter}
              placeholder="Search Supervisor..."
              styles={selectStyles}
            />
          </div>

          {/* Farm */}
          <div>
            <label className="text-xs font-medium text-slate-600">
              Source Farm <span className="text-red-500">*</span>
            </label>
            <select
              value={trip.sourceFarmId || ""}
              onChange={handleFarmChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            >
              <option value="">Select Farm</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmName}
                </option>
              ))}
            </select>
          </div>

          {/* KM & Expenses */}
          <div>
            <label className="text-xs font-medium text-slate-600">Opening KM</label>
            <input
              type="number"
              value={displayValue(trip.openingMeter)}
              onChange={handleOpeningMeterChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Closing KM</label>
            <input
              type="number"
              value={displayValue(trip.closingMeter)}
              onChange={handleClosingMeterChange}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Total KM</label>
            <input
              value={trip.totalKm}
              readOnly
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Fuel (Ltrs)</label>
            <input
              type="number"
              value={displayValue(trip.fuel)}
              onChange={(e) => handleNumericChange("fuel", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Total Expense</label>
            <input
              type="number"
              value={displayValue(trip.expense)}
              onChange={(e) => handleNumericChange("expense", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>

          {/* Mortality & Remarks */}
          <div>
            <label className="text-xs font-medium text-slate-600">Total Mortality</label>
            <input
              type="number"
              value={displayValue(trip.totalMortality)}
              onChange={(e) => handleNumericChange("totalMortality", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="text-xs font-medium text-slate-600">Remarks</label>
            <input
              value={trip.remarks}
              placeholder="Optional"
              onChange={(e) => updateField("remarks", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripInformation);