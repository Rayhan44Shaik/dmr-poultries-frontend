import { NavLink } from "react-router-dom";
import { useI18n } from "../../../../i18n";

const tabs = [
  { labelKey: "ops.trip.tab_entry", path: "/operations/vehicle-trips/entry" },
  { labelKey: "ops.trip.tab_list", path: "/operations/vehicle-trips/list" },
];

export default function VehicleTripTabs() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-10 border-b border-slate-200">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) =>
            `relative py-2 text-sm font-medium transition-colors duration-200 ${
              isActive ? "text-blue-600" : "text-slate-600 hover:text-slate-900"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {t(tab.labelKey)}
              <span
                className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 transition-all duration-200 ${
                  isActive ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}