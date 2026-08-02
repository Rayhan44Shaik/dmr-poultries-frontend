import React from "react";
import { Clock } from "lucide-react";

interface GeneralExpensesTableProps {
  sheetData: any;
  handleChange: (field: string, value: any) => void;
  pickupTolls: number;
  totalExpenses1: number;
  totalExpenses2: number;
  totalAllExpenses: number;
  totalDistanceCovered: number;
  averageKmLtr: string;
}

export default function GeneralExpensesTable({
  sheetData,
  handleChange,
  pickupTolls,
  totalExpenses1,
  totalExpenses2,
  totalAllExpenses,
  totalDistanceCovered,
  averageKmLtr,
}: GeneralExpensesTableProps) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-x-auto">
      <table className="sheet-joined-table bg-white min-w-[750px]">
        <tbody>
          {/* DATE, VEHICLE & ADVANCE */}
          <tr className="bg-slate-50/70">
            <td colSpan={3}>
              <div className="flex items-center gap-1.5 justify-start">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1 shrink-0">
                  <Clock size={13} className="text-slate-500" />
                  Date & Time :
                </span>
                <span className="font-semibold text-slate-900 text-xs">
                  {sheetData.submittedAtTimestamp || "Captured on first submit"}
                </span>
              </div>
            </td>
            <td colSpan={2}>
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
            <td colSpan={2}>
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
            <td className="font-medium text-slate-700">Meals</td>
            <td colSpan={2} className="p-0">
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
            <td colSpan={2} className="p-0">
              <input
                type="text"
                placeholder="Driver (R)"
                value={sheetData.others1Note}
                onChange={(e) => handleChange("others1Note", e.target.value)}
                className="text-slate-600"
              />
            </td>
            <td colSpan={2} className="p-0">
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
            <td colSpan={2} className="p-0">
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
            <td colSpan={2} className="p-0">
              <input
                type="text"
                placeholder="Supervisor (P)"
                value={sheetData.others2Note}
                onChange={(e) => handleChange("others2Note", e.target.value)}
                className="text-slate-600"
              />
            </td>
            <td colSpan={2} className="p-0">
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
            <td colSpan={2} className="p-0">
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
            <td colSpan={2} className="p-0">
              <input
                type="text"
                placeholder="Others"
                value={sheetData.others3Note}
                onChange={(e) => handleChange("others3Note", e.target.value)}
                className="text-slate-600"
              />
            </td>
            <td colSpan={2} className="p-0">
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
            <td colSpan={2} className="p-0">
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
            <td colSpan={2} className="p-0">
              <input
                type="text"
                placeholder="Others 1"
                value={sheetData.others4Note}
                onChange={(e) => handleChange("others4Note", e.target.value)}
                className="text-slate-600"
              />
            </td>
            <td colSpan={2} className="p-0">
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
            <td className="font-medium text-slate-700">Tea</td>
            <td colSpan={2} className="p-0">
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
            <td colSpan={2} className="p-0">
              <input
                type="text"
                placeholder="Others 5"
                value={sheetData.others5Note}
                onChange={(e) => handleChange("others5Note", e.target.value)}
                className="text-slate-600"
              />
            </td>
            <td colSpan={2} className="p-0">
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

          {/* EXPENSES TOTALS ROW */}
          <tr className="bg-slate-50 font-bold text-slate-800 text-xs">
            <td>TOTAL (₹)</td>
            <td colSpan={2} className="text-slate-900 pl-1">{totalExpenses1.toFixed(2)}</td>
            <td colSpan={2}>TOTAL (₹)</td>
            <td colSpan={2} className="text-slate-900 pl-1">{totalExpenses2.toFixed(2)}</td>
          </tr>

          {/* ODOMETER */}
          <tr>
            <td className="font-medium text-slate-700">Start Meter Reading</td>
            <td colSpan={2} className="font-semibold text-slate-900 pl-1 select-none bg-slate-100/50">
              {sheetData.startMeter}
            </td>
            <td colSpan={2} className="font-medium text-slate-700">Total Distance Covered (KM)</td>
            <td colSpan={2} className="font-semibold text-slate-900 pl-1 bg-slate-50/50">
              {totalDistanceCovered}
            </td>
          </tr>

          <tr>
            <td className="font-medium text-slate-700">
              End Meter Reading <span className="text-red-500">*</span>
            </td>
            <td colSpan={2} className="p-0">
              <input
                type="number"
                required
                placeholder="0.00"
                value={sheetData.endMeter}
                onChange={(e) => handleChange("endMeter", e.target.value)}
                className="font-semibold text-blue-600"
              />
            </td>
            <td colSpan={2} className="font-medium text-slate-700">Average (KM/Ltr)</td>
            <td colSpan={2} className="font-semibold text-blue-600 pl-1 bg-slate-50/50">
              {averageKmLtr}
            </td>
          </tr>

          {/* TOLLS */}
          <tr className="bg-slate-50/40">
            <td className="font-medium text-slate-700">
              Total Toll Gates (Pickup) <span className="text-red-500">*</span>
            </td>
            <td colSpan={2} className="font-semibold text-slate-900 pl-1 select-none bg-slate-100/50">
              {pickupTolls}
            </td>
            <td colSpan={2} className="font-medium text-slate-700">
              Total Toll Gates (Destination) <span className="text-red-500">*</span>
            </td>
            <td colSpan={2} className="p-0">
              <input
                type="number"
                step="1"
                min="0"
                required
                placeholder="0"
                value={sheetData.destinationTolls}
                onChange={(e) => {
                  const val = e.target.value;
                  handleChange(
                    "destinationTolls",
                    val === "" ? "" : Math.floor(Number(val))
                  );
                }}
                onWheel={(e) => e.currentTarget.blur()}
                className="font-semibold text-blue-600"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}