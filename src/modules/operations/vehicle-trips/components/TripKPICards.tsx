import React from "react";
import { Truck, Bird, Scale, HeartPulse, Store } from "lucide-react";
import { useI18n } from "../../../../i18n";

interface Props {
  totalTrips: number;
  totalBirds: number;
  totalWeight: number;
  totalMortality: number;
  totalShops: number;
}

function TripKPICards({ totalTrips, totalBirds, totalWeight, totalMortality, totalShops }: Props) {
  const { t } = useI18n();
  const cards = [
    {
      title: t("ops.trip.total_trips"),
      value: totalTrips.toLocaleString(),
      icon: <Truck size={20} />,
      bg: "bg-blue-50/70",
      iconBg: "bg-blue-50/80",
      text: "text-blue-500",
    },
    {
      title: t("ops.trip.total_birds"),
      value: totalBirds.toLocaleString(),
      icon: <Bird size={20} />,
      bg: "bg-green-50/70",
      iconBg: "bg-green-50/80",
      text: "text-green-500",
    },
    {
      title: t("ops.trip.total_weight_kg"),
      value: totalWeight.toFixed(2),
      icon: <Scale size={20} />,
      bg: "bg-purple-50/70",
      iconBg: "bg-purple-50/80",
      text: "text-purple-500",
    },
    {
      title: t("operations.total_mortality"),
      value: totalMortality.toLocaleString(),
      icon: <HeartPulse size={20} />,
      bg: "bg-red-50/70",
      iconBg: "bg-red-50/80",
      text: "text-red-500",
    },
    {
      title: t("ops.trip.total_shops"),
      value: totalShops.toLocaleString(),
      icon: <Store size={20} />,
      bg: "bg-orange-50/70",
      iconBg: "bg-orange-50/80",
      text: "text-orange-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${card.bg} rounded-lg border border-slate-200 px-3 py-3 flex items-center justify-between hover:shadow-sm transition-all`}
        >
          <div>
            <div className="text-xs font-medium text-slate-500">{card.title}</div>
            <div className={`text-lg font-bold mt-0.5 ${card.text}`}>{card.value}</div>
          </div>
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center ${card.iconBg} ${card.text}`}
          >
            {card.icon}
          </div>
        </div>
      ))}
    </div>
  );
}

export default React.memo(TripKPICards);