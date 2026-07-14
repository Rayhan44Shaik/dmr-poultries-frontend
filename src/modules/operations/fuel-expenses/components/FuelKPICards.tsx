import { Fuel, IndianRupee, FileText, CheckCircle, Gauge } from "lucide-react";

interface Props {
  totalLitres: number;
  totalAmount: number;
  pendingCount: number;
  approvedCount: number;
  totalMileage: number; // ✅ new
}

export function FuelKPICards({ totalLitres, totalAmount, pendingCount, approvedCount, totalMileage }: Props) {
  const cards = [
    {
      title: "Total Fuel (L)",
      value: totalLitres.toFixed(2),
      icon: <Fuel size={20} />,
      bg: "bg-blue-50",
      text: "text-blue-700",
    },
    {
      title: "Total Cost (₹)",
      value: `₹ ${totalAmount.toFixed(2)}`,
      icon: <IndianRupee size={20} />,
      bg: "bg-green-50",
      text: "text-green-700",
    },
    {
      title: "Pending Bills",
      value: pendingCount,
      icon: <FileText size={20} />,
      bg: "bg-yellow-50",
      text: "text-yellow-700",
    },
    {
      title: "Approved Bills",
      value: approvedCount,
      icon: <CheckCircle size={20} />,
      bg: "bg-emerald-50",
      text: "text-emerald-700",
    },
    {
      title: "Total Mileage (KM)",
      value: totalMileage.toLocaleString(),
      icon: <Gauge size={20} />,
      bg: "bg-purple-50",
      text: "text-purple-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`flex items-center justify-between rounded-lg border border-slate-200 p-4 shadow-sm ${card.bg}`}
        >
          <div>
            <div className="text-xs font-medium text-slate-500">{card.title}</div>
            <div className={`text-xl font-bold ${card.text}`}>{card.value}</div>
          </div>
          <div className={`rounded-full p-2 ${card.bg} ${card.text}`}>{card.icon}</div>
        </div>
      ))}
    </div>
  );
}