// src/modules/operations/fuel-expenses/components/FuelBillTable.tsx

import { FileImage } from "lucide-react";
import type { FuelExpense } from "../types/fuelExpense";

interface Props {
  bills: FuelExpense[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function StatusBadge({ status, sourceType }: { status: FuelExpense["status"]; sourceType: FuelExpense["sourceType"] }) {
  const styles: Record<string, string> = {
    Approved: "bg-green-100 text-green-700 border-green-200",
    "Pending Approval": "bg-amber-100 text-amber-700 border-amber-200",
    Draft: "bg-amber-100 text-amber-700 border-amber-200",
    Rejected: "bg-red-100 text-red-700 border-red-200",
    Deleted: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const label = status === "Pending Approval" || status === "Draft" ? "Pending" : status;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles[status] ?? styles.Draft}`}>
      {label}
      {status === "Approved" && sourceType === "TRIP" && (
        <span className="text-emerald-500" title="Auto-approved on trip completion">
          · Auto
        </span>
      )}
    </span>
  );
}

function SourceBadge({ sourceType }: { sourceType: FuelExpense["sourceType"] }) {
  return sourceType === "TRIP" ? (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
      TRIP
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      MANUAL
    </span>
  );
}

export function FuelBillTable({ bills, selectedId, onSelect }: Props) {
  if (bills.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">No fuel bills found.</div>;
  }

  const formatDate = (d: string) => {
    if (!d) return "—";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const handleRowClick = (bill: FuelExpense) => {
    onSelect(selectedId === bill.id ? null : bill.id);
  };

  const getImageFilename = (bill: FuelExpense): string => bill.imageName || `${bill.billNo}.png`;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-slate-600">
            <th className="w-8 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider">#</th>
            <th className="w-32 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Bill No</th>
            <th className="w-24 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
            <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Source</th>
            <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Trip No</th>
            <th className="w-32 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Vehicle</th>
            <th className="w-32 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Driver</th>
            <th className="w-24 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Meter (KM)</th>
            <th className="w-36 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Bunk</th>
            <th className="w-20 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Litres</th>
            <th className="w-20 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Rate (₹/L)</th>
            <th className="w-28 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Amount (₹)</th>
            <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Approval</th>
            <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Bill Image</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill, idx) => {
            const isSelected = selectedId === bill.id;
            const isPending = bill.status === "Pending Approval" || bill.status === "Draft";

            return (
              <tr
                key={bill.id}
                className={`border-b border-slate-200 hover:bg-blue-50 transition-colors duration-150 cursor-pointer ${
                  isSelected ? "bg-blue-100" : ""
                } ${isPending ? "border-l-4 border-l-orange-400" : ""}`}
                onClick={() => handleRowClick(bill)}
              >
                <td className="px-2 py-2.5 text-center text-xs text-slate-500">{idx + 1}</td>
                <td className="px-3 py-2.5 font-medium text-blue-700 truncate">{bill.billNo}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(bill.billDate)}</td>
                <td className="px-3 py-2.5">
                  <SourceBadge sourceType={bill.sourceType} />
                </td>
                <td className="px-3 py-2.5 truncate">{bill.tripNo || "—"}</td>
                <td className="px-3 py-2.5 truncate">{bill.vehicleNo}</td>
                <td className="px-3 py-2.5 truncate">{bill.driverName}</td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {bill.currentMeter.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 truncate max-w-[140px]">{bill.pumpName}</td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {bill.liters.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {bill.fuelRate.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap">
                  ₹ {bill.amount.toFixed(2)}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={bill.status} sourceType={bill.sourceType} />
                </td>
                <td className="px-3 py-2.5">
                  {bill.imageData ? (
                    <a
                      href={bill.imageData}
                      download={getImageFilename(bill)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium truncate block max-w-[120px]"
                      onClick={(e) => e.stopPropagation()}
                      title="Download image"
                    >
                      {getImageFilename(bill)}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <FileImage size={14} className="text-slate-300" />
                      No image
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
