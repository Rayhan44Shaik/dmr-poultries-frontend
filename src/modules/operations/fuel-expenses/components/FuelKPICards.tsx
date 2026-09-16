import React from "react";
import { Fuel, IndianRupee, FileText, CheckCircle, TrendingUp, Gauge } from "lucide-react";
import { compactKpiValue, KpiCardGrid, KpiMetricValue, type KpiCardItem } from "../../../../ui";

interface Props {
  totalLitres: number;
  totalAmount: number;
  pendingCount: number;
  approvedCount: number;
  avgMileage: number | null;
  recentTripMileage?: number | null;
}

export function FuelKPICards({
  totalLitres,
  totalAmount,
  pendingCount,
  approvedCount,
  avgMileage,
  recentTripMileage = null,
}: Props) {
  const litres = compactKpiValue(totalLitres, 2);
  const cost = compactKpiValue(totalAmount, 2);
  const pending = compactKpiValue(pendingCount);
  const approved = compactKpiValue(approvedCount);
  const mileage = avgMileage !== null ? compactKpiValue(avgMileage, 2) : null;
  const recentMileage = recentTripMileage !== null && recentTripMileage !== undefined ? compactKpiValue(recentTripMileage, 2) : null;

  const cards: KpiCardItem[] = [
    {
      id: "litres",
      label: "Total Fuel",
      value: <KpiMetricValue metric={litres} unit="L" />,
      tooltip: `Total Fuel: ${litres.exact} Litres`,
      Icon: Fuel,
      tone: "blue",
    },
    {
      id: "cost",
      label: "Total Cost",
      value: <KpiMetricValue metric={cost} prefix="₹ " />,
      tooltip: `Total Cost: ₹ ${cost.exact}`,
      Icon: IndianRupee,
      tone: "emerald",
    },
    {
      id: "pending",
      label: "Pending Bills",
      value: <KpiMetricValue metric={pending} />,
      tooltip: `Pending Approval: ${pending.exact}`,
      Icon: FileText,
      tone: "amber",
    },
    {
      id: "approved",
      label: "Approved Bills",
      value: <KpiMetricValue metric={approved} />,
      tooltip: `Approved: ${approved.exact}`,
      Icon: CheckCircle,
      tone: "cyan",
    },
    {
      id: "mileage",
      label: "Avg Efficiency",
      value: mileage ? <KpiMetricValue metric={mileage} unit="KM/L" /> : "—",
      tooltip: mileage ? `Fleet Efficiency: ${mileage.exact} KM/L` : "No mileage data",
      Icon: TrendingUp,
      tone: "violet",
    },
  ];

  if (recentMileage) {
    cards.push({
      id: "recent-mileage",
      label: "Recent Trip Mileage",
      value: <KpiMetricValue metric={recentMileage} unit="KM/L" />,
      tooltip: `Recent Trip: ${recentMileage.exact} KM/L`,
      Icon: Gauge,
      tone: "rose",
    });
  }

  const gridClass = cards.length === 6 ? "lg:grid-cols-6" : "lg:grid-cols-5";

  return <KpiCardGrid items={cards} gridClassName={gridClass} ariaLabel="Fuel Expenses Summary" />;
}

export default React.memo(FuelKPICards);
