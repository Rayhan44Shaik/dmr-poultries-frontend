import React from "react";
import { Truck, Bird, Scale, HeartPulse, Store } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { compactKpiValue, KpiCardGrid, KpiMetricValue, type KpiCardItem } from "../../../../ui";

interface Props {
  totalTrips: number;
  totalBirds: number;
  totalWeight: number;
  totalMortality: number;
  totalShops: number;
  /** 1-load / 2-load / 3+-load split of the filtered trips; shown only here. */
  loadBreakdown?: { one: number; two: number; more: number };
}

/** Filter-result summary for Trip List, rendered through the global KPI surface. */
function TripKPICards({ totalTrips, totalBirds, totalWeight, totalMortality, totalShops, loadBreakdown }: Props) {
  const { t } = useI18n();
  const trips = compactKpiValue(totalTrips);
  const shops = compactKpiValue(totalShops);
  const birds = compactKpiValue(totalBirds);
  const weight = compactKpiValue(totalWeight, 2);
  const mortality = compactKpiValue(totalMortality);

  // Keep the operational reading order consistent with the Trip List table:
  // trips → shops → birds → weight → mortality.
  const cards: KpiCardItem[] = [
    { id: "trips", label: t("ops.trip.total_trips"), value: (<><KpiMetricValue metric={trips} />{loadBreakdown ? <span className="absolute bottom-1 right-0 flex items-center gap-1.5 text-[11px] font-bold leading-normal tabular-nums"><span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-blue-700">L1 - {loadBreakdown.one}</span><span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-indigo-700">L2 - {loadBreakdown.two}</span>{loadBreakdown.more > 0 ? <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-violet-700">L3+ - {loadBreakdown.more}</span> : null}</span> : null}</>), tooltip: `${t("ops.trip.total_trips")}: ${trips.exact}`, Icon: Truck, tone: "blue" },
    { id: "shops", label: t("ops.trip.total_shops"), value: <KpiMetricValue metric={shops} />, tooltip: `${t("ops.trip.total_shops")}: ${shops.exact}`, Icon: Store, tone: "amber" },
    { id: "birds", label: t("ops.trip.total_birds"), value: <KpiMetricValue metric={birds} />, tooltip: `${t("ops.trip.total_birds")}: ${birds.exact}`, Icon: Bird, tone: "emerald" },
    { id: "weight", label: t("ops.trip.total_weight_kg"), value: <KpiMetricValue metric={weight} unit="KG" />, tooltip: `${t("ops.trip.total_weight_kg")}: ${weight.exact} KG`, Icon: Scale, tone: "violet" },
    { id: "mortality", label: t("operations.total_mortality"), value: <KpiMetricValue metric={mortality} />, tooltip: `${t("operations.total_mortality")}: ${mortality.exact}`, Icon: HeartPulse, tone: "rose" },
  ];

  return <KpiCardGrid items={cards} gridClassName="lg:grid-cols-5" ariaLabel={t("ops.trip.trip_list")} />;
}

export default React.memo(TripKPICards);
