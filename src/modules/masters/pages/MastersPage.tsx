// src/modules/masters/pages/MastersPage.tsx

import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Store,
  Sprout,
  Truck,
  Users,
  Landmark,
  Bird,
  Map,
  TrendingUp
} from "lucide-react";

import ShopsPage from "../shops/pages/ShopsPage";
import FarmsPage from "../farms/pages/FarmsPage";
import VehiclesPage from "../vehicles/pages/VehiclesPage";
import EmployeesPage from "../employees/pages/EmployeesPage";
import BanksPage from "../banks/pages/BanksPage";
import BirdTypesPage from "../bird-types/pages/BirdTypesPage";
//import RoutesPage from "../routes/pages/RoutesPage";
import { MarketRatePage } from "../Market_Rates/Pages/MarketRatePage";

// Tabs with distinct icon colours
const tabs = [
  { key: "shops", label: "Shops", icon: Store, color: "text-blue-600", component: ShopsPage },
  { key: "farms", label: "Farms", icon: Sprout, color: "text-green-600", component: FarmsPage },
  { key: "vehicles", label: "Vehicles", icon: Truck, color: "text-purple-600", component: VehiclesPage },
  { key: "employees", label: "Employees", icon: Users, color: "text-orange-600", component: EmployeesPage },
  { key: "banks", label: "Banks", icon: Landmark, color: "text-amber-600", component: BanksPage },
  { key: "birdTypes", label: "Bird Types", icon: Bird, color: "text-rose-600", component: BirdTypesPage },
  { key: 'market-rate', label: 'Market Rate', icon: TrendingUp, color: 'text-indigo-600', component: MarketRatePage },
  //{ key: "routes", label: "Routes", icon: Map, color: "text-cyan-600", component: RoutesPage },
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
    <div className="w-full pt-4 pb-6 space-y-5">
      {/* Full-width Tab Bar Container touching left & right edges */}
      <div className="bg-white border-y sm:border border-slate-200/90 sm:rounded-xl shadow-sm px-4 sm:px-6 py-1.5 w-full">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200
                  ${isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
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

      {/* Content Area with side padding preserved */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(MastersPage);