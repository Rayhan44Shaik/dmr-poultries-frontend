import React from "react";
import { IndianRupee, Route, Wrench } from "lucide-react";
import { useI18n } from "../../../../i18n";
import {
  compactKpiValue,
  KpiCardGrid,
  KpiMetricValue,
  type KpiCardItem,
} from "../../../../ui";

type Props = {
  totalCost: number;
  totalServices: number;
  totalDistance: number;
};

/**
 * A focused summary for the currently visible maintenance history: approved
 * service cost/count plus mileage from completed trips in the date/vehicle
 * scope. It deliberately contains no Status, document, or table metrics.
 */
function MaintenanceKPICards({
  totalCost,
  totalServices,
  totalDistance,
}: Props) {
  const { t } = useI18n();
  const cost = compactKpiValue(totalCost, 2);
  const services = compactKpiValue(totalServices);
  const distance = compactKpiValue(totalDistance);
  const km = t("common.km");

  const cards: KpiCardItem[] = [
    {
      id: "maintenance-cost",
      label: t("fleet.maintenance_history.total_cost"),
      value: <KpiMetricValue metric={cost} prefix="₹" />,
      tooltip: `${t("fleet.maintenance_history.total_cost")}: ₹${cost.exact}`,
      Icon: IndianRupee,
      tone: "violet",
    },
    {
      id: "maintenance-services",
      label: t("fleet.maintenance_history.number_of_services"),
      value: <KpiMetricValue metric={services} />,
      tooltip: `${t("fleet.maintenance_history.number_of_services")}: ${services.exact}`,
      Icon: Wrench,
      tone: "emerald",
    },
    {
      id: "maintenance-distance",
      label: t("fleet.maintenance_history.distance_covered"),
      value: <KpiMetricValue metric={distance} unit={km} />,
      tooltip: `${t("fleet.maintenance_history.distance_covered")}: ${distance.exact} ${km}`,
      Icon: Route,
      tone: "blue",
    },
  ];

  return (
    <KpiCardGrid
      items={cards}
      gridClassName="lg:grid-cols-3"
      ariaLabel={t("nav.maintenanceHistory")}
    />
  );
}

export default React.memo(MaintenanceKPICards);
