import React from "react";
import { Truck, Bird, Scale, HeartPulse, Store } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { KpiCardGrid, type KpiCardItem } from "../../../../ui";

interface Props {
  totalTrips: number;
  totalBirds: number;
  totalWeight: number;
  totalMortality: number;
  totalShops: number;
}

/** Filter-result summary for Trip List, rendered through the global KPI surface. */
function TripKPICards({ totalTrips, totalBirds, totalWeight, totalMortality, totalShops }: Props) {
  const { t } = useI18n();
  // Keep the operational reading order consistent with the Trip List table:
  // trips → shops → birds → weight → mortality.
  const cards: KpiCardItem[] = [
    { id: "trips", label: t("ops.trip.total_trips"), value: totalTrips.toLocaleString(), Icon: Truck, tone: "blue" },
    { id: "shops", label: t("ops.trip.total_shops"), value: totalShops.toLocaleString(), Icon: Store, tone: "amber" },
    { id: "birds", label: t("ops.trip.total_birds"), value: totalBirds.toLocaleString(), Icon: Bird, tone: "emerald" },
    { id: "weight", label: t("ops.trip.total_weight_kg"), value: totalWeight.toFixed(2), Icon: Scale, tone: "violet" },
    { id: "mortality", label: t("operations.total_mortality"), value: totalMortality.toLocaleString(), Icon: HeartPulse, tone: "rose" },
  ];

  return <KpiCardGrid items={cards} gridClassName="lg:grid-cols-5" ariaLabel={t("ops.trip.trip_list")} />;
}

export default React.memo(TripKPICards);
