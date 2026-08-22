import React from "react";
import { useI18n } from "../../../../i18n";

interface Props {
  status: "Pending"| "Completed";
}

function TripStatusBadge({ status }: Props) {
  const { t } = useI18n();
  const styles = {
    Pending: "bg-yellow-100 text-yellow-700",
    Completed: "bg-green-100 text-green-700",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
      {t(`status.${status.toLowerCase()}`)}
    </span>
  );
}

export default React.memo(TripStatusBadge);