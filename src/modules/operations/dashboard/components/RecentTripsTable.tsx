import { Link } from "react-router-dom";
import { useI18n } from "../../../../i18n";

interface RecentTrip {
  id: number;
  tripNo: string;
  vehicleNo: string;
  shopName: string;
  weight: number;
  status: string;
}

interface RecentTripsTableProps {
  trips: RecentTrip[];
}

export default function RecentTripsTable({ trips }: RecentTripsTableProps) {
  const { t } = useI18n();
  const tripList = trips || [];
  if (tripList.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-200 p-4 text-center text-slate-400">{t("ops.dashboard.no_recent_trips")}</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("ops.dashboard.recent_trips")}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-slate-600">
              <th className="px-3 py-2 text-left">{t("operations.trip_no")}</th>
              <th className="px-3 py-2 text-left">{t("common.vehicle")}</th>
              <th className="px-3 py-2 text-left">{t("common.shop")}</th>
              <th className="px-3 py-2 text-right">{t("ops.dashboard.weight_kg")}</th>
              <th className="px-3 py-2 text-center">{t("common.status")}</th>
              <th className="px-3 py-2 text-center">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {tripList.map((trip) => (
              <tr key={trip.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-blue-700">{trip.tripNo}</td>
                <td className="px-3 py-2">{trip.vehicleNo}</td>
                <td className="px-3 py-2">{trip.shopName}</td>
                <td className="px-3 py-2 text-right">{trip.weight.toFixed(2)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    trip.status === "Completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {(() => {
                      const k = "status." + String(trip.status).toLowerCase();
                      const label = t(k);
                      return label === k ? trip.status : label;
                    })()}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <Link
                    to={`/operations/vehicle-trips/entry?tripId=${trip.id}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    {t("common.view")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-right">
        <Link to="/operations/vehicle-trips/entry" className="text-xs text-blue-600 hover:underline">
          {t("ops.dashboard.view_all_trips")} →
        </Link>
      </div>
    </div>
  );
}