import React, { useMemo } from "react";
import { Store, Bird, Scale } from "lucide-react";
import type { ShopDelivery } from "../types/trip";

interface Props {
  rows: ShopDelivery[];
}

function TripTotals({ rows }: Props) {
  // Safety: ensure rows is an array
  const safeRows = rows ?? [];

  const totals = useMemo(() => {
    const totalShops = safeRows.length;
    const totalBirds = safeRows.reduce((sum, row) => sum + Number(row.birds || 0), 0);
    const totalWeight = safeRows.reduce((sum, row) => sum + Number(row.weight || 0), 0);
    return { totalShops, totalBirds, totalWeight };
  }, [safeRows]);

  const cards = [
    {
      title: "Total Shops",
      value: totals.totalShops,
      icon: <Store size={20} />,
      bg: "bg-blue-50",
      text: "text-blue-700",
    },
    {
      title: "Total Birds",
      value: totals.totalBirds,
      icon: <Bird size={20} />,
      bg: "bg-green-50",
      text: "text-green-700",
    },
    {
      title: "Total Weight (Kg)",
      value: totals.totalWeight.toFixed(2),
      icon: <Scale size={20} />,
      bg: "bg-orange-50",
      text: "text-orange-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${card.bg} rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between hover:shadow-sm transition-all`}
        >
          <div>
            <p className="text-xs font-medium text-slate-500">{card.title}</p>
            <p className={`text-xl font-bold mt-1 ${card.text}`}>{card.value}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${card.bg} ${card.text}`}>
            {card.icon}
          </div>
        </div>
      ))}
    </div>
  );
}

export default React.memo(TripTotals);