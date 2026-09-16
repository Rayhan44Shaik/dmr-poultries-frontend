import React from "react";
import { CheckCircle2, IndianRupee, Truck, Wrench, Clock } from "lucide-react";
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
  approved: number;
  pending: number;
};

/** Exact summary of the records currently shown by Maintenance List. */
function MaintenanceKPICards({
  totalRecords,
  totalCost,
  vehiclesServiced,
  approved,
  pending,
}: Props) {
  const { t } = useI18n();
  const records = compactKpiValue(totalRecords);
  const cost = compactKpiValue(totalCost, 2);
  const vehicles = compactKpiValue(vehiclesServiced);
  const approvedRecords = compactKpiValue(approved);
  const pendingRecords = compactKpiValue(pending);

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
      id: "maintenance-approved",
      label: t("status.approved"),
      value: <KpiMetricValue metric={approvedRecords} />,
      tooltip: `${t("status.approved")}: ${approvedRecords.exact}`,
      Icon: CheckCircle2,
      tone: "emerald",
    },
    {
      id: "maintenance-pending",
      label: t("status.pending"),
      value: <KpiMetricValue metric={pendingRecords} />,
      tooltip: `${t("status.pending")}: ${pendingRecords.exact}`,
      Icon: Clock,
      tone: "rose",
    },
  ];

  return (
    <KpiCardGrid
      items={cards}
      gridClassName="lg:grid-cols-5"
      ariaLabel={t("nav.maintenanceHistory")}
    />
  );
}

export default React.memo(MaintenanceKPICards);
