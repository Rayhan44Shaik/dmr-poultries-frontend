import { Eye, Pencil, Trash2, CheckCircle } from "lucide-react";
import type { FuelExpense } from "../types/fuelExpense";

interface Props {
  bills: FuelExpense[];
  onView: (bill: FuelExpense) => void;
  onEdit: (bill: FuelExpense) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
}

export function FuelBillTable({ bills, onView, onEdit, onDelete, onApprove }: Props) {
  if (bills.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">No fuel bills found.</div>;
  }

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr className="text-slate-600">
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider w-20">Status</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider w-32">Bill No</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider w-28">Date</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider w-36">Vehicle</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider w-32">Driver</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider w-32">Supervisor</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider w-28">Meter (KM)</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider w-28">Amount (₹)</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider w-24">Rate (₹/L)</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider w-20">Litres</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider w-36">Bunk</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider w-28">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => {
            const statusColor = bill.status === "Approved" ? "border-green-500" : "border-yellow-500";
            return (
              <tr
                key={bill.id}
                className={`border-t border-l-4 ${statusColor} hover:bg-blue-100 transition-colors duration-150`}
              >
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      bill.status === "Approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {bill.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-medium text-blue-700 whitespace-nowrap">{bill.billNo}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(bill.date)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{bill.vehicleNo}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{bill.driverName}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{bill.supervisorName}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{bill.meterReading.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">₹ {bill.amount.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{bill.rate.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{bill.litres.toFixed(2)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{bill.petrolBunk}</td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onView(bill)}
                      className="rounded p-1.5 text-blue-600 hover:bg-blue-100 transition-colors"
                      title="View"
                    >
                      <Eye size={14} />
                    </button>
                    {bill.status === "Pending" && (
                      <>
                        <button
                          onClick={() => onEdit(bill)}
                          className="rounded p-1.5 text-green-600 hover:bg-green-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(bill.id)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-100 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => onApprove(bill.id)}
                          className="rounded p-1.5 text-emerald-600 hover:bg-emerald-100 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}