import React from "react";
import { Fuel, IndianRupee, FileText, TrendingUp, Gauge, MapPin } from "lucide-react";
import { compactKpiValue, KpiCardGrid, KpiMetricValue, type KpiCardItem } from "../../../../ui";
import { useI18n } from "../../../../i18n";

interface Props {
  totalLitres: number;
  totalAmount: number;
  pendingCount: number;
  totalDistance: number | null;
  avgMileage: number | null;
  recentTripMileage?: number | null;
  bunkDetails?: Array<{ name: string; bills: number; litres: number; amount: number }>;
}

export function FuelKPICards({
  totalLitres,
  totalAmount,
  pendingCount,
  totalDistance,
  avgMileage,
  recentTripMileage = null,
  bunkDetails = [],
}: Props) {
  const { t, language } = useI18n();

  const litres = compactKpiValue(totalLitres, 2);
  const cost = compactKpiValue(totalAmount, 2);
  const pending = compactKpiValue(pendingCount);
  const distance = totalDistance !== null ? compactKpiValue(totalDistance, 0) : null;
  const mileage = avgMileage !== null ? compactKpiValue(avgMileage, 2) : null;
  const recentMileage = recentTripMileage !== null && recentTripMileage !== undefined ? compactKpiValue(recentTripMileage, 2) : null;

  const isTe = language === "te";

  const cards: KpiCardItem[] = [
    {
      id: "litres",
      label: t("ops.fuel.total_fuel"),
      value: <KpiMetricValue metric={litres} unit="L" />,
      tooltip: isTe ? `మొత్తం ఇంధనం: ${litres.exact} లీటర్` : `Total Fuel: ${litres.exact} Litres`,
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
      id: "distance",
      label: "TOTAL DISTANCE",
      value: distance ? <KpiMetricValue metric={distance} unit="km" /> : "—",
      tooltip: isTe ? `మొత్తంстояние: ${distance?.exact} кіломੀਟർ` : `Total Distance: ${distance?.exact ?? "—"} km`,
      Icon: Gauge,
      tone: "violet",
    },
    {
      id: "mileage",
      label: t("ops.fuel.avg_efficiency"),
      value: mileage ? <KpiMetricValue metric={mileage} unit="KM/L" /> : "—",
      tooltip: mileage ? (isTe ? `ఫ్లీట్ సామర్థ్యం: ${mileage.exact} KM/L` : `Fleet Efficiency: ${mileage.exact} KM/L`) : isTe ? "మైలేజ్ డేటా లేదు" : "No mileage data",
      Icon: TrendingUp,
      tone: "violet",
    },
    {
      id: "bunks",
      label: "Fuel Bunks",
      value: String(bunkDetails.length),
      tooltip: bunkDetails.length
        ? bunkDetails.map((bunk) => `${bunk.name}: ${bunk.bills} bill${bunk.bills === 1 ? "" : "s"} · ${bunk.litres.toFixed(2)} L · ₹${bunk.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`).join("\n")
        : "No bunk details for the selected filters",
      Icon: MapPin,
      tone: "rose",
    },
  ];

  if (recentMileage) {
    cards.push({
      id: "recent-mileage",
      label: t("ops.fuel.recent_trip_mileage"),
      value: <KpiMetricValue metric={recentMileage} unit="KM/L" />,
      tooltip: isTe ? `ఇటేవలి ట్రిప్: ${recentMileage.exact} KM/L` : `Recent Trip: ${recentMileage.exact} KM/L`,
      Icon: Gauge,
      tone: "rose",
    });
  }

  const gridClass = cards.length >= 6 ? "lg:grid-cols-6" : "lg:grid-cols-5";

  return <KpiCardGrid items={cards} gridClassName={gridClass} ariaLabel={t("ops.fuel.title")} />;
}

export default React.memo(FuelKPICards);