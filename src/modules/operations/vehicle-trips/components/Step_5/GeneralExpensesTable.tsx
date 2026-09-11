// src/modules/operations/vehicle-trips/components/Step_5/GeneralExpensesTable.tsx

import React, { useRef } from "react";
import { Clock, Lock, Truck, Wallet, UtensilsCrossed, Package, Coffee, Wrench, User, UserCheck, Users, MoreHorizontal } from "lucide-react";
import { TRIP_FIELD_DEFINITIONS } from "../../../../../shared/trip/definitions";
import { useI18n } from "../../../../../i18n";

interface GeneralExpensesTableProps {
  sheetData: any;
  handleChange: (field: string, value: any) => void;
  pickupTolls: number;
  totalExpenses1: number;
  totalExpenses2: number;
  totalAllExpenses: number;
  totalDistanceCovered: number;
  averageKmLtr: string;
  openingMeter: number;
  destMeter: number;
  trip?: any;
  readOnly?: boolean;
  onMeterNotice?: (message: string) => void;
}

export default function GeneralExpensesTable({
  sheetData,
  handleChange,
  pickupTolls,
  totalExpenses1,
  totalExpenses2,
  totalAllExpenses: _totalAllExpenses,
  totalDistanceCovered,
  averageKmLtr: _averageKmLtr,
  openingMeter,
  destMeter,
  trip,
  readOnly = false,
  onMeterNotice,
}: GeneralExpensesTableProps) {
  const { t } = useI18n();
  const meterInvalidRef = useRef(false);
  const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
  };
  /** Block mouse-wheel from changing focused number values. */
  const blockWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
    e.preventDefault();
  };

  /** Shared number-input class: no spinners, no accidental scroll edits. */
  const numInputClass =
    "font-medium w-full p-2.5 outline-none bg-transparent tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const formatZero = (val: any) => {
    if (val === undefined || val === null || val === "") return "";
    return Number(val) === 0 ? "" : val;
  };

  // Locked start meter (from trip)
  const actualStartMeter = openingMeter || 0;
  const actualDestMeter = destMeter || 0;

  // Compute highest diesel meter from sheetData
  let highestDieselMeter = 0;
  if (sheetData) {
    Object.keys(sheetData).forEach((key) => {
      if (key.startsWith("dieselMeter")) {
        const val = Number(sheetData[key]);
        if (!isNaN(val) && val > highestDieselMeter) {
          highestDieselMeter = val;
        }
      }
    });
  }

  // Min required for endMeter
  let requiredMinMeter = actualStartMeter;
  if (actualDestMeter > requiredMinMeter) {
    requiredMinMeter = actualDestMeter;
  }
  if (highestDieselMeter > requiredMinMeter) {
    requiredMinMeter = highestDieselMeter;
  }

  const currentEndMeter = Number(sheetData.endMeter);
  const hasEndMeter = sheetData.endMeter !== undefined && sheetData.endMeter !== null && sheetData.endMeter !== "";
  // End meter must be STRICTLY greater than the highest of: start / farm dest / any diesel reading.
  const isEndMeterInvalid =
    hasEndMeter &&
    requiredMinMeter > 0 &&
    Number.isFinite(currentEndMeter) &&
    currentEndMeter <= requiredMinMeter;
  const endMeterErrorMsg = isEndMeterInvalid
    ? t("ops.trip.meter_must_gt", { min: requiredMinMeter })
    : null;

  // Distance & average
  const computedDistance =
    hasEndMeter && actualStartMeter > 0 && currentEndMeter > actualStartMeter
      ? currentEndMeter - actualStartMeter
      : totalDistanceCovered > 0
      ? totalDistanceCovered
      : 0;

  let totalDieselLiters = 0;
  for (let i = 1; i <= 6; i++) {
    if (!sheetData[`dieselSubmitted${i}`]) continue;
    totalDieselLiters += Number(sheetData[`dieselLtr${i}`] || 0);
  }
  const computedAverage =
    computedDistance > 0 && totalDieselLiters > 0
      ? (computedDistance / totalDieselLiters).toFixed(2)
      : null;
  const vehicleNo = trip?.vehicleNo || sheetData.vehicleNo || "";
  const advance = trip?.advanceAmount ?? sheetData.advance ?? "";
  const timestamp = trip?.expensesStepSubmittedAt || sheetData.submittedAtTimestamp || t("ops.trip.captured_on_first_submit");

  /** Coloured icon chip for expense category labels. */
  const CatIcon = ({
    icon: Icon,
    tone,
  }: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    tone: string;
  }) => (
    <span className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
      <Icon size={13} />
    </span>
  );

  return (
    <div className="rounded-xl border border-slate-200 overflow-x-auto shadow-xs bg-white">
      {/* Metadata row — colour logos for Date/Time, Vehicle, Advance */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 text-xs">
        <div className="py-3 px-3.5 flex items-center gap-2.5 border-b md:border-b-0 md:border-r border-slate-200">
          <span className="h-8 w-8 rounded-lg bg-sky-100 text-sky-600 border border-sky-200/70 flex items-center justify-center shrink-0 shadow-sm">
            <Clock size={15} />
          </span>
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700/80">
              {t("ops.trip.date_time")}
            </span>
            <span className="font-semibold text-slate-900 truncate text-[12px]">
              {timestamp}
            </span>
          </div>
        </div>

        <div className="py-3 px-3.5 flex items-center gap-2.5 border-b md:border-b-0 md:border-r border-slate-200">
          <span className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-600 border border-indigo-200/70 flex items-center justify-center shrink-0 shadow-sm">
            <Truck size={15} />
          </span>
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700/80">
              {t("operations.vehicle_no")}
            </span>
            <span className="font-bold text-indigo-700 uppercase truncate text-[12px] tracking-wide">
              {vehicleNo || "--"}
            </span>
          </div>
        </div>

        <div className="py-3 px-3.5 flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 border border-emerald-200/70 flex items-center justify-center shrink-0 shadow-sm">
            <Wallet size={15} />
          </span>
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/80">
              {t("operations.advance")}
            </span>
            <span className="font-bold text-emerald-700 text-[12px] tabular-nums">
              {advance === "" || advance == null
                ? "--"
                : `₹ ${Number(advance).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          </div>
        </div>
      </div>

      <table className="sheet-joined-table w-full border-collapse">
        <tbody>
          <tr className="bg-gradient-to-r from-violet-50 via-slate-50 to-amber-50 text-[11px] font-bold text-slate-600 border-b border-slate-200">
            <td className="py-2 px-3 w-[28%]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-md bg-violet-100 text-violet-600 flex items-center justify-center">
                  <Package size={11} />
                </span>
                {t("ops.trip.expense_category")}
              </span>
            </td>
            <td colSpan={2} className="py-2 px-3 w-[22%] border-r border-slate-200">
              {t("ops.trip.amount_inr")}
            </td>
            <td colSpan={2} className="py-2 px-3 w-[28%] border-r border-slate-200">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Users size={11} />
                </span>
                {t("ops.trip.expense_category")}
              </span>
            </td>
            <td colSpan={2} className="py-2 px-3 w-[22%]">
              {t("ops.trip.amount_inr")}
            </td>
          </tr>

          {/* Expense rows */}
          {readOnly ? (
            <>
              {[
                [t("ops.trip.exp_meals"), sheetData.meals, "bg-orange-50 text-orange-600", UtensilsCrossed],
                [t("ops.trip.exp_loading"), sheetData.loading, "bg-blue-50 text-blue-600", Package],
                [t("ops.trip.exp_meals_tiffin"), sheetData.mealsTiffin, "bg-amber-50 text-amber-600", Coffee],
                [t("ops.trip.exp_vehicle_maintenance"), sheetData.vehicleMaintenance, "bg-slate-100 text-slate-600", Wrench],
                [t("ops.trip.exp_tea"), sheetData.othersRC, "bg-rose-50 text-rose-600", Coffee],
                [t("ops.trip.exp_driver"), sheetData.others1Amt, "bg-indigo-50 text-indigo-600", User],
                [t("ops.trip.exp_supervisor"), sheetData.others2Amt, "bg-violet-50 text-violet-600", UserCheck],
                [t("ops.trip.exp_helper_loader"), sheetData.others3Amt, "bg-teal-50 text-teal-600", Users],
                [t("common.other"), sheetData.others4Amt, "bg-slate-100 text-slate-500", MoreHorizontal],
                [t("common.other"), sheetData.others5Amt, "bg-slate-100 text-slate-500", MoreHorizontal],
              ]
                .filter(([, amt]) => Number(amt) > 0)
                .map(([label, amt, tone, Icon], i) => (
                  <tr key={`${label}-${i}`} className="border-b border-slate-100">
                    <td className="font-medium text-slate-700 py-2.5 px-3">
                      <span className="inline-flex items-center gap-2">
                        <CatIcon icon={Icon as React.ComponentType<{ size?: number; className?: string }>} tone={String(tone)} />
                        {label as string}
                      </span>
                    </td>
                    <td colSpan={6} className="font-semibold text-slate-900 px-3 tabular-nums">₹{Number(amt).toFixed(2)}</td>
                  </tr>
                ))}
            </>
          ) : (
            <>
          <tr className="border-b border-slate-100 hover:bg-orange-50/30 transition-colors">
            <td className="font-medium text-slate-700 py-2.5 px-3">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={UtensilsCrossed} tone="bg-orange-50 text-orange-600" />
                {t("ops.trip.exp_meals")}
              </span>
            </td>
            <td colSpan={2} className="p-0 border-r border-slate-200">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.meals)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("meals", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
            <td colSpan={2} className="font-medium text-slate-700 py-2.5 px-3 border-r border-slate-200 bg-indigo-50/40">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={User} tone="bg-indigo-100 text-indigo-600" />
                {t("ops.trip.exp_driver")}
              </span>
            </td>
            <td colSpan={2} className="p-0">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.others1Amt)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("others1Amt", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
          </tr>

          <tr className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
            <td className="font-medium text-slate-700 py-2.5 px-3">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={Package} tone="bg-blue-50 text-blue-600" />
                {t("ops.trip.exp_loading")}
              </span>
            </td>
            <td colSpan={2} className="p-0 border-r border-slate-200">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.loading)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("loading", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
            <td colSpan={2} className="font-medium text-slate-700 py-2.5 px-3 border-r border-slate-200 bg-violet-50/40">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={UserCheck} tone="bg-violet-100 text-violet-600" />
                {t("ops.trip.exp_supervisor")}
              </span>
            </td>
            <td colSpan={2} className="p-0">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.others2Amt)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("others2Amt", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
          </tr>

          <tr className="border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
            <td className="font-medium text-slate-700 py-2.5 px-3">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={Coffee} tone="bg-amber-50 text-amber-600" />
                {t("ops.trip.exp_meals_tiffin")}
              </span>
            </td>
            <td colSpan={2} className="p-0 border-r border-slate-200">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.mealsTiffin)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("mealsTiffin", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
            <td colSpan={2} className="font-medium text-slate-700 py-2.5 px-3 border-r border-slate-200 bg-teal-50/40">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={Users} tone="bg-teal-100 text-teal-600" />
                {t("ops.trip.exp_helper_loader")}
              </span>
            </td>
            <td colSpan={2} className="p-0">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.others3Amt)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("others3Amt", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
          </tr>

          <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
            <td className="font-medium text-slate-700 py-2.5 px-3">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={Wrench} tone="bg-slate-100 text-slate-600" />
                {t("ops.trip.exp_vehicle_maintenance")}
              </span>
            </td>
            <td colSpan={2} className="p-0 border-r border-slate-200">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.vehicleMaintenance)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("vehicleMaintenance", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
            <td colSpan={2} className="font-medium text-slate-700 py-2.5 px-3 border-r border-slate-200 bg-slate-50/50">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={MoreHorizontal} tone="bg-slate-100 text-slate-500" />
                {t("common.other")}
              </span>
            </td>
            <td colSpan={2} className="p-0">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.others4Amt)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("others4Amt", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
          </tr>

          <tr className="border-b border-slate-100 hover:bg-rose-50/30 transition-colors">
            <td className="font-medium text-slate-700 py-2.5 px-3">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={Coffee} tone="bg-rose-50 text-rose-600" />
                {t("ops.trip.exp_tea")}
              </span>
            </td>
            <td colSpan={2} className="p-0 border-r border-slate-200">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.othersRC)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("othersRC", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
            <td colSpan={2} className="font-medium text-slate-700 py-2.5 px-3 border-r border-slate-200 bg-slate-50/50">
              <span className="inline-flex items-center gap-2">
                <CatIcon icon={MoreHorizontal} tone="bg-slate-100 text-slate-500" />
                {t("common.other")}
              </span>
            </td>
            <td colSpan={2} className="p-0">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={formatZero(sheetData.others5Amt)}
                onKeyDown={blockInvalidChar}
                onChange={(e) =>
                  handleChange("others5Amt", e.target.value === "" ? "" : Number(e.target.value))
                }
                onWheel={blockWheelChange}
                className={numInputClass}
              />
            </td>
          </tr>
            </>
          )}

          <tr className="bg-slate-100/80 font-bold text-slate-800 text-xs border-b border-slate-200">
            <td className="py-2.5 px-3">{t("common.total")} (₹)</td>
            <td colSpan={2} className="text-slate-900 px-3 border-r border-slate-200">
              {totalExpenses1.toFixed(2)}
            </td>
            <td colSpan={2} className="py-2.5 px-3 border-r border-slate-200">
              {t("common.total")} (₹)
            </td>
            <td colSpan={2} className="text-slate-900 px-3">
              {totalExpenses2.toFixed(2)}
            </td>
          </tr>
          <tr className="bg-emerald-50/80 font-bold text-slate-800 text-xs border-b border-slate-200">
            <td className="py-2.5 px-3" colSpan={5}>
              {t("ops.trip.combined_expense_total")}
            </td>
            <td colSpan={2} className="text-slate-900 px-3">
              {(totalExpenses1 + totalExpenses2).toFixed(2)}
            </td>
          </tr>

          {/* ODOMETER — compact single-line rows (same height as Total Pickup Tolls) */}
          <tr className="border-b border-slate-100">
            <td className="font-medium text-slate-700 py-2 px-3 align-middle text-xs">
              <span className="inline-flex items-center gap-1">
                {t("ops.trip.start_meter_reading")}
                <span title={t("ops.trip.locked_from_step1")} className="inline-flex items-center cursor-help">
                  <Lock size={11} className="text-slate-400" />
                </span>
              </span>
            </td>
            <td
              colSpan={2}
              className="font-semibold text-slate-900 px-3 py-2 bg-slate-100/60 border-r border-slate-200 select-none align-middle text-xs tabular-nums"
            >
              {actualStartMeter > 0 ? `${actualStartMeter} KM` : "---"}
            </td>
            <td colSpan={2} className="font-medium text-slate-700 px-3 py-2 border-r border-slate-200 bg-slate-50/30 align-middle text-xs">
              {t("ops.trip.total_distance_km")}
            </td>
            <td colSpan={2} className="font-semibold text-slate-900 px-3 py-2 bg-slate-50/50 align-middle text-xs tabular-nums">
              {computedDistance > 0 ? computedDistance : "---"}
            </td>
          </tr>

          <tr className="border-b border-slate-200">
            <td className="font-medium text-slate-700 py-2 px-3 align-middle text-xs">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1 shrink-0">
                  {t("ops.trip.field.end_meter")}
                  {TRIP_FIELD_DEFINITIONS.closingMeter.required && <span className="text-red-500">*</span>}
                </span>
                {/* Validation sits beside the End Meter heading — neat, readable, single place */}
                {endMeterErrorMsg ? (
                  <span
                    className="inline-flex items-center max-w-[min(18rem,55vw)] rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 leading-snug"
                    role="alert"
                    title={endMeterErrorMsg}
                  >
                    {endMeterErrorMsg}
                  </span>
                ) : requiredMinMeter > 0 ? (
                  <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                    &gt; {requiredMinMeter} KM
                  </span>
                ) : null}
              </div>
            </td>
            <td
              colSpan={2}
              className={`px-3 py-2 border-r border-slate-200 align-middle ${
                isEndMeterInvalid ? "bg-red-50/60" : "bg-white"
              }`}
            >
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  required
                  inputMode="numeric"
                  placeholder="0"
                  value={formatZero(sheetData.endMeter)}
                  onKeyDown={blockInvalidChar}
                  onWheel={blockWheelChange}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange("endMeter", val);
                    const n = Number(val);
                    const invalid =
                      val !== "" && requiredMinMeter > 0 && Number.isFinite(n) && n <= requiredMinMeter;
                    if (invalid) {
                      const msg = t("ops.trip.meter_must_gt", { min: requiredMinMeter });
                      if (!meterInvalidRef.current) {
                        meterInvalidRef.current = true;
                        onMeterNotice?.(msg);
                      }
                    } else {
                      meterInvalidRef.current = false;
                    }
                  }}
                  onBlur={() => {
                    if (isEndMeterInvalid && endMeterErrorMsg) {
                      meterInvalidRef.current = true;
                      onMeterNotice?.(endMeterErrorMsg);
                    }
                  }}
                  aria-invalid={isEndMeterInvalid}
                  title={endMeterErrorMsg || undefined}
                  className={`w-full max-w-[7.5rem] font-semibold text-xs tabular-nums outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    isEndMeterInvalid ? "text-red-600" : "text-slate-900"
                  }`}
                />
                <span className="text-[10px] font-semibold text-slate-400 shrink-0">KM</span>
              </div>
            </td>
            <td colSpan={2} className="font-medium text-slate-700 px-3 py-2 border-r border-slate-200 bg-slate-50/30 align-middle text-xs">
              {t("ops.trip.average_km_ltr")}
            </td>
            <td colSpan={2} className="font-semibold text-blue-600 px-3 py-2 bg-slate-50/50 align-middle text-xs">
              {computedAverage ? computedAverage : t("ops.trip.not_available")}
            </td>
          </tr>

          <tr className="bg-slate-50/50 border-b border-slate-100">
            <td className="font-medium text-slate-700 py-2 px-3 align-middle text-xs">
              {t("ops.trip.total_toll_pickup")} <span className="text-red-500">*</span>
            </td>
            <td colSpan={2} className="font-semibold text-slate-900 px-3 py-2 select-none border-r border-slate-200 align-middle text-xs tabular-nums">
              {pickupTolls}
            </td>
            <td colSpan={2} className="font-medium text-slate-700 px-3 py-2 border-r border-slate-200 bg-slate-50/30 align-middle text-xs">
              {t("ops.trip.field.delivery_tolls")}{" "}
              {TRIP_FIELD_DEFINITIONS.deliveryTolls.required && <span className="text-red-500">*</span>}
            </td>
            <td colSpan={2} className="p-0 align-middle">
              <input
                type="number"
                step="1"
                min="0"
                required
                placeholder="0"
                value={formatZero(sheetData.destinationTolls)}
                onKeyDown={blockInvalidChar}
                onChange={(e) => {
                  const val = e.target.value;
                  handleChange("destinationTolls", val === "" ? "" : Math.floor(Number(val)));
                }}
                onWheel={blockWheelChange}
                className="font-semibold text-blue-600 text-xs w-full px-3 py-2 outline-none bg-transparent tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
