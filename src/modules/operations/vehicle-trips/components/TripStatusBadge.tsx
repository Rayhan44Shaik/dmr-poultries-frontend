import React from "react";
import { useI18n } from "../../../../i18n";

interface Props {
  status: "Pending"| "Completed";
}

function TripStatusBadge({ status }: Props) {
  const { t } = useI18n();
  const styles = {
    Pending: "bg-orange-50 text-orange-700 border border-orange-200",
    Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
      {t(`status.${status.toLowerCase()}`)}
    </span>
  );
}

export default React.memo(TripStatusBadge);