import React from "react";
import { Fuel, IndianRupee, FileText, CheckCircle, TrendingUp, Gauge } from "lucide-react";
import { compactKpiValue, KpiCardGrid, KpiMetricValue, type KpiCardItem } from "../../../../ui";
import { useI18n } from "../../../../i18n";

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
  const { t, language } = useI18n();

  const litres = compactKpiValue(totalLitres, 2);
  const cost = compactKpiValue(totalAmount, 2);
  const pending = compactKpiValue(pendingCount);
  const approved = compactKpiValue(approvedCount);
  const mileage = avgMileage !== null ? compactKpiValue(avgMileage, 2) : null;
  const recentMileage = recentTripMileage !== null && recentTripMileage !== undefined ? compactKpiValue(recentTripMileage, 2) : null;

  const isTe = language === "te";

  const cards: KpiCardItem[] = [
    {
      id: "litres",
      label: t("ops.fuel.total_fuel"),
      value: <KpiMetricValue metric={litres} unit="L" />,
      tooltip: isTe ? `మొత్తం ఇంధనం: ${litres.exact} లీటర్లు` : `Total Fuel: ${litres.exact} Litres`,
      Icon: Fuel,
      tone: "blue",
    },
    {
      id: "cost",
      label: t("ops.fuel.total_cost"),
      value: <KpiMetricValue metric={cost} prefix="₹ " />,
      tooltip: isTe ? `మొత్తం ఖర్చు: ₹ ${cost.exact}` : `Total Cost: ₹ ${cost.exact}`,
      Icon: IndianRupee,
      tone: "emerald",
    },
    {
      id: "pending",
      label: t("ops.fuel.pending_bills"),
      value: <KpiMetricValue metric={pending} />,
      tooltip: isTe ? `పెండింగ్ ఆమోదం: ${pending.exact}` : `Pending Approval: ${pending.exact}`,
      Icon: FileText,
      tone: "amber",
    },
    {
      id: "approved",
      label: t("ops.fuel.approved_bills"),
      value: <KpiMetricValue metric={approved} />,
      tooltip: isTe ? `ఆమోదించబడింది: ${approved.exact}` : `Approved: ${approved.exact}`,
      Icon: CheckCircle,
      tone: "cyan",
    },
    {
      id: "mileage",
      label: t("ops.fuel.avg_efficiency"),
      value: mileage ? <KpiMetricValue metric={mileage} unit="KM/L" /> : "—",
      tooltip: mileage ? (isTe ? `ఫ్లీట్ సామర్థ్యం: ${mileage.exact} KM/L` : `Fleet Efficiency: ${mileage.exact} KM/L`) : (isTe ? "మైలేజ్ డేటా లేదు" : "No mileage data"),
      Icon: TrendingUp,
      tone: "violet",
    },
  ];

  if (recentMileage) {
    cards.push({
      id: "recent-mileage",
      label: t("ops.fuel.recent_trip_mileage"),
      value: <KpiMetricValue metric={recentMileage} unit="KM/L" />,
      tooltip: isTe ? `ఇటీవలి ట్రిప్: ${recentMileage.exact} KM/L` : `Recent Trip: ${recentMileage.exact} KM/L`,
      Icon: Gauge,
      tone: "rose",
    });
  }

  const gridClass = cards.length === 6 ? "lg:grid-cols-6" : "lg:grid-cols-5";

  return <KpiCardGrid items={cards} gridClassName={gridClass} ariaLabel={t("ops.fuel.title")} />;
}

export default React.memo(FuelKPICards);
