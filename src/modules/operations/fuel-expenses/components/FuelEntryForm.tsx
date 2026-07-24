import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import Select from "react-select";
import { AlertCircle } from "lucide-react";
import { fuelExpenseService } from "../services/fuelExpenseService";
import type { FuelExpense } from "../types/fuelExpense";
import { useFuelKMValidator } from "../../../operations/fuel-expenses/hooks/useFuelKMValidator";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";

interface Props {
  onSave: (data: Omit<FuelExpense, "id" | "billNo" | "createdDate" | "createdBy" | "status">) => void;
  onUpdate: (id: string, updates: Partial<FuelExpense>) => void;
  editingId?: string | null;
  initialData?: FuelExpense | null;
  vehicles: any[];
  drivers: any[];
  supervisors: any[];
  onCancel?: () => void;
}

export interface FuelEntryFormRef {
  resetForm: () => void;
}

export const FuelEntryForm = forwardRef<FuelEntryFormRef, Props>(({
  onSave,
  onUpdate,
  editingId,
  initialData,
  vehicles,
  drivers,
  supervisors,
  onCancel,
}, ref) => {
  const { showNotification } = useSafeNotification();

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vehicleId, setVehicleId] = useState<number>(0);
  const [vehicleNo, setVehicleNo] = useState("");
  const [driverId, setDriverId] = useState<number>(0);
  const [driverName, setDriverName] = useState("");
  const [supervisorId, setSupervisorId] = useState<number>(0);
  const [supervisorName, setSupervisorName] = useState("");
  const [meterReading, setMeterReading] = useState<number>(0);
  const [minMeterReading, setMinMeterReading] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [litres, setLitres] = useState<number>(0);
  const [petrolBunk, setPetrolBunk] = useState("");
  const [remarks, setRemarks] = useState("");

  const activeVehicles = vehicles.filter(v => (v.status?.toLowerCase() === "active"));

  // Use the fuel KM validator hook
  const validator = useFuelKMValidator(vehicleNo);
  const pendingWarning = validator.getPendingWarning();
  const latestApprovedKM = validator.latestApprovedKM;

  // Load initial data when editing
  useEffect(() => {
    if (initialData && editingId) {
      setDate(initialData.date);
      setVehicleId(initialData.vehicleId);
      setVehicleNo(initialData.vehicleNo);
      setDriverId(initialData.driverId);
      setDriverName(initialData.driverName);
      setSupervisorId(initialData.supervisorId);
      setSupervisorName(initialData.supervisorName);
      setMeterReading(initialData.meterReading);
      // For editing, we set min to the same value so it doesn't block editing
      setMinMeterReading(initialData.meterReading);
      setAmount(initialData.amount);
      setRate(initialData.rate);
      setLitres(initialData.litres);
      setPetrolBunk(initialData.petrolBunk);
      setRemarks(initialData.remarks || "");
    }
  }, [initialData, editingId]);

  // Auto-calc litres
  useEffect(() => {
    if (amount > 0 && rate > 0) {
      setLitres(parseFloat((amount / rate).toFixed(2)));
    } else {
      setLitres(0);
    }
  }, [amount, rate]);

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setVehicleId(0);
    setVehicleNo("");
    setDriverId(0);
    setDriverName("");
    setSupervisorId(0);
    setSupervisorName("");
    setMeterReading(0);
    setMinMeterReading(0);
    setAmount(0);
    setRate(0);
    setLitres(0);
    setPetrolBunk("");
    setRemarks("");
  };

  useImperativeHandle(ref, () => ({
    resetForm,
  }));

  const vehicleOptions = activeVehicles.map((v) => ({ value: v.id, label: v.vehicleNumber }));
  const driverOptions = drivers.map((d) => ({ value: d.id, label: d.employeeName }));
  const supervisorOptions = supervisors.map((s) => ({ value: s.id, label: s.employeeName }));

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderRadius: 8,
      borderColor: "#e2e8f0",
      boxShadow: "none",
      minHeight: 38,
      fontSize: "14px",
      "&:hover": { borderColor: "#94a3b8" },
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#eff6ff" : "white",
      color: isSelected ? "white" : "#1e293b",
    }),
    menu: (base: any) => ({ ...base, zIndex: 50 }),
  };

  // When vehicle changes, update min meter reading using approved bills only
  const handleVehicleChange = (selected: any) => {
    const v = activeVehicles.find((x) => x.id === selected?.value);
    if (v) {
      setVehicleId(v.id);
      setVehicleNo(v.vehicleNumber);
      // Compute min based on approved bills only (excluding current editing bill)
      const allBills = fuelExpenseService.getAll();
      const approvedBills = allBills.filter(b =>
        b.vehicleId === v.id &&
        b.status === "Approved" &&
        (editingId ? b.id !== editingId : true)
      );
      const latestApproved = approvedBills.length > 0
        ? approvedBills.sort((a, b) => b.createdDate.localeCompare(a.createdDate))[0].meterReading
        : 0;

      setMinMeterReading(latestApproved);
      if (!editingId) {
        // For new bill, set meter reading to the latest approved reading
        setMeterReading(latestApproved);
      } else {
        // For editing, keep the existing meterReading, but ensure min is set
        // We don't override meterReading, but we set min
      }
    }
  };

  // When editing, also compute min on mount or vehicle change
  useEffect(() => {
    if (editingId && vehicleId) {
      const allBills = fuelExpenseService.getAll();
      const approvedBills = allBills.filter(b =>
        b.vehicleId === vehicleId &&
        b.status === "Approved" &&
        b.id !== editingId
      );
      const latestApproved = approvedBills.length > 0
        ? approvedBills.sort((a, b) => b.createdDate.localeCompare(a.createdDate))[0].meterReading
        : 0;
      setMinMeterReading(latestApproved);
    }
  }, [editingId, vehicleId]);

  const handleSubmit = () => {
    if (!date || !vehicleId || !driverId || !supervisorId || amount <= 0 || rate <= 0 || !petrolBunk.trim()) {
      showNotification("Please fill all required fields.", "error");
      return;
    }

    if (meterReading < minMeterReading) {
      showNotification(`Meter reading cannot be lower than the last approved fuel bill reading (${minMeterReading} KM).`, "error");
      return;
    }

    const data = {
      date,
      vehicleId,
      vehicleNo,
      driverId,
      driverName,
      supervisorId,
      supervisorName,
      meterReading,
      amount,
      rate,
      litres,
      petrolBunk,
      remarks,
    };
    if (editingId) {
      onUpdate(editingId, data);
    } else {
      onSave(data);
      resetForm();
    }
  };

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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">
          {editingId ? "Edit Fuel Bill" : "Add Fuel Bill"}
        </h3>

        {/* Pending Fuel Warning Banner */}
        {pendingWarning && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>{pendingWarning}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
            />
          </div>
          {/* Vehicle */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Vehicle <span className="text-red-500">*</span>
            </label>
            <Select
              options={vehicleOptions}
              value={vehicleOptions.find((opt) => opt.value === vehicleId) || null}
              onChange={handleVehicleChange}
              isSearchable
              placeholder="Select Vehicle"
              styles={selectStyles}
            />
          </div>
          {/* Driver */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Driver <span className="text-red-500">*</span>
            </label>
            <Select
              options={driverOptions}
              value={driverOptions.find((opt) => opt.value === driverId) || null}
              onChange={(selected) => {
                const d = drivers.find((x) => x.id === selected?.value);
                if (d) {
                  setDriverId(d.id);
                  setDriverName(d.employeeName);
                }
              }}
              isSearchable
              placeholder="Select Driver"
              styles={selectStyles}
            />
          </div>
          {/* Supervisor */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Supervisor <span className="text-red-500">*</span>
            </label>
            <Select
              options={supervisorOptions}
              value={supervisorOptions.find((opt) => opt.value === supervisorId) || null}
              onChange={(selected) => {
                const s = supervisors.find((x) => x.id === selected?.value);
                if (s) {
                  setSupervisorId(s.id);
                  setSupervisorName(s.employeeName);
                }
              }}
              isSearchable
              placeholder="Select Supervisor"
              styles={selectStyles}
            />
          </div>
          {/* Meter Reading - no spinner */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Meter Reading (KM) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={meterReading || ""}
              onChange={(e) => setMeterReading(Number(e.target.value))}
              className="no-spinner w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
              placeholder="0"
            />
            {minMeterReading > 0 && (
              <div className="text-[10px] text-slate-400 mt-0.5">Minimum allowed: {minMeterReading} KM</div>
            )}
          </div>
          {/* Amount - no spinner */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Fuel Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="no-spinner w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
          {/* Rate - no spinner */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Fuel Rate (₹/Litre) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={rate || ""}
              onChange={(e) => setRate(Number(e.target.value))}
              className="no-spinner w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
          {/* Litres (read-only) */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fuel Quantity (Litres)</label>
            <input
              type="number"
              step="0.01"
              value={litres}
              readOnly
              className="no-spinner w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
            />
          </div>
          {/* Petrol Bunk */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Petrol Bunk <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={petrolBunk}
              onChange={(e) => setPetrolBunk(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
              placeholder="Enter bunk name"
            />
          </div>
          {/* Remarks */}
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-slate-500 block mb-1">Remarks (Optional)</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500"
              placeholder="Any remarks..."
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition active:scale-95"
          >
            {editingId ? "Update Bill" : "Save Bill"}
          </button>
        </div>
      </div>
    </>
  );
});

FuelEntryForm.displayName = "FuelEntryForm";