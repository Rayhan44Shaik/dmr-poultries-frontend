import { Circle, CheckCircle2 } from "lucide-react";
import type { FuelExpense } from "../types/fuelExpense";

interface Props {
  bills: FuelExpense[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function FuelBillTable({ bills, selectedId, onSelect }: Props) {
  if (bills.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">No fuel bills found.</div>;
  }

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const handleRowClick = (bill: FuelExpense) => {
    onSelect(selectedId === bill.id ? null : bill.id);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="text-slate-600">
            <th className="w-24 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
            <th className="w-36 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Bill No</th>
            <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
            <th className="w-40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Vehicle</th>
            <th className="w-32 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Driver</th>
            <th className="w-32 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Supervisor</th>
            {/* Meter first */}
            <th className="w-28 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Meter (KM)</th>
            {/* Litres second */}
            <th className="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Litres</th>
            {/* Rate third */}
            <th className="w-24 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Rate (₹/L)</th>
            {/* Amount last */}
            <th className="w-32 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Amount (₹)</th>
            <th className="w-40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider">Bunk</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => {
            const isSelected = selectedId === bill.id;
            return (
              <tr
                key={bill.id}
                className={`border-b border-slate-200 hover:bg-blue-100 transition-colors duration-150 cursor-pointer ${
                  isSelected ? "bg-blue-100" : ""
                }`}
                onClick={() => handleRowClick(bill)}
              >
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      bill.status === "Approved"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        bill.status === "Approved" ? "bg-green-500" : "bg-yellow-500"
                      }`}
                    />
                    {bill.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-medium text-blue-700 truncate">{bill.billNo}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(bill.date)}</td>
                <td className="px-3 py-2.5 truncate">{bill.vehicleNo}</td>
                <td className="px-3 py-2.5 truncate">{bill.driverName}</td>
                <td className="px-3 py-2.5 truncate">{bill.supervisorName}</td>
                {/* Meter (KM) – right-aligned */}
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {bill.meterReading.toLocaleString()}
                </td>
                {/* Litres – right-aligned */}
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {bill.litres.toFixed(2)}
                </td>
                {/* Rate – right-aligned */}
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {bill.rate.toFixed(2)}
                </td>
                {/* Amount – right-aligned & bold */}
                <td className="px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap">
                  ₹ {bill.amount.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 truncate">{bill.petrolBunk}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}