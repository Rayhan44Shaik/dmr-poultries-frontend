// src/modules/operations/vehicle-trips/components/Step_5/GeneralExpensesTable.tsx

import React, { useRef } from "react";
import { Lock, UtensilsCrossed, Package, Coffee, Wrench, Landmark, Users, MoreHorizontal } from "lucide-react";
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
  trip: _trip,
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
  /** Blur on wheel so focused number fields don't nudge values while scrolling.
   *  Do not call preventDefault — React registers wheel as passive. */
  const blockWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  /** Shared number-input class: no spinners, no accidental scroll edits. */
  const numInputClass =
    "font-medium w-full p-2.5 outline-none bg-transparent tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const formatZero = (val: any) => {
    if (val === undefined || val === null || val === "") return "";
    return Number(val) === 0 ? "" : val;
  };

  /** Indian grouping: 1,000.00 / 1,00,000.00 */
  const formatInrAmt = (val: unknown) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n === 0) return "—";
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const formatInrPlain = (n: number) =>
    Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


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
  // End meter may equal, but cannot be below, the latest trip reading.
  const isEndMeterInvalid =
    hasEndMeter &&
    requiredMinMeter > 0 &&
    Number.isFinite(currentEndMeter) &&
    currentEndMeter < requiredMinMeter;
  const endMeterErrorMsg = isEndMeterInvalid
    ? t("ops.trip.meter_must_gt", { min: requiredMinMeter })
    : null;

  // Distance & average
  const computedDistance =
    hasEndMeter && actualStartMeter > 0 && currentEndMeter >= actualStartMeter
      ? currentEndMeter - actualStartMeter
      : totalDistanceCovered > 0
      ? totalDistanceCovered
      : 0;

  let totalDieselLiters = 0;
  // Sum every submitted diesel slot — no max row count.
  const dieselKeys = Object.keys(sheetData || {}).filter((k) => /^dieselSubmitted\d+$/.test(k));
  for (const key of dieselKeys) {
    const i = Number(key.replace("dieselSubmitted", ""));
    if (!Number.isFinite(i) || i < 1) continue;
    if (!sheetData[`dieselSubmitted${i}`]) continue;
    totalDieselLiters += Number(sheetData[`dieselLtr${i}`] || 0);
  }
  const computedAverage =
    computedDistance > 0 && totalDieselLiters > 0
      ? (computedDistance / totalDieselLiters).toFixed(2)
      : null;
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
      {/* Date / Vehicle / Advance removed from table top — shown as separate summary cards in StepEnd. */}
      <table className="sheet-joined-table w-full border-collapse">
        <tbody>
          <tr className="bg-gradient-to-r from-violet-50 via-slate-50 to-amber-50 text-[12px] font-bold text-slate-600 border-b border-slate-200">
            <td className="py-2 px-3 w-[28%]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-md bg-violet-50/80 text-violet-500 flex items-center justify-center">
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
                <span className="h-5 w-5 rounded-md bg-amber-50/80 text-amber-500 flex items-center justify-center">
                  <Users size={11} />
                </span>
                {t("ops.trip.expense_category")}
              </span>
            </td>
            <td colSpan={2} className="py-2 px-3 w-[22%]">
              {t("ops.trip.amount_inr")}
            </td>
          </tr>

          {/* Expense rows — always two equal columns (left group + right group),
              same layout for editable and submitted/read-only views. */}
          {(() => {
            /** Left column categories (ops group) paired with right column (people / other). */
            const leftItems: Array<{
              key: string;
              label: string;
              value: unknown;
              tone: string;
              Icon: React.ComponentType<{ size?: number; className?: string }>;
              field?: string;
            }> = [
              { key: "meals", label: t("ops.trip.exp_meals"), value: sheetData.meals, tone: "bg-orange-50/70 text-orange-500", Icon: UtensilsCrossed, field: "meals" },
              { key: "loading", label: t("ops.trip.exp_loading"), value: sheetData.loading, tone: "bg-blue-50/70 text-blue-500", Icon: Package, field: "loading" },
              { key: "mealsTiffin", label: t("ops.trip.exp_meals_tiffin"), value: sheetData.mealsTiffin, tone: "bg-amber-50/70 text-amber-500", Icon: Coffee, field: "mealsTiffin" },
              { key: "vehicleMaintenance", label: t("ops.trip.exp_vehicle_maintenance"), value: sheetData.vehicleMaintenance, tone: "bg-slate-100 text-slate-600", Icon: Wrench, field: "vehicleMaintenance" },
              { key: "othersRC", label: t("ops.trip.exp_tea"), value: sheetData.othersRC, tone: "bg-rose-50/70 text-rose-500", Icon: Coffee, field: "othersRC" },
            ];
            const rightItems: Array<{
              key: string;
              label: string;
              value: unknown;
              tone: string;
              Icon: React.ComponentType<{ size?: number; className?: string }>;
              field?: string;
              rightBg?: string;
              nameField?: string;
            }> = [
              { key: "others1Amt", label: t("ops.trip.exp_rto"), value: sheetData.others1Amt, tone: "bg-indigo-50/70 text-indigo-500", Icon: Landmark, field: "others1Amt", rightBg: "bg-indigo-50/40" },
              { key: "others2Amt", label: sheetData.others2Name || t("common.other"), value: sheetData.others2Amt, tone: "bg-slate-100 text-slate-500", Icon: MoreHorizontal, field: "others2Amt", nameField: "others2Name", rightBg: "bg-slate-50/50" },
              { key: "others3Amt", label: sheetData.others3Name || t("common.other"), value: sheetData.others3Amt, tone: "bg-slate-100 text-slate-500", Icon: MoreHorizontal, field: "others3Amt", nameField: "others3Name", rightBg: "bg-slate-50/50" },
              { key: "others4Amt", label: sheetData.others4Name || t("common.other"), value: sheetData.others4Amt, tone: "bg-slate-100 text-slate-500", Icon: MoreHorizontal, field: "others4Amt", nameField: "others4Name", rightBg: "bg-slate-50/50" },
              { key: "others5Amt", label: sheetData.others5Name || t("common.other"), value: sheetData.others5Amt, tone: "bg-slate-100 text-slate-500", Icon: MoreHorizontal, field: "others5Amt", nameField: "others5Name", rightBg: "bg-slate-50/50" },
            ];

            const rowCount = Math.max(leftItems.length, rightItems.length);
            const rows: React.ReactNode[] = [];
            for (let i = 0; i < rowCount; i++) {
              const left = leftItems[i];
              const right = rightItems[i];
              // In read-only, skip a paired row only when BOTH sides are empty/zero.
              if (readOnly) {
                const leftEmpty = !left || !(Number(left.value) > 0);
                const rightEmpty = !right || !(Number(right.value) > 0);
                if (leftEmpty && rightEmpty) continue;
              }
              rows.push(
                <tr
                  key={`exp-row-${i}`}
                  className={`border-b border-slate-100 ${readOnly ? "" : "hover:bg-slate-50/40 transition-colors"}`}
                >
                  <td className="font-medium text-slate-700 py-2.5 px-3 w-[28%]">
                    {left ? (
                      <span className="inline-flex items-center gap-2">
                        <CatIcon icon={left.Icon} tone={left.tone} />
                        {left.label}
                      </span>
                    ) : null}
                  </td>
                  <td colSpan={2} className={`border-r border-slate-200 w-[22%] ${readOnly ? "font-semibold text-slate-900 px-3 tabular-nums" : "p-0"}`}>
                    {left ? (
                      readOnly ? (
                        formatInrAmt(left.value)
                      ) : (
                        <input
                          type="number"
                          min="0"
                          placeholder="0.00"
                          value={formatZero(left.value)}
                          onKeyDown={blockInvalidChar}
                          onChange={(e) =>
                            handleChange(left.field!, e.target.value === "" ? "" : Number(e.target.value))
                          }
                          onWheel={blockWheelChange}
                          className={numInputClass}
                        />
                      )
                    ) : null}
                  </td>
                  <td
                    colSpan={2}
                    className={`font-medium text-slate-700 py-2.5 px-3 border-r border-slate-200 w-[28%] ${right?.rightBg ?? ""}`}
                  >
                    {right ? (
                      <span className="inline-flex items-center gap-2">
                        <CatIcon icon={right.Icon} tone={right.tone} />
                        {right.nameField && !readOnly ? (
                          <input
                            type="text"
                            maxLength={120}
                            value={sheetData[right.nameField] || ""}
                            onChange={(event) => handleChange(right.nameField!, event.target.value)}
                            placeholder={t("ops.trip.other_expense_name")}
                            className="min-w-0 w-full bg-transparent text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400"
                          />
                        ) : right.label}
                      </span>
                    ) : null}
                  </td>
                  <td colSpan={2} className={`w-[22%] ${readOnly ? "font-semibold text-slate-900 px-3 tabular-nums" : "p-0"}`}>
                    {right ? (
                      readOnly ? (
                        formatInrAmt(right.value)
                      ) : (
                        <input
                          type="number"
                          min="0"
                          placeholder="0.00"
                          value={formatZero(right.value)}
                          onKeyDown={blockInvalidChar}
                          onChange={(e) =>
                            handleChange(right.field!, e.target.value === "" ? "" : Number(e.target.value))
                          }
                          onWheel={blockWheelChange}
                          className={numInputClass}
                        />
                      )
                    ) : null}
                  </td>
                </tr>
              );
            }
            return <>{rows}</>;
          })()}

          <tr className="bg-slate-100/80 font-bold text-slate-800 text-[13px] border-b border-slate-200">
            <td className="py-2.5 px-3">{t("common.total")} (₹)</td>
            <td colSpan={2} className="text-slate-900 px-3 border-r border-slate-200 tabular-nums">
              {formatInrPlain(totalExpenses1)}
            </td>
            <td colSpan={2} className="py-2.5 px-3 border-r border-slate-200">
              {t("common.total")} (₹)
            </td>
            <td colSpan={2} className="text-slate-900 px-3 tabular-nums">
              {formatInrPlain(totalExpenses2)}
            </td>
          </tr>
          <tr className="bg-emerald-50/80 font-bold text-slate-800 text-[13px] border-b border-slate-200">
            <td className="py-2.5 px-3" colSpan={5}>
              {t("ops.trip.combined_expense_total")}
            </td>
            <td colSpan={2} className="text-slate-900 px-3 tabular-nums">
              {formatInrPlain(totalExpenses1 + totalExpenses2)}
            </td>
          </tr>

          {/* ODOMETER — compact single-line rows (same height as Total Pickup Tolls) */}
          <tr className="border-b border-slate-100">
            <td className="font-medium text-slate-700 py-2 px-3 align-middle text-[13px]">
              <span className="inline-flex items-center gap-1">
                {t("ops.trip.start_meter_reading")}
                <span className="inline-flex items-center cursor-help">
                  <Lock size={11} className="text-slate-400" />
                </span>
              </span>
            </td>
            <td
              colSpan={2}
              className="font-semibold text-slate-900 px-3 py-2 bg-slate-100/60 border-r border-slate-200 select-none align-middle text-[13px] tabular-nums"
            >
              {actualStartMeter > 0 ? `${actualStartMeter} KM` : "---"}
            </td>
            <td colSpan={2} className="font-medium text-slate-700 px-3 py-2 border-r border-slate-200 bg-slate-50/30 align-middle text-[13px]">
              {t("ops.trip.total_distance_km")}
            </td>
            <td colSpan={2} className="font-semibold text-slate-900 px-3 py-2 bg-slate-50/50 align-middle text-[13px] tabular-nums">
              {computedDistance > 0 ? computedDistance : "---"}
            </td>
          </tr>

          <tr className="border-b border-slate-200">
            <td className="font-medium text-slate-700 py-2 px-3 align-middle text-[13px]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1 shrink-0">
                  {t("ops.trip.field.end_meter")}
                  {TRIP_FIELD_DEFINITIONS.closingMeter.required && <span className="text-red-500">*</span>}
                </span>
                {/* Validation sits beside the End Meter heading — neat, readable, single place */}
                {endMeterErrorMsg ? (
                  <span
                    className="inline-flex items-center max-w-[min(18rem,55vw)] rounded-md border border-red-100 bg-red-50/70 px-2 py-0.5 text-[11px] font-semibold text-red-500 leading-snug"
                    role="alert"
                  >
                    {endMeterErrorMsg}
                  </span>
                ) : requiredMinMeter > 0 ? (
                  <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                    ≥ {requiredMinMeter} KM
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
                      val !== "" && requiredMinMeter > 0 && Number.isFinite(n) && n < requiredMinMeter;
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
                  className={`w-full max-w-[7.5rem] font-semibold text-[13px] tabular-nums outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    isEndMeterInvalid ? "text-red-500" : "text-slate-900"
                  }`}
                />
                <span className="text-[11px] font-semibold text-slate-400 shrink-0">KM</span>
              </div>
            </td>
            <td colSpan={2} className="font-medium text-slate-700 px-3 py-2 border-r border-slate-200 bg-slate-50/30 align-middle text-[13px]">
              {t("ops.trip.average_km_ltr")}
            </td>
            <td colSpan={2} className="font-semibold text-blue-500 px-3 py-2 bg-slate-50/50 align-middle text-[13px]">
              {computedAverage ? computedAverage : t("ops.trip.not_available")}
            </td>
          </tr>

          <tr className="bg-slate-50/50 border-b border-slate-100">
            <td className="font-medium text-slate-700 py-2 px-3 align-middle text-[13px]">
              {t("ops.trip.total_toll_pickup")} <span className="text-red-500">*</span>
            </td>
            <td colSpan={2} className="font-semibold text-slate-900 px-3 py-2 select-none border-r border-slate-200 align-middle text-[13px] tabular-nums">
              {pickupTolls}
            </td>
            <td colSpan={2} className="font-medium text-slate-700 px-3 py-2 border-r border-slate-200 bg-slate-50/30 align-middle text-[13px]">
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
                className="font-semibold text-blue-500 text-[13px] w-full px-3 py-2 outline-none bg-transparent tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
