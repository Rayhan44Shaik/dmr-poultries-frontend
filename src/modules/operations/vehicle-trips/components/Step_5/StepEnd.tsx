// src/modules/operations/vehicle-trips/components/Step_5/StepEnd.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Pencil,
  X,
  CheckCircle2,
  Save,
  Send,
  Loader2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { Trip, TripStatus } from "../../types/trip";
import { tripService } from "../../services/tripService";
import GeneralExpensesTable from "./GeneralExpensesTable";
import DieselExpensesTable from "./DieselExpensesTable";
import { fuelExpenseService } from "../../../fuel-expenses/services/fuelExpenseService";
import type { FuelExpense } from "../../../fuel-expenses/types/fuelExpense";

// ─── Toast Component ──────────────────────────────────────────────
function Toast({ message, type = "success", onClose }: {
  message: string;
  type?: "success" | "error" | "warning" | "info";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-100/50",
    warning: "bg-amber-50 border-amber-300 text-amber-900 shadow-amber-100/50",
    info: "bg-blue-50 border-blue-300 text-blue-900 shadow-blue-100/50",
    error: "bg-rose-50 border-rose-300 text-rose-900 shadow-rose-100/50",
  }[type];

  const icon = type === "success" ? <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
    : type === "warning" ? <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
    : type === "info" ? <AlertCircle size={18} className="text-blue-600 flex-shrink-0" />
    : <AlertTriangle size={18} className="text-rose-600 flex-shrink-0" />;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 border text-xs sm:text-sm font-semibold ${styles}`}>
        {icon}
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition-opacity"><X size={15} /></button>
      </div>
    </div>
  );
}

// ─── ConfirmationModal ────────────────────────────────────────────
function ConfirmationModal({ isOpen, title, message, confirmLabel = "Yes, Proceed", cancelLabel = "Cancel", onConfirm, onCancel, type = "warning" }: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "warning" | "info";
}) {
  if (!isOpen) return null;
  const iconColor = type === "warning" ? "text-amber-600" : "text-emerald-600";
  const borderColor = type === "warning" ? "border-amber-200" : "border-emerald-200";
  const bgGradient = type === "warning" ? "from-amber-50 to-orange-50" : "from-emerald-50 to-teal-50";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border ${borderColor}`}>
        <div className={`bg-gradient-to-br ${bgGradient} p-6`}>
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 p-2 rounded-full bg-white/80 border ${borderColor}`}>
              <AlertTriangle size={22} className={iconColor} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onCancel} className="px-5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-xs">{cancelLabel}</button>
          <button onClick={onConfirm} className={`px-5 py-2 rounded-lg text-sm font-bold text-white shadow-xs transition-all active:scale-[0.98] ${type === "warning" ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

interface SheetData extends Record<string, any> {
  vehicleNo: string;
  submittedAtTimestamp: string;
  advance: number | string;
  meals: number | string;
  loading: number | string;
  mealsTiffin: number | string;
  vehicleMaintenance: number | string;
  othersRC: number | string;
  others1Amt: number | string;
  others2Amt: number | string;
  others3Amt: number | string;
  others4Amt: number | string;
  others5Amt: number | string;
  startMeter: number | string;
  endMeter: number | string;
  destinationTolls: number | string;
  remarks: string;
}

interface Props {
  trip: Trip;
  setTrip?: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>, persist?: boolean, silent?: boolean) => void;
  submitExpensesStep?: (data: Partial<Trip>) => boolean | Promise<boolean>;
  submitStartStep?: (data: Partial<Trip>) => boolean | Promise<boolean>;
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  clearForm?: () => void;
}

export default function StepEnd({
  trip,
  updateTrip,
  submitExpensesStep,
  submitStartStep,
  editable = false,
  canEdit = true,
  onCancel,
  clearForm,
}: Props) {
  // ─── State ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: "warning" | "info";
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
  });

  // ─── Local isSubmitted state ─────────────────────────────────────
  const [isSubmittedLocal, setIsSubmittedLocal] = useState(false);
  const isSubmitted = Boolean((trip as any).expensesStepSubmitted || (trip as any).endStepSubmitted || isSubmittedLocal);

  // ─── Helper to build sheet data from trip ──────────────────────
  const buildSheetDataFromTrip = (tripData: Trip): SheetData => {
    const data: SheetData = {
      vehicleNo: tripData.vehicleNo || "",
      submittedAtTimestamp: (tripData as any).submittedAtTimestamp || (tripData as any).submittedAt || "",
      advance: tripData.advanceAmount ?? "",
      meals: (tripData as any).meals ?? "",
      loading: (tripData as any).loading ?? "",
      mealsTiffin: (tripData as any).mealsTiffin ?? "",
      vehicleMaintenance: (tripData as any).vehicleMaintenance ?? "",
      othersRC: (tripData as any).othersRC ?? "",
      others1Amt: (tripData as any).others1Amt ?? "",
      others2Amt: (tripData as any).others2Amt ?? "",
      others3Amt: (tripData as any).others3Amt ?? "",
      others4Amt: (tripData as any).others4Amt ?? "",
      others5Amt: (tripData as any).others5Amt ?? "",
      startMeter: tripData.openingMeter || 0,
      endMeter: (tripData as any).endMeter ?? (tripData as any).closingMeter ?? "",
      destinationTolls: (tripData as any).destinationTolls ?? (tripData as any).deliveryTolls ?? "",
      remarks: (tripData as any).remarks ?? "",
    };
    // Copy all diesel fields from trip
    Object.keys(tripData).forEach(key => {
      if (key.startsWith("dieselLtr") || key.startsWith("dieselRate") || key.startsWith("dieselMeter") ||
          key.startsWith("dieselBunk") || key.startsWith("dieselImage") || key.startsWith("dieselImageName")) {
        (data as any)[key] = (tripData as any)[key];
      }
    });
    return data;
  };

  // ─── Sheet Data state ───────────────────────────────────────────
  const [sheetData, setSheetData] = useState<SheetData>(() => buildSheetDataFromTrip(trip));

  // ─── Reset sheetData when trip changes ──────────────────────────
  const prevTripId = useRef<number>(trip.id);
  useEffect(() => {
    if (trip.id !== prevTripId.current) {
      prevTripId.current = trip.id;
      setSheetData(buildSheetDataFromTrip(trip));
      setIsSubmittedLocal(false);
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
        autoSaveTimeout.current = null;
      }
      setErrorMsg("");
      setIsLocalEditing(false);
    }
  }, [trip.id, trip]);

  // ─── Compute Distance & Average ──────────────────────────────────
  const openingMeter = trip.openingMeter || 0;
  const destMeter = trip.destMeter || 0;
  const endMeterNum = Number(sheetData.endMeter);

  let totalDistanceCovered = 0;
  if (openingMeter > 0 && endMeterNum > 0 && endMeterNum > openingMeter) {
    totalDistanceCovered = endMeterNum - openingMeter;
  }

  // ─── Dynamically compute diesel totals from all rows ────────────
  const getDieselIndices = (data: SheetData): number[] => {
    const indices: number[] = [];
    Object.keys(data).forEach(key => {
      const match = key.match(/^dieselLtr(\d+)$/);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (!indices.includes(idx)) indices.push(idx);
      }
    });
    return indices.sort((a,b) => a - b);
  };

  const dieselIndices = getDieselIndices(sheetData);
  const dieselAmounts = dieselIndices.map(idx => {
    const ltr = Number(sheetData[`dieselLtr${idx}`] || 0);
    const rate = Number(sheetData[`dieselRate${idx}`] || 0);
    return ltr * rate;
  });
  const totalDieselAmount = dieselAmounts.reduce((acc, curr) => acc + curr, 0);
  const totalDieselLiters = dieselIndices.reduce((acc, idx) => acc + Number(sheetData[`dieselLtr${idx}`] || 0), 0);

  let averageKmLtr = "0.00";
  if (totalDistanceCovered > 0 && totalDieselLiters > 0) {
    averageKmLtr = (totalDistanceCovered / totalDieselLiters).toFixed(2);
  }

  // ─── Persist to storage helper ──────────────────────────────────
  const saveToStorage = useCallback(
    (data: SheetData, stepSubmitted: boolean) => {
      const payload = {
        ...data,
        closingMeter: Number(data.endMeter) || 0,
        deliveryTolls: data.destinationTolls === "" ? 0 : Number(data.destinationTolls),
        advanceAmount: data.advance === "" ? 0 : Number(data.advance),
        openingMeter: openingMeter,
        expensesStepSubmitted: stepSubmitted,
        endStepSubmitted: stepSubmitted, // ✅ Ensure endStepSubmitted is set
        status: stepSubmitted ? "Completed" : trip.status, // ✅ FIXED: Mark trip as Completed if step is submitted
      };
      const updatedTrip = { ...trip, ...payload };
      tripService.update(updatedTrip);
      updateTrip(payload as any, true, true);
    },
    [trip, updateTrip, openingMeter]
  );

  // ─── Auto‑save helpers ──────────────────────────────────────────
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  const debouncedAutoSave = useCallback(
    (data: SheetData) => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
      autoSaveTimeout.current = setTimeout(() => {
        saveToStorage(data, isSubmitted);
      }, 800);
    },
    [saveToStorage, isSubmitted]
  );

  const immediateSave = useCallback(
    (data: SheetData) => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
        autoSaveTimeout.current = null;
      }
      saveToStorage(data, isSubmitted);
    },
    [saveToStorage, isSubmitted]
  );

  // ─── Handle field changes (debounced) ──────────────────────────
  const handleChange = (field: string, value: any) => {
    setErrorMsg("");
    const updated = { ...sheetData, [field]: value };
    setSheetData(updated);
    debouncedAutoSave(updated);
  };

  // ─── Compute derived values ──────────────────────────────────────
  const totalExpenses1 =
    Number(sheetData.meals || 0) +
    Number(sheetData.loading || 0) +
    Number(sheetData.mealsTiffin || 0) +
    Number(sheetData.vehicleMaintenance || 0) +
    Number(sheetData.othersRC || 0);

  const totalExpenses2 =
    Number(sheetData.others1Amt || 0) +
    Number(sheetData.others2Amt || 0) +
    Number(sheetData.others3Amt || 0) +
    Number(sheetData.others4Amt || 0) +
    Number(sheetData.others5Amt || 0);

  const totalAllExpenses = totalExpenses1 + totalExpenses2;

  const remainingBalance =
    Number(sheetData.advance || 0) - totalAllExpenses - totalDieselAmount;

  // ─── Prepare final payload for submission ──────────────────────
  const prepareFinalPayload = (stepSubmitted = false) => {
    const existingTimestamp = (trip as any).submittedAtTimestamp || sheetData.submittedAtTimestamp;
    const capturedTimestamp = existingTimestamp || new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    let newStatus: TripStatus = trip.status || "Draft";
    if (stepSubmitted) {
      if (trip.status !== "Deleted") {
        newStatus = "Completed"; // ✅ FIXED: End step signifies trip completion
      } else {
        newStatus = "Deleted";
      }
    }

    return {
      ...sheetData,
      submittedAtTimestamp: capturedTimestamp,
      totalExpenses: totalAllExpenses,
      totalDieselAmount,
      remainingBalance,
      pickupTolls: trip.pickupTolls || 0,
      closingMeter: Number(sheetData.endMeter) || 0,
      deliveryTolls: sheetData.destinationTolls === "" ? 0 : Number(sheetData.destinationTolls),
      advanceAmount: sheetData.advance === "" ? 0 : Number(sheetData.advance),
      openingMeter: openingMeter,
      expensesStepSubmitted: stepSubmitted,
      endStepSubmitted: stepSubmitted, // ✅ Explicitly set endStepSubmitted
      status: newStatus,
    };
  };

  // ─── Sync fuel bills after submission ──────────────────────────
  const syncFuelBillsOnSubmit = useCallback((data: SheetData) => {
    const indices = getDieselIndices(data);
    if (indices.length === 0) return;

    const existingBills = fuelExpenseService.getBillsForTrip(trip.vehicleId, trip.tripDate);
    const existingKeys = new Set<string>();
    existingBills.forEach(b => {
      const key = `${b.amount}-${b.meterReading}-${b.petrolBunk}`;
      existingKeys.add(key);
    });

    indices.forEach(idx => {
      const ltr = Number(data[`dieselLtr${idx}`] || 0);
      const rate = Number(data[`dieselRate${idx}`] || 0);
      const meter = Number(data[`dieselMeter${idx}`] || 0);
      const bunk = data[`dieselBunk${idx}`] || "";
      const image = data[`dieselImage${idx}`] || "";
      if (!ltr || !rate || !meter || !bunk) return;

      const amount = ltr * rate;
      const key = `${amount}-${meter}-${bunk}`;
      if (existingKeys.has(key)) return;

      const fuelBill: Omit<FuelExpense, "id" | "billNo" | "createdDate" | "createdBy" | "status"> = {
        date: trip.tripDate,
        vehicleId: trip.vehicleId,
        vehicleNo: trip.vehicleNo,
        driverId: trip.driverId,
        driverName: trip.driverName,
        supervisorId: trip.supervisorId,
        supervisorName: trip.supervisorName,
        meterReading: meter,
        amount: amount,
        rate: rate,
        litres: ltr,
        petrolBunk: bunk,
        remarks: `Auto-created from trip ${trip.tripNo}`,
        image: image,
        synced: true,
      };

      fuelExpenseService.save(fuelBill);
    });
  }, [trip]);

  // ─── Save progress (manual) ──────────────────────────────────────
  const handleSaveProgress = () => {
    try {
      immediateSave(sheetData);
      setToast({ message: "Expenses saved successfully!", type: "success" });
    } catch (error) {
      console.error("Save error:", error);
      setToast({ message: "Failed to save progress.", type: "error" });
    }
  };

  // ─── Initiate submit ──────────────────────────────────────────────
  const handleInitiateSubmit = () => {
    const endMeterNum = Number(sheetData.endMeter);
    if (sheetData.endMeter === "" || sheetData.endMeter === null || isNaN(endMeterNum)) {
      setErrorMsg("End Meter Reading is required.");
      setToast({ message: "End Meter Reading is required.", type: "warning" });
      return;
    }

    const actualDestMeter = destMeter || 0;
    let highestDieselMeter = 0;
    Object.keys(sheetData).forEach((key) => {
      if (key.startsWith("dieselMeter")) {
        const val = Number(sheetData[key]);
        if (!isNaN(val) && val > highestDieselMeter) highestDieselMeter = val;
      }
    });
    let requiredMinMeter = openingMeter;
    let requiredMinLabel = `Start Meter (${openingMeter})`;
    if (actualDestMeter > requiredMinMeter) {
      requiredMinMeter = actualDestMeter;
      requiredMinLabel = `Dest Meter (${actualDestMeter})`;
    }
    if (highestDieselMeter > requiredMinMeter) {
      requiredMinMeter = highestDieselMeter;
      requiredMinLabel = `Diesel Entry (${highestDieselMeter})`;
    }
    if (requiredMinMeter > 0 && endMeterNum <= requiredMinMeter) {
      const msg = `End Meter Reading (${sheetData.endMeter}) must be strictly greater than ${requiredMinLabel}.`;
      setErrorMsg(msg);
      setToast({ message: msg, type: "warning" });
      return;
    }

    const destTollsNum = Number(sheetData.destinationTolls);
    if (sheetData.destinationTolls === "" || sheetData.destinationTolls === null || isNaN(destTollsNum) || destTollsNum <= 0) {
      setErrorMsg("Total Toll Gates (Destination) must be greater than 0.");
      setToast({ message: "Total Toll Gates (Destination) must be greater than 0.", type: "warning" });
      return;
    }

    setConfirmation({
      isOpen: true,
      title: isSubmitted ? "Update Expenses Sheet" : "Submit Expenses Sheet",
      message: isSubmitted
        ? "Are you sure you want to update the submitted expenses sheet with recent changes?"
        : "Are you sure you want to submit this expenses sheet? This will mark the trip as completed and lock current entries.",
      confirmLabel: isSubmitted ? "Yes, Update" : "Yes, Submit",
      cancelLabel: "Cancel",
      type: "info",
      onConfirm: () => {
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
        executeSubmit();
      },
      onCancel: () => setConfirmation((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const executeSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const finalData = prepareFinalPayload(true);
      let success = true;
      const submitFn = submitExpensesStep || submitStartStep;
      if (typeof submitFn === "function") {
        const result = await submitFn(finalData as any);
        if (result === false) success = false;
      }
      if (success) {
        // ✅ Save and update parent state
        immediateSave(finalData as any);
        setSheetData(finalData as any);
        setIsLocalEditing(false);
        setIsSubmittedLocal(true);
        syncFuelBillsOnSubmit(finalData as any);
        setToast({ message: "Expenses sheet submitted successfully! Trip marked as completed.", type: "success" });
      } else {
        setErrorMsg("Failed to save step details.");
        setToast({ message: "Failed to save step details.", type: "error" });
      }
    } catch (err: any) {
      console.error("Submit error:", err);
      setErrorMsg(err?.message || "Failed to save step details.");
      setToast({ message: err?.message || "Failed to save step details.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseView = () => {
    if (isLocalEditing) {
      setIsLocalEditing(false);
      setToast({ message: "Edit cancelled.", type: "info" });
    } else if (onCancel) {
      onCancel();
    }
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .sheet-joined-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden; }
        .sheet-joined-table th, .sheet-joined-table td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 0.8125rem; line-height: 1.2; text-align: left !important; }
        .sheet-joined-table input[type="number"]::-webkit-inner-spin-button,
        .sheet-joined-table input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none !important; margin: 0 !important; }
        .sheet-joined-table input[type="number"] { -moz-appearance: textfield !important; appearance: textfield !important; }
        .sheet-joined-table input { width: 100%; outline: none; background: transparent; font-size: 0.8125rem; color: #0f172a; font-weight: 500; padding: 2px; text-align: left !important; }
      `}</style>

      {isSubmitted && !isLocalEditing ? (
        // ─── Locked View ──────────────────────────────────────────────
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0">5</span>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">EXPENSES SHEET (SUBMITTED)</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <button
                  onClick={() => setIsLocalEditing(true)}
                  className="bg-white hover:bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
              )}
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">
                Submitted & Locked
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-slate-50/50 border border-slate-200/80 p-2.5 rounded-lg">
              <p className="text-[11px] text-slate-500 font-medium">Date & Time</p>
              <p className="text-xs font-semibold text-slate-900 mt-0.5">{sheetData.submittedAtTimestamp || "--"}</p>
            </div>
            <div className="bg-slate-50/50 border border-slate-200/80 p-2.5 rounded-lg">
              <p className="text-[11px] text-slate-500 font-medium">Vehicle No</p>
              <p className="text-xs font-semibold text-slate-900 mt-0.5">{sheetData.vehicleNo || "--"}</p>
            </div>
            <div className="bg-slate-50/50 border border-slate-200/80 p-2.5 rounded-lg">
              <p className="text-[11px] text-slate-500 font-medium">Total Expenses</p>
              <p className="text-xs font-semibold text-red-600 mt-0.5">₹{totalAllExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50/50 border border-slate-200/80 p-2.5 rounded-lg">
              <p className="text-[11px] text-slate-500 font-medium">Total Diesel</p>
              <p className="text-xs font-semibold text-blue-600 mt-0.5">₹{totalDieselAmount.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50/50 border border-slate-200/80 p-2.5 rounded-lg">
              <p className="text-[11px] text-slate-500 font-medium">Remaining Balance</p>
              <p className="text-xs font-semibold text-emerald-600 mt-0.5">₹{remainingBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      ) : (
        // ─── Editable View ────────────────────────────────────────────
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0">5</span>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">EXPENSES SHEET</h2>
            </div>
            <div className="flex items-center gap-2"><span className="text-[11px] text-slate-700 font-medium bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">Editable View</span></div>
          </div>

          {errorMsg && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">⚠️ {errorMsg}</div>}

          <GeneralExpensesTable
            key={`general-${trip.id}`}
            sheetData={sheetData}
            handleChange={handleChange}
            pickupTolls={trip.pickupTolls || 0}
            totalExpenses1={totalExpenses1}
            totalExpenses2={totalExpenses2}
            totalAllExpenses={totalAllExpenses}
            totalDistanceCovered={totalDistanceCovered}
            averageKmLtr={averageKmLtr}
            openingMeter={openingMeter}
            destMeter={destMeter}
            trip={trip}
          />

          <DieselExpensesTable
            key={`diesel-${trip.id}`}
            sheetData={sheetData}
            handleChange={handleChange}
            immediateSave={immediateSave}
            dieselAmounts={dieselAmounts}
            totalDieselAmount={totalDieselAmount}
            destMeter={destMeter}
          />

          <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
            <textarea
              rows={2}
              value={sheetData.remarks}
              onChange={(e) => {
                setErrorMsg("");
                const val = e.target.value;
                const updated = { ...sheetData, remarks: val };
                setSheetData(updated);
                debouncedAutoSave(updated);
              }}
              placeholder="Enter optional trip notes or destination remarks..."
              className="w-full text-xs font-medium text-slate-800 outline-none bg-transparent resize-none placeholder:text-slate-400 text-left"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 font-bold text-xs text-slate-900">
            <div>Total Expenses: <span className="text-red-600">₹{totalAllExpenses.toFixed(2)}</span></div>
            <div>Total Diesel: <span className="text-blue-600">₹{totalDieselAmount.toFixed(2)}</span></div>
            <div>Balance Remaining: <span className="text-emerald-600">₹{remainingBalance.toFixed(2)}</span></div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button onClick={handleCloseView} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95"><LogOut size={15} className="text-slate-500" /><span>Close</span></button>
            <button onClick={handleSaveProgress} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95"><Save size={15} /><span>Save Progress</span></button>
            <button onClick={handleInitiateSubmit} disabled={isSubmitting} className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 ${isSubmitted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
              {isSubmitted ? <RefreshCw size={15} /> : <Send size={15} />}
              <span>{isSubmitting ? "Processing..." : isSubmitted ? "Update Expenses Sheet" : "Submit Expenses Sheet"}</span>
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <ConfirmationModal
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel={confirmation.cancelLabel}
        type={confirmation.type}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel || (() => setConfirmation((prev) => ({ ...prev, isOpen: false })))}
      />
    </>
  );
}