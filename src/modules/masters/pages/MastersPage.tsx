import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../../../layouts/DashboardLayout/DashboardLayout";
import {
  Store,
  Sprout,
  Truck,
  Users,
  Landmark,
  Bird,
} from "lucide-react";

import ShopsPage from "../shops/pages/ShopsPage";
import FarmsPage from "../farms/pages/FarmsPage";
import VehiclesPage from "../vehicles/pages/VehiclesPage";
import EmployeesPage from "../employees/pages/EmployeesPage";
import BanksPage from "../banks/pages/BanksPage";
import BirdTypesPage from "../bird-types/pages/BirdTypesPage";

// Tabs with distinct icon colours
const tabs = [
  { key: "shops", label: "Shops", icon: Store, color: "text-blue-600", component: ShopsPage },
  { key: "farms", label: "Farms", icon: Sprout, color: "text-green-600", component: FarmsPage },
  { key: "vehicles", label: "Vehicles", icon: Truck, color: "text-purple-600", component: VehiclesPage },
  { key: "employees", label: "Employees", icon: Users, color: "text-orange-600", component: EmployeesPage },
  { key: "banks", label: "Banks", icon: Landmark, color: "text-amber-600", component: BanksPage },
  { key: "birdTypes", label: "Bird Types", icon: Bird, color: "text-rose-600", component: BirdTypesPage },
];

function MastersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = searchParams.get("tab") || "shops";

  useEffect(() => {
    if (!searchParams.get("tab")) {
      navigate("/masters?tab=shops", { replace: true });
    }
  }, [location.search, navigate, searchParams]);

  const ActiveComponent = useMemo(() => {
    const found = tabs.find((tab) => tab.key === activeTab);
    return found ? found.component : ShopsPage;
  }, [activeTab]);

  const handleTabChange = (tabKey: string) => {
    navigate(`/masters?tab=${tabKey}`);
  };

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 lg:px-8 pt-0 pb-6">
        {/* Tab Bar – Operations style with coloured icons */}
        <div className="bg-white border-b border-slate-200 rounded-t-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200
                    ${isActive
                      ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }
                  `}
                >
                  <Icon
                    size={18}
                    className={isActive ? "text-blue-700" : tab.color}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <ActiveComponent embedded={true} />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default React.memo(MastersPage);