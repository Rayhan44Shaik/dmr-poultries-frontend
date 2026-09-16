import React from "react";
import { IndianRupee, Paperclip, Truck, Wrench } from "lucide-react";
import { useI18n } from "../../../../i18n";
import {
  compactKpiValue,
  KpiCardGrid,
  KpiMetricValue,
  type KpiCardItem,
} from "../../../../ui";

type Props = {
  totalRecords: number;
  totalCost: number;
  vehiclesServiced: number;
  documents: number;
};

/** A concise, non-status summary for the filtered maintenance timeline. */
function MaintenanceKPICards({
  totalRecords,
  totalCost,
  vehiclesServiced,
  documents,
}: Props) {
  const { t } = useI18n();
  const records = compactKpiValue(totalRecords);
  const cost = compactKpiValue(totalCost, 2);
  const vehicles = compactKpiValue(vehiclesServiced);
  const attachedDocuments = compactKpiValue(documents);

  const cards: KpiCardItem[] = [
    {
      id: "maintenance-records",
      label: t("fleet.maintenance_history.total_maintenance"),
      value: <KpiMetricValue metric={records} />,
      tooltip: `${t("fleet.maintenance_history.total_maintenance")}: ${records.exact}`,
      Icon: Wrench,
      tone: "blue",
    },
    {
      id: "maintenance-cost",
      label: t("fleet.maintenance_history.total_cost"),
      value: <KpiMetricValue metric={cost} prefix="₹" />,
      tooltip: `${t("fleet.maintenance_history.total_cost")}: ₹${cost.exact}`,
      Icon: IndianRupee,
      tone: "violet",
    },
    {
      id: "maintenance-vehicles",
      label: t("fleet.maintenance_history.vehicles_serviced"),
      value: <KpiMetricValue metric={vehicles} />,
      tooltip: `${t("fleet.maintenance_history.vehicles_serviced")}: ${vehicles.exact}`,
      Icon: Truck,
      tone: "amber",
    },
    {
      id: "maintenance-documents",
      label: t("fleet.maintenance_history.documents"),
      value: <KpiMetricValue metric={attachedDocuments} />,
      tooltip: `${t("fleet.maintenance_history.documents")}: ${attachedDocuments.exact}`,
      Icon: Paperclip,
      tone: "cyan",
    },
  ];

  return (
    <KpiCardGrid
      items={cards}
      gridClassName="lg:grid-cols-4"
      ariaLabel={t("nav.maintenanceHistory")}
    />
  );
}

export default React.memo(MaintenanceKPICards);
