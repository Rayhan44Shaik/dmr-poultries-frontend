import React, { useState } from "react";
import { Clock, Pencil, X } from "lucide-react";
import type { Trip } from "../types/trip";

interface Props {
  trip: Trip;
  setTrip?: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  submitStartStep: (data: Partial<Trip>) => boolean;
  vehicleOptions?: { id: number; vehicleNumber: string }[];
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  clearForm?: () => void;
}

export default function StepStart({
  trip,
  updateTrip,
  submitStartStep,
  editable = false,
  canEdit = false,
  onCancel,
  clearForm,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isEditingMode = editable || isLocalEditing;

  const pickupTolls = trip.pickupTolls ?? 0;
  const destinationTolls = (trip as any).destinationTolls ?? (trip as any).dropTolls ?? 0;

  const getCurrentFormattedDateTime = () => {
    return new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const [sheetData, setSheetData] = useState({
    vehicleNo: trip.vehicleNo || "AP-01-AB-1234",
    submittedAtTimestamp:
      (trip as any).submittedAtTimestamp || (trip as any).submittedAt || "",
    advance: trip.advanceAmount ?? "",

    // Expenses Group 1 (Left Side - Fixed Labels)
    meals: (trip as any).meals ?? "",
    loading: (trip as any).loading ?? "",
    mealsTiffin: (trip as any).mealsTiffin ?? "",
    vehicleMaintenance: (trip as any).vehicleMaintenance ?? "",
    othersRC: (trip as any).othersRC ?? "",

    // Expenses Group 2 (Right Side - Dynamic Note Labels)
    others1Note: (trip as any).others1Note || "Driver (R)",
    others1Amt: (trip as any).others1Amt ?? "",
    others2Note: (trip as any).others2Note || "Supervisor (P)",
    others2Amt: (trip as any).others2Amt ?? "",
    others3Note: (trip as any).others3Note || "Others (RC)",
    others3Amt: (trip as any).others3Amt ?? "",
    others4Note: (trip as any).others4Note || "Others 4",
    others4Amt: (trip as any).others4Amt ?? "",
    others5Note: (trip as any).others5Note || "Others 5",
    others5Amt: (trip as any).others5Amt ?? "",

    // Odometer
    startMeter: Number((trip as any).startMeter ?? trip.openingMeter ?? 203469),
    endMeter: (trip as any).endMeter ?? (trip as any).endingReading ?? "",

    // Diesel Details
    dieselLtr1: (trip as any).dieselLtr1 ?? "",
    dieselRate1: (trip as any).dieselRate1 ?? "",
    dieselLtr2: (trip as any).dieselLtr2 ?? "",
    dieselRate2: (trip as any).dieselRate2 ?? "",
    dieselLtr3: (trip as any).dieselLtr3 ?? "",
    dieselRate3: (trip as any).dieselRate3 ?? "",

    // Remarks
    remarks: (trip as any).remarks || "",
  });

  const isSubmitted =
    trip.startStepSubmitted || Boolean(sheetData.submittedAtTimestamp);

  // Calculations
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

  const totalDistanceCovered = sheetData.endMeter
    ? Math.max(0, Number(sheetData.endMeter) - Number(sheetData.startMeter))
    : 0;

  const dieselAmt1 =
    Number(sheetData.dieselLtr1 || 0) * Number(sheetData.dieselRate1 || 0);
  const dieselAmt2 =
    Number(sheetData.dieselLtr2 || 0) * Number(sheetData.dieselRate2 || 0);
  const dieselAmt3 =
    Number(sheetData.dieselLtr3 || 0) * Number(sheetData.dieselRate3 || 0);

  const totalDieselLiters =
    Number(sheetData.dieselLtr1 || 0) +
    Number(sheetData.dieselLtr2 || 0) +
    Number(sheetData.dieselLtr3 || 0);

  const totalDieselAmount = dieselAmt1 + dieselAmt2 + dieselAmt3;

  const averageKmLtr =
    totalDieselLiters > 0
      ? (totalDistanceCovered / totalDieselLiters).toFixed(2)
      : "0.00";

  const remainingBalance =
    Number(sheetData.advance || 0) - totalAllExpenses - totalDieselAmount;

  const handleChange = (field: string, value: any) => {
    setErrorMsg("");
    const updated = { ...sheetData, [field]: value };
    setSheetData(updated);

    updateTrip({
      ...updated,
      advanceAmount: updated.advance,
      openingMeter: updated.startMeter,
    } as any);
  };

  const handleSubmit = async () => {
    if (!sheetData.endMeter && sheetData.endMeter !== 0) {
      setErrorMsg("End Meter Reading is required.");
      return;
    }

    if (Number(sheetData.endMeter) < sheetData.startMeter) {
      setErrorMsg(
        `End Meter Reading (${sheetData.endMeter}) must be greater than or equal to Start Meter Reading (${sheetData.startMeter}).`
      );
      return;
    }

    if (pickupTolls === undefined || pickupTolls < 0) {
      setErrorMsg("Total Toll Gates (Pickup) is mandatory from Step 2.");
      return;
    }

    if (destinationTolls === undefined || destinationTolls < 0) {
      setErrorMsg("Total Toll Gates (Destination) is mandatory from Step 2.");
      return;
    }

    setIsSubmitting(true);

    const capturedTimestamp =
      sheetData.submittedAtTimestamp || getCurrentFormattedDateTime();

    const finalData = {
      ...sheetData,
      date: capturedTimestamp,
      submittedAtTimestamp: capturedTimestamp,
      totalExpenses: totalAllExpenses,
      totalDieselAmount,
      totalDistanceCovered,
      averageKmLtr,
      remainingBalance,
      pickupTolls,
      destinationTolls,
    };

    setSheetData(finalData);

    const success = submitStartStep(finalData as any);
    if (success) {
      setIsLocalEditing(false);
    }
    setIsSubmitting(false);
  };

  if (trip.startStepSubmitted && !isEditingMode) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0">
              5
            </span>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">
              EXPENSES SHEET (SUBMITTED)
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                title="Edit Step"
              >
                <Pencil size={13} />
              </button>
            )}
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">
              Submitted & Locked
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-white border border-slate-200/80 p-2.5 rounded-lg text-left">
            <p className="text-[11px] text-slate-700 font-bold">Date & Time :</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5">
              {sheetData.submittedAtTimestamp || "--"}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 p-2.5 rounded-lg text-left">
            <p className="text-[11px] text-slate-700 font-bold">Vehicle No :</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5">
              {sheetData.vehicleNo}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 p-2.5 rounded-lg text-left">
            <p className="text-[11px] text-slate-700 font-bold">Advance ₹ :</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5">
              ₹{Number(sheetData.advance || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 p-2.5 rounded-lg text-left">
            <p className="text-[11px] text-slate-500 font-medium">
              Toll Gates (Pickup / Dest.) <span className="text-red-500">*</span>
            </p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5">
              {pickupTolls} / {destinationTolls}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 p-2.5 rounded-lg text-left">
            <p className="text-[11px] text-slate-500 font-medium">Total Expenses</p>
            <p className="text-xs font-semibold text-red-600 mt-0.5">
              ₹{totalAllExpenses.toFixed(2)}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 p-2.5 rounded-lg text-left">
            <p className="text-[11px] text-slate-500 font-medium">Total Diesel</p>
            <p className="text-xs font-semibold text-blue-600 mt-0.5">
              ₹{totalDieselAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 p-2.5 rounded-lg col-span-2 text-left">
            <p className="text-[11px] text-slate-500 font-medium">
              Remaining Balance
            </p>
            <p className="text-xs font-semibold text-emerald-600 mt-0.5">
              ₹{remainingBalance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .sheet-joined-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .sheet-joined-table th, 
        .sheet-joined-table td {
          border: 1px solid #e2e8f0;
          padding: 5px 10px;
          font-size: 0.8125rem;
          line-height: 1.2;
          text-align: left !important;
        }
        .sheet-joined-table input[type="number"]::-webkit-inner-spin-button,
        .sheet-joined-table input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        .sheet-joined-table input[type="number"] {
          -moz-appearance: textfield !important;
          appearance: textfield !important;
        }
        .sheet-joined-table input {
          width: 100%;
          outline: none;
          background: transparent;
          font-size: 0.8125rem;
          color: #0f172a;
          font-weight: 500;
          padding: 2px 4px;
          text-align: left !important;
        }
        .sheet-joined-table input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }
        .sheet-joined-table input:focus {
          background-color: #f8fafc;
        }
      `}</style>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0">
              5
            </span>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">
              EXPENSES SHEET
            </h2>
          </div>
          {isEditingMode && (
            <span className="text-[11px] text-slate-700 font-medium bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
              Editable View
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-2">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* JOINED TABLE */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="sheet-joined-table bg-white">
            <tbody>
              {/* HEADER ROW */}
              <tr className="bg-slate-50/70">
                <td colSpan={2} className="w-1/3">
                  <div className="flex items-center gap-1.5 justify-start">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1 shrink-0">
                      <Clock size={13} className="text-slate-500" />
                      Date & Time :
                    </span>
                    {isSubmitted ? (
                      <span className="font-semibold text-slate-900 text-xs">
                        {sheetData.submittedAtTimestamp}
                      </span>
                    ) : (
                      <span className="text-xs font-normal italic text-slate-400 select-none">
                        Auto Capture
                      </span>
                    )}
                  </div>
                </td>
                <td colSpan={1} className="w-1/3">
                  <div className="flex items-center gap-1 justify-start">
                    <span className="font-bold text-slate-800 text-xs whitespace-nowrap">
                      Vehicle No :
                    </span>
                    <input
                      type="text"
                      value={sheetData.vehicleNo}
                      onChange={(e) => handleChange("vehicleNo", e.target.value)}
                      className="font-semibold text-slate-900 text-xs uppercase"
                    />
                  </div>
                </td>
                <td colSpan={1} className="w-1/3">
                  <div className="flex items-center gap-1 justify-start">
                    <span className="font-bold text-slate-800 text-xs whitespace-nowrap">
                      Advance ₹ :
                    </span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={sheetData.advance}
                      onChange={(e) =>
                        handleChange(
                          "advance",
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="font-semibold text-slate-900 text-xs"
                    />
                  </div>
                </td>
              </tr>

              {/* EXPENSES ROWS */}
              <tr>
                <td className="font-medium text-slate-700 w-1/4">Meals</td>
                <td className="p-0 w-1/4">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.meals}
                    onChange={(e) =>
                      handleChange(
                        "meals",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
                <td className="p-0 w-1/4">
                  <input
                    type="text"
                    placeholder="Driver (R)"
                    value={sheetData.others1Note}
                    onChange={(e) => handleChange("others1Note", e.target.value)}
                    className="text-slate-600"
                  />
                </td>
                <td className="p-0 w-1/4">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.others1Amt}
                    onChange={(e) =>
                      handleChange(
                        "others1Amt",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
              </tr>

              <tr>
                <td className="font-medium text-slate-700">Loading</td>
                <td className="p-0">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.loading}
                    onChange={(e) =>
                      handleChange(
                        "loading",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="text"
                    placeholder="Supervisor (P)"
                    value={sheetData.others2Note}
                    onChange={(e) => handleChange("others2Note", e.target.value)}
                    className="text-slate-600"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.others2Amt}
                    onChange={(e) =>
                      handleChange(
                        "others2Amt",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
              </tr>

              <tr>
                <td className="font-medium text-slate-700">Meals / Tiffin</td>
                <td className="p-0">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.mealsTiffin}
                    onChange={(e) =>
                      handleChange(
                        "mealsTiffin",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="text"
                    placeholder="Others (RC)"
                    value={sheetData.others3Note}
                    onChange={(e) => handleChange("others3Note", e.target.value)}
                    className="text-slate-600"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.others3Amt}
                    onChange={(e) =>
                      handleChange(
                        "others3Amt",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
              </tr>

              <tr>
                <td className="font-medium text-slate-700">Vehicle Maintenance</td>
                <td className="p-0">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.vehicleMaintenance}
                    onChange={(e) =>
                      handleChange(
                        "vehicleMaintenance",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="text"
                    placeholder="Others 4"
                    value={sheetData.others4Note}
                    onChange={(e) => handleChange("others4Note", e.target.value)}
                    className="text-slate-600"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.others4Amt}
                    onChange={(e) =>
                      handleChange(
                        "others4Amt",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
              </tr>

              <tr>
                <td className="font-medium text-slate-700 bg-slate-50/30">Others (RC)</td>
                <td className="p-0 bg-slate-50/30">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.othersRC}
                    onChange={(e) =>
                      handleChange(
                        "othersRC",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="text"
                    placeholder="Others 5"
                    value={sheetData.others5Note}
                    onChange={(e) => handleChange("others5Note", e.target.value)}
                    className="text-slate-600"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={sheetData.others5Amt}
                    onChange={(e) =>
                      handleChange(
                        "others5Amt",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
              </tr>

              {/* EXPENSES TOTALS */}
              <tr className="bg-slate-50 font-bold text-slate-800 text-xs">
                <td>TOTAL (₹)</td>
                <td className="text-slate-900 pl-2">
                  {totalExpenses1.toFixed(2)}
                </td>
                <td>TOTAL (₹)</td>
                <td className="text-slate-900 pl-2">
                  {totalExpenses2.toFixed(2)}
                </td>
              </tr>

              {/* ODOMETER & TRAVEL DETAILS */}
              <tr>
                <td className="font-medium text-slate-700">Start Meter Reading</td>
                <td className="font-semibold text-slate-900 pl-2 select-none bg-slate-100/50">
                  {sheetData.startMeter}
                </td>
                <td className="font-medium text-slate-700">
                  Total Distance Covered (KM)
                </td>
                <td className="font-semibold text-slate-900 pl-2 bg-slate-50/50">
                  {totalDistanceCovered}
                </td>
              </tr>

              <tr>
                <td className="font-medium text-slate-700">
                  End Meter Reading <span className="text-red-500">*</span>
                </td>
                <td className="p-0">
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={sheetData.endMeter}
                    onChange={(e) => handleChange("endMeter", e.target.value)}
                    className="font-semibold text-blue-600"
                  />
                </td>
                <td className="font-medium text-slate-700">Average (KM/Ltr)</td>
                <td className="font-semibold text-blue-600 pl-2 bg-slate-50/50">
                  {averageKmLtr}
                </td>
              </tr>

              {/* NON-EDITABLE MANDATORY TOLL GATES */}
              <tr className="bg-slate-50/40">
                <td className="font-medium text-slate-700">
                  Total Toll Gates (Pickup) <span className="text-red-500">*</span>
                </td>
                <td className="font-semibold text-slate-900 pl-2 select-none bg-slate-100/50">
                  {pickupTolls}
                </td>
                <td className="font-medium text-slate-700">
                  Total Toll Gates (Destination) <span className="text-red-500">*</span>
                </td>
                <td className="font-semibold text-slate-900 pl-2 select-none bg-slate-100/50">
                  {destinationTolls}
                </td>
              </tr>

              {/* DIESEL DETAILS SUB-HEADER */}
              <tr className="bg-slate-50 font-bold text-slate-700 text-[11px] tracking-wider">
                <td className="py-1">DIESEL DETAILS</td>
                <td className="uppercase py-1">ENTRY - 1</td>
                <td className="uppercase py-1">ENTRY - 2</td>
                <td className="uppercase py-1">ENTRY - 3</td>
              </tr>

              {/* DIESEL ROWS */}
              <tr>
                <td className="font-medium text-slate-700">Diesel (Ltr)</td>
                <td className="p-0">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={sheetData.dieselLtr1}
                    onChange={(e) =>
                      handleChange(
                        "dieselLtr1",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={sheetData.dieselLtr2}
                    onChange={(e) =>
                      handleChange(
                        "dieselLtr2",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={sheetData.dieselLtr3}
                    onChange={(e) =>
                      handleChange(
                        "dieselLtr3",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
              </tr>

              <tr>
                <td className="font-medium text-slate-700">Rate (₹ / Ltr)</td>
                <td className="p-0">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={sheetData.dieselRate1}
                    onChange={(e) =>
                      handleChange(
                        "dieselRate1",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={sheetData.dieselRate2}
                    onChange={(e) =>
                      handleChange(
                        "dieselRate2",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
                <td className="p-0">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={sheetData.dieselRate3}
                    onChange={(e) =>
                      handleChange(
                        "dieselRate3",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="font-medium"
                  />
                </td>
              </tr>

              <tr className="bg-slate-50 font-bold text-slate-800 text-xs">
                <td>Amount (₹)</td>
                <td className="pl-2">{dieselAmt1.toFixed(2)}</td>
                <td className="pl-2">{dieselAmt2.toFixed(2)}</td>
                <td className="pl-2">{dieselAmt3.toFixed(2)}</td>
              </tr>

              {/* REMARKS */}
              <tr>
                <td colSpan={4} className="p-2">
                  <textarea
                    rows={2}
                    value={sheetData.remarks}
                    onChange={(e) => handleChange("remarks", e.target.value)}
                    placeholder="Enter optional trip notes or destination remarks..."
                    className="w-full text-xs font-medium text-slate-800 outline-none bg-transparent resize-none placeholder:text-slate-400 text-left"
                  />
                </td>
              </tr>

              {/* FOOTER TOTALS */}
              <tr className="bg-slate-50/90 font-bold text-xs text-slate-900 text-left">
                <td colSpan={1} className="py-2 pl-2">
                  Total Expenses:{" "}
                  <span className="text-red-600">
                    ₹{totalAllExpenses.toFixed(2)}
                  </span>
                </td>
                <td colSpan={1} className="py-2 pl-2">
                  Total Diesel:{" "}
                  <span className="text-blue-600">
                    ₹{totalDieselAmount.toFixed(2)}
                  </span>
                </td>
                <td colSpan={2} className="py-2 pl-2">
                  Balance Remaining:{" "}
                  <span className="text-emerald-600">
                    ₹{remainingBalance.toFixed(2)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
          {!trip.startStepSubmitted && !isEditingMode && (
            <button
              type="button"
              onClick={clearForm}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95"
            >
              Clear Form
            </button>
          )}

          {isEditingMode && (
            <button
              type="button"
              onClick={() => {
                if (editable && onCancel) onCancel();
                else setIsLocalEditing(false);
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <X size={13} /> Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubmitting
              ? "Saving..."
              : isEditingMode || trip.startStepSubmitted
              ? "Update Expenses Sheet"
              : "Submit Expenses Sheet"}
          </button>
        </div>
      </div>
    </>
  );
}